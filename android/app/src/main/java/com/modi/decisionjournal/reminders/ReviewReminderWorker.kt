package com.modi.decisionjournal.reminders

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.modi.decisionjournal.data.currentUid
import kotlinx.coroutines.tasks.await

/**
 * Once a day, counts open decisions that are due and posts one notification.
 * WorkManager timing is approximate, which the spec accepts.
 */
class ReviewReminderWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val uid = currentUid() ?: return Result.success()

        return try {
            val due = FirebaseFirestore.getInstance()
                .collection("users").document(uid).collection("decisions")
                .whereEqualTo("status", "open")
                .whereLessThanOrEqualTo("reviewDate", Timestamp.now())
                .get()
                .await()

            if (due.size() > 0) {
                NotificationHelper.showDueNotification(applicationContext, due.size())
            }
            Result.success()
        } catch (error: Exception) {
            Result.retry()
        }
    }
}
