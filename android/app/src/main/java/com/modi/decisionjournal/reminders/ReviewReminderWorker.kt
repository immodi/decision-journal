package com.modi.decisionjournal.reminders

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.firebase.auth.FirebaseAuth
import com.modi.decisionjournal.data.Repositories
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/**
 * Once a day, counts open decisions that are due and posts one notification.
 * WorkManager timing is approximate, which the spec accepts.
 */
class ReviewReminderWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        // The worker can run in a fresh process, before Firebase has restored the
        // saved session. Waiting for the first auth callback avoids a silent no-op.
        val uid = awaitUid() ?: return Result.success()

        return try {
            val due = Repositories.decisions(uid).dueCount()
            Log.i(javaClass.simpleName, "Due decisions: $due")
            if (due > 0) {
                NotificationHelper.showDueNotification(applicationContext, due)
            }
            Result.success()
        } catch (error: Exception) {
            Log.e(javaClass.simpleName, "Reminder check failed", error)
            Result.retry()
        }
    }

    private suspend fun awaitUid(): String? {
        val auth = FirebaseAuth.getInstance()
        auth.currentUser?.uid?.let { return it }

        return withTimeoutOrNull(15_000) {
            suspendCancellableCoroutine { continuation ->
                var listener: FirebaseAuth.AuthStateListener? = null
                listener = FirebaseAuth.AuthStateListener { firebaseAuth ->
                    listener?.let(firebaseAuth::removeAuthStateListener)
                    if (continuation.isActive) {
                        continuation.resume(firebaseAuth.currentUser?.uid)
                    }
                }
                auth.addAuthStateListener(listener)
                continuation.invokeOnCancellation {
                    listener?.let(auth::removeAuthStateListener)
                }
            }
        }
    }
}
