package com.modi.decisionjournal.reminders

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import java.util.Calendar

/**
 * Schedules one daily alarm. AlarmManager is used instead of WorkManager
 * because periodic work is routinely deferred in Doze or by battery savers,
 * which is why reminders otherwise only appear when the app is opened.
 */
object ReminderScheduler {
    private const val TAG = "review-reminder"
    private const val PREFS = "reminder"
    private const val KEY_TIME = "reminderTime"
    private const val KEY_LAST_CHECK = "lastCheck"
    private const val KEY_LAST_DUE = "lastDue"
    private const val REQUEST_CODE = 101

    const val DEFAULT_TIME = "09:00"

    fun schedule(context: Context) {
        schedule(context, savedTime(context))
    }

    fun schedule(context: Context, reminderTime: String) {
        val time = parseTime(reminderTime) ?: parseTime(DEFAULT_TIME) ?: return
        val triggerAt = nextTriggerMillis(time.first, time.second)
        val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return
        val pendingIntent = alarmIntent(context)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
            Log.i(TAG, "Scheduled inexact daily check at $reminderTime")
        } else {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
            Log.i(TAG, "Scheduled exact daily check at $reminderTime")
        }
    }

    /** Called by the receiver after each run so tomorrow's alarm is set. */
    fun scheduleNext(context: Context) {
        schedule(context, savedTime(context))
    }

    fun cancel(context: Context) {
        context.getSystemService(AlarmManager::class.java)?.cancel(alarmIntent(context))
    }

    fun recordCheck(context: Context, due: Int) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_LAST_CHECK, System.currentTimeMillis())
            .putInt(KEY_LAST_DUE, due)
            .apply()
    }

    fun lastCheck(context: Context): Pair<Long, Int>? {
        val preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val time = preferences.getLong(KEY_LAST_CHECK, 0L)
        if (time == 0L) return null
        return time to preferences.getInt(KEY_LAST_DUE, 0)
    }

    fun saveTime(context: Context, reminderTime: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TIME, reminderTime)
            .apply()
    }

    fun savedTime(context: Context): String = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .getString(KEY_TIME, DEFAULT_TIME) ?: DEFAULT_TIME

    private fun alarmIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context,
        REQUEST_CODE,
        Intent(context, ReviewReminderReceiver::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun parseTime(value: String): Pair<Int, Int>? {
        val parts = value.split(":").mapNotNull { it.toIntOrNull() }
        if (parts.size != 2) return null
        val hour = parts[0]
        val minute = parts[1]
        if (hour !in 0..23 || minute !in 0..59) return null
        return hour to minute
    }

    private fun nextTriggerMillis(hour: Int, minute: Int): Long {
        val now = Calendar.getInstance()
        val target = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (before(now)) add(Calendar.DAY_OF_YEAR, 1)
        }
        return target.timeInMillis
    }
}
