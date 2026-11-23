package com.modi.decisionjournal.data

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Wraps Firestore for one signed-in user. Reads flow through a single snapshot
 * listener exposed as LiveData; writes are suspending functions.
 */
class DecisionRepository(private val uid: String) {

    private val collection = FirebaseFirestore.getInstance()
        .collection("users").document(uid).collection("decisions")

    private val settingsDocument = FirebaseFirestore.getInstance()
        .collection("users").document(uid).collection("settings").document("preferences")

    private val _decisions = MutableLiveData<List<Decision>>(emptyList())
    val decisions: LiveData<List<Decision>> = _decisions

    private var registration: ListenerRegistration? = null

    fun start() {
        if (registration != null) return
        registration = collection
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(500)
            .addSnapshotListener { snapshot, error ->
                if (error == null && snapshot != null) {
                    _decisions.postValue(
                        snapshot.documents.mapNotNull { it.toObject(Decision::class.java) },
                    )
                }
            }
    }

    fun stop() {
        registration?.remove()
        registration = null
    }

    suspend fun create(
        title: String,
        options: List<String>,
        reasoning: String,
        prediction: String,
        confidence: Long,
        state: String,
        tags: List<String>,
        reviewDate: Date,
    ): String {
        val data = mapOf(
            "title" to title,
            "options" to options,
            "reasoning" to reasoning,
            "prediction" to prediction,
            "confidence" to confidence,
            "state" to state,
            "tags" to tags,
            "reviewDate" to Timestamp(reviewDate),
            "postponedAt" to null,
            "review" to null,
            "status" to "open",
            "createdAt" to FieldValue.serverTimestamp(),
            "updatedAt" to FieldValue.serverTimestamp(),
        )
        return collection.add(data).await().id
    }

    suspend fun update(id: String, fields: Map<String, Any?>) {
        val data = fields + mapOf("updatedAt" to FieldValue.serverTimestamp())
        collection.document(id).update(data).await()
    }

    suspend fun postpone(id: String, newReviewDate: Date) {
        update(
            id,
            mapOf(
                "reviewDate" to Timestamp(newReviewDate),
                "postponedAt" to FieldValue.serverTimestamp(),
            ),
        )
    }

    suspend fun review(
        id: String,
        outcome: String,
        predictionResult: String,
        reasoningRating: String,
        lesson: String,
    ) {
        update(
            id,
            mapOf(
                "status" to "reviewed",
                "review" to mapOf(
                    "reviewedAt" to FieldValue.serverTimestamp(),
                    "outcome" to outcome,
                    "predictionResult" to predictionResult,
                    "reasoningRating" to reasoningRating,
                    "lesson" to lesson,
                ),
            ),
        )
    }

    suspend fun delete(id: String) {
        collection.document(id).delete().await()
    }

    /** Open decisions whose review date has passed; used by the daily reminder. */
    suspend fun dueCount(): Int {
        // Filter locally instead of composing an indexed query: the dataset is
        // small, and it keeps the reminder working if an index is missing.
        val now = System.currentTimeMillis()
        return collection
            .whereEqualTo("status", "open")
            .get()
            .await()
            .documents
            .count { document ->
                val reviewDate = document.getTimestamp("reviewDate") ?: return@count false
                reviewDate.toDate().time <= now
            }
    }

    suspend fun loadPreferences(): Preferences {
        val snapshot = settingsDocument.get().await()
        return snapshot.toObject(Preferences::class.java) ?: Preferences()
    }

    suspend fun savePreferences(preferences: Preferences) {
        settingsDocument.set(preferences, SetOptions.merge()).await()
    }

    /** Full export for the Settings screen, with timestamps as ISO-8601 strings. */
    suspend fun exportJson(): String {
        val snapshot = collection.get().await()
        val decisions = JSONArray()
        snapshot.documents.forEach { document ->
            val decision = JSONObject()
            decision.put("id", document.id)
            (document.data ?: emptyMap<String, Any>()).forEach { (key, value) ->
                decision.put(key, toJson(value))
            }
            decisions.put(decision)
        }
        return JSONObject()
            .put("exportedAt", isoNow())
            .put("decisions", decisions)
            .toString(2)
    }

    private fun toJson(value: Any?): Any? = when (value) {
        null -> JSONObject.NULL
        is Timestamp -> iso(value.toDate())
        is Map<*, *> -> JSONObject().also { json ->
            value.forEach { (key, entry) -> json.put(key.toString(), toJson(entry)) }
        }
        is List<*> -> JSONArray().also { array ->
            value.forEach { array.put(toJson(it)) }
        }
        else -> value
    }

    private fun iso(date: Date): String = SimpleDateFormat(
        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
        Locale.US,
    ).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(date)

    private fun isoNow(): String = iso(Date())
}

/** One repository per user, shared by all screens for the session. */
object Repositories {
    private val repositories = mutableMapOf<String, DecisionRepository>()

    @Synchronized
    fun decisions(uid: String): DecisionRepository = repositories.getOrPut(uid) {
        DecisionRepository(uid)
    }

    @Synchronized
    fun clear() {
        repositories.values.forEach { it.stop() }
        repositories.clear()
    }
}

/** Convenience for the worker and screens that only need the current user's id. */
fun currentUid(): String? = FirebaseAuth.getInstance().currentUser?.uid
