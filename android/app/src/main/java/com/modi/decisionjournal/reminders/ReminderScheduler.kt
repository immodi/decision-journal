package com.modi.decisionjournal.reminders

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.Calendar
import java.util.concurrent.TimeUnit

object ReminderScheduler {
    private const val WORK_NAME = "review-reminder"
    private const val PREFS = "reminder"
    private const val KEY_TIME = "reminderTime"
    const val DEFAULT_TIME = "09:00"

    fun schedule(context: Context) {
        schedule(context, savedTime(context))
    }

    fun schedule(context: Context, reminderTime: String) {
        val time = parseTime(reminderTime) ?: parseTime(DEFAULT_TIME) ?: return
        val delay = millisUntil(time.first, time.second)

        val request = PeriodicWorkRequestBuilder<ReviewReminderWorker>(1, TimeUnit.DAYS)
            .setInitialDelay(delay, TimeUnit.MILLISECONDS)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
    }

    fun saveTime(context: Context, reminderTime: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TIME, reminderTime)
            .apply()
    }

    fun savedTime(context: Context): String = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .getString(KEY_TIME, DEFAULT_TIME) ?: DEFAULT_TIME

    private fun parseTime(value: String): Pair<Int, Int>? {
        val parts = value.split(":").mapNotNull { it.toIntOrNull() }
        if (parts.size != 2) return null
        val hour = parts[0]
        val minute = parts[1]
        if (hour !in 0..23 || minute !in 0..59) return null
        return hour to minute
    }

    private fun millisUntil(hour: Int, minute: Int): Long {
        val now = Calendar.getInstance()
        val target = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (before(now)) add(Calendar.DAY_OF_YEAR, 1)
        }
        return target.timeInMillis - now.timeInMillis
    }
}
