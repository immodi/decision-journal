package com.modi.decisionjournal.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.modi.decisionjournal.data.Repositories
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout

/**
 * Runs the daily check when the alarm fires, even with the app in the
 * background, then schedules tomorrow's alarm.
 */
class ReviewReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val pendingResult = goAsync()
        val appContext = context.applicationContext

        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val uid = awaitUid()
                if (uid != null) {
                    val due = withTimeout(8_000) { Repositories.decisions(uid).dueCount() }
                    ReminderScheduler.recordCheck(appContext, due)
                    Log.i(javaClass.simpleName, "Due decisions: $due")
                    if (due > 0) {
                        NotificationHelper.showDueNotification(appContext, due)
                    }
                }
            } catch (error: Exception) {
                Log.e(javaClass.simpleName, "Reminder check failed", error)
            } finally {
                ReminderScheduler.scheduleNext(appContext)
                pendingResult.finish()
            }
        }
    }
}
