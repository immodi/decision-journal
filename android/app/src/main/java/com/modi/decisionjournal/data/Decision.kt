package com.modi.decisionjournal.data

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.ServerTimestamp

/**
 * The shared contract with the web client. Property names must match the
 * Firestore field names exactly; see docs/Spec.md section 4.
 *
 * All properties are `var` with defaults so Firestore can construct the class
 * with its no-argument constructor and set fields reflectively.
 */
data class Review(
    var reviewedAt: Timestamp? = null,
    var outcome: String? = null,
    var predictionResult: String? = null,
    var reasoningRating: String? = null,
    var lesson: String? = null,
)

data class Decision(
    @DocumentId var id: String? = null,
    var title: String = "",
    var options: List<String> = emptyList(),
    var reasoning: String = "",
    var prediction: String = "",
    var confidence: Long = 0,
    var state: String = "calm",
    var tags: List<String> = emptyList(),
    var reviewDate: Timestamp? = null,
    var postponedAt: Timestamp? = null,
    @ServerTimestamp var createdAt: Timestamp? = null,
    @ServerTimestamp var updatedAt: Timestamp? = null,
    var status: String = "open",
    var review: Review? = null,
) {
    val isOpen: Boolean get() = status == "open"
    val isReviewed: Boolean get() = status == "reviewed"
    val wasPostponed: Boolean get() = postponedAt != null

    val isDue: Boolean
        get() = isOpen && (reviewDate?.toDate()?.time ?: Long.MAX_VALUE) <= System.currentTimeMillis()
}

data class Preferences(
    var reminderTime: String = "09:00",
    var defaultReviewDays: Long = 30,
)

object DecisionStates {
    val ALL = listOf("calm", "tired", "stressed", "rushed", "anxious", "excited", "other")
    val SUGGESTED_TAGS = listOf("work", "money", "relationships", "health")
    val PREDICTION_RESULTS = listOf("yes", "partly", "no")
    val REASONING_RATINGS = listOf("sound", "flawed", "unsure")
}
