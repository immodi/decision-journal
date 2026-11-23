package com.modi.decisionjournal.ui

import androidx.lifecycle.LiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.modi.decisionjournal.data.Decision
import com.modi.decisionjournal.data.DecisionRepository
import com.modi.decisionjournal.data.Repositories
import java.util.Calendar

class DecisionsViewModel(repository: DecisionRepository) : ViewModel() {
    val decisions: LiveData<List<Decision>> = repository.decisions

    init {
        repository.start()
    }

    companion object {
        fun factory(uid: String) = viewModelFactory {
            initializer { DecisionsViewModel(Repositories.decisions(uid)) }
        }
    }
}

object ReviewDates {
    private const val DAY_MS = 24L * 60 * 60 * 1000

    fun inDays(days: Int): java.util.Date {
        val calendar = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, days) }
        return calendar.time
    }

    /** MaterialDatePicker returns UTC midnight; keep the same calendar day locally. */
    fun fromPickerMillis(millis: Long): java.util.Date {
        val utc = Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC")).apply {
            timeInMillis = millis
        }
        val local = Calendar.getInstance().apply {
            clear()
            set(utc.get(Calendar.YEAR), utc.get(Calendar.MONTH), utc.get(Calendar.DAY_OF_MONTH))
        }
        return local.time
    }

    fun format(date: java.util.Date?): String {
        if (date == null) return "—"
        return java.text.SimpleDateFormat("d MMM yyyy", java.util.Locale.getDefault()).format(date)
    }

    fun formatTimestamp(timestamp: com.google.firebase.Timestamp?): String =
        format(timestamp?.toDate())
}
