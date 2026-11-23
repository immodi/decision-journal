package com.modi.decisionjournal.ui

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.content.FileProvider
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.timepicker.MaterialTimePicker
import com.google.android.material.timepicker.TimeFormat
import com.google.firebase.auth.FirebaseAuth
import com.modi.decisionjournal.R
import com.modi.decisionjournal.data.DecisionRepository
import com.modi.decisionjournal.data.Preferences
import com.modi.decisionjournal.data.Repositories
import com.modi.decisionjournal.data.currentUid
import com.modi.decisionjournal.databinding.FragmentSettingsBinding
import com.modi.decisionjournal.reminders.NotificationHelper
import com.modi.decisionjournal.reminders.ReminderScheduler
import kotlinx.coroutines.launch
import java.io.File

class SettingsFragment : Fragment() {

    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!

    private var reminderTime: String = ReminderScheduler.DEFAULT_TIME
    private var loaded = false

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        reminderTime = ReminderScheduler.savedTime(requireContext())
        binding.reminderTimeButton.text = reminderTime
        binding.emailText.text = getString(
            R.string.signed_in_as,
            FirebaseAuth.getInstance().currentUser?.email ?: "—",
        )

        val repository = Repositories.decisions(checkNotNull(currentUid()))

        binding.reminderTimeButton.setOnClickListener { pickTime() }
        binding.saveButton.setOnClickListener { save() }
        binding.exportButton.setOnClickListener { export() }
        binding.signOutButton.setOnClickListener { FirebaseAuth.getInstance().signOut() }
        binding.testNotificationButton.setOnClickListener { sendTestNotification(repository) }
        updateNotificationStatus()

        viewLifecycleOwner.lifecycleScope.launch {
            runCatching { repository.loadPreferences() }.onSuccess { preferences ->
                if (loaded) return@onSuccess
                loaded = true
                binding.defaultDaysInput.setText(preferences.defaultReviewDays.toString())
                reminderTime = preferences.reminderTime
                binding.reminderTimeButton.text = reminderTime
                updateNotificationStatus()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (_binding != null) updateNotificationStatus()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun pickTime() {
        val parts = reminderTime.split(":").mapNotNull { it.toIntOrNull() }
        val hour = parts.getOrNull(0) ?: 9
        val minute = parts.getOrNull(1) ?: 0

        val picker = MaterialTimePicker.Builder()
            .setTimeFormat(TimeFormat.CLOCK_24H)
            .setHour(hour)
            .setMinute(minute)
            .setTitleText(R.string.reminder_time)
            .build()

        picker.addOnPositiveButtonClickListener {
            reminderTime = "%02d:%02d".format(picker.hour, picker.minute)
            binding.reminderTimeButton.text = reminderTime
            updateNotificationStatus()
        }
        picker.show(childFragmentManager, "reminder-time")
    }

    private fun updateNotificationStatus() {
        val enabled = NotificationHelper.notificationsEnabled(requireContext())
        val status = if (enabled) {
            getString(R.string.notify_status_on, reminderTime)
        } else {
            getString(R.string.notify_status_off)
        }
        val last = ReminderScheduler.lastCheck(requireContext())
        binding.notificationStatus.text = if (last == null) {
            status
        } else {
            status + "\n" + getString(
                R.string.last_check,
                ReviewDates.format(java.util.Date(last.first)),
                last.second,
            )
        }
        binding.testNotificationButton.setText(
            if (enabled) R.string.test_notification else R.string.open_notification_settings,
        )
    }

    private fun sendTestNotification(repository: DecisionRepository) {
        if (!NotificationHelper.notificationsEnabled(requireContext())) {
            openNotificationSettings()
            return
        }

        NotificationHelper.showTestNotification(requireContext())
        viewLifecycleOwner.lifecycleScope.launch {
            val due = runCatching { repository.dueCount() }.getOrNull()
            val message = when {
                due == null -> getString(R.string.test_sent)
                due == 0 -> getString(R.string.test_sent_none)
                else -> getString(R.string.test_sent_due, due)
            }
            Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show()
        }
    }

    private fun openNotificationSettings() {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, requireContext().packageName)
        } else {
            Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:${requireContext().packageName}"),
            )
        }
        runCatching { startActivity(intent) }
    }

    private fun save() {
        val days = binding.defaultDaysInput.text?.toString()?.trim()?.toLongOrNull()
            ?.coerceIn(1, 365) ?: 30
        binding.defaultDaysInput.setText(days.toString())

        val repository = Repositories.decisions(checkNotNull(currentUid()))
        binding.saveButton.isEnabled = false
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                repository.savePreferences(Preferences(reminderTime, days))
                ReminderScheduler.saveTime(requireContext(), reminderTime)
                ReminderScheduler.schedule(requireContext(), reminderTime)
                binding.messageText.setText(R.string.settings_saved)
                binding.messageText.isVisible = true
            } catch (error: Exception) {
                Log.e(javaClass.simpleName, "Saving settings failed", error)
                binding.messageText.setText(R.string.settings_save_failed)
                binding.messageText.isVisible = true
            } finally {
                binding.saveButton.isEnabled = true
            }
        }
    }

    private fun export() {
        val repository = Repositories.decisions(checkNotNull(currentUid()))
        binding.exportButton.isEnabled = false
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val json = repository.exportJson()
                val directory = File(requireContext().cacheDir, "exports").apply { mkdirs() }
                val file = File(directory, "decision-journal.json")
                file.writeText(json)

                val uri = FileProvider.getUriForFile(
                    requireContext(),
                    "${requireContext().packageName}.fileprovider",
                    file,
                )
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "application/json"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                startActivity(
                    Intent.createChooser(intent, getString(R.string.export_chooser)),
                )
            } catch (error: Exception) {
                Log.e(javaClass.simpleName, "Exporting failed", error)
                Toast.makeText(
                    requireContext(),
                    getString(R.string.export_failed),
                    Toast.LENGTH_LONG,
                ).show()
            } finally {
                binding.exportButton.isEnabled = true
            }
        }
    }
}
