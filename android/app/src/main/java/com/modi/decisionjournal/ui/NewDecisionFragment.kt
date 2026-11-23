package com.modi.decisionjournal.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.os.bundleOf
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.google.android.material.chip.Chip
import com.google.android.material.datepicker.MaterialDatePicker
import com.google.android.material.textfield.TextInputEditText
import com.modi.decisionjournal.MainActivity
import com.modi.decisionjournal.R
import com.modi.decisionjournal.data.Decision
import com.modi.decisionjournal.data.DecisionStates
import com.modi.decisionjournal.data.Preferences
import com.modi.decisionjournal.data.Repositories
import com.modi.decisionjournal.data.currentUid
import com.modi.decisionjournal.databinding.FragmentNewDecisionBinding
import kotlinx.coroutines.launch
import java.util.Date

class NewDecisionFragment : Fragment() {

    private var _binding: FragmentNewDecisionBinding? = null
    private val binding get() = _binding!!

    private val editingId: String? get() = arguments?.getString(ARG_ID)
    private val editing: Boolean get() = editingId != null

    private val viewModel: DecisionsViewModel by viewModels {
        DecisionsViewModel.factory(checkNotNull(currentUid()) { "A signed-in user is required" })
    }

    private val optionRows = mutableListOf<View>()
    private var selectedDate: Date? = null
    private var prefilled = false
    private var saving = false

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentNewDecisionBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.formTitle.setText(if (editing) R.string.edit_decision else R.string.new_decision)
        binding.saveButton.setText(if (editing) R.string.save_changes else R.string.save_decision)
        binding.reviewDateSection.isVisible = !editing
        binding.editNote.isVisible = editing

        buildStateChips()
        buildTagChips()
        addOptionRow(null)

        binding.confidenceLabel.text = getString(R.string.confidence_percent, 70)
        binding.confidenceSlider.addOnChangeListener { _, value, _ ->
            binding.confidenceLabel.text = getString(R.string.confidence_percent, value.toInt())
        }

        binding.addOptionButton.setOnClickListener { addOptionRow(null) }

        binding.weekChip.setOnClickListener { chooseDate(ReviewDates.inDays(7)) }
        binding.monthChip.setOnClickListener { chooseDate(ReviewDates.inDays(30)) }
        binding.quarterChip.setOnClickListener { chooseDate(ReviewDates.inDays(90)) }
        binding.pickDateButton.setOnClickListener { pickDate() }

        binding.cancelButton.setOnClickListener { (activity as? MainActivity)?.goBack() }
        binding.saveButton.setOnClickListener { save() }

        if (editing) {
            viewModel.decisions.observe(viewLifecycleOwner) { decisions ->
                if (prefilled) return@observe
                val decision = decisions.firstOrNull { it.id == editingId } ?: return@observe
                prefilled = true
                prefill(decision)
            }
        } else {
            viewLifecycleOwner.lifecycleScope.launch {
                val preferences = runCatching {
                    Repositories.decisions(checkNotNull(currentUid())).loadPreferences()
                }.getOrDefault(Preferences())
                if (selectedDate == null) {
                    val days = preferences.defaultReviewDays.toInt().coerceIn(1, 365)
                    chooseDate(ReviewDates.inDays(days))
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun buildStateChips() {
        DecisionStates.ALL.forEach { value ->
            val chip = Chip(requireContext()).apply {
                id = View.generateViewId()
                text = value
                isCheckable = true
                isClickable = true
            }
            binding.stateGroup.addView(chip)
        }
        (binding.stateGroup.getChildAt(0) as? Chip)?.isChecked = true
    }

    private fun buildTagChips() {
        DecisionStates.SUGGESTED_TAGS.forEach { value ->
            val chip = Chip(requireContext()).apply {
                id = View.generateViewId()
                text = value
                isCheckable = true
                isClickable = true
            }
            binding.tagsGroup.addView(chip)
        }
    }

    private fun addOptionRow(value: String?) {
        val row = layoutInflater.inflate(R.layout.item_option, binding.optionsContainer, false)
        row.findViewById<TextInputEditText>(R.id.optionInput).setText(value.orEmpty())
        row.findViewById<MaterialButton>(R.id.removeOptionButton).setOnClickListener {
            binding.optionsContainer.removeView(row)
            optionRows.remove(row)
            if (optionRows.isEmpty()) addOptionRow(null)
        }
        binding.optionsContainer.addView(row)
        optionRows.add(row)
    }

    private fun chooseDate(date: Date) {
        selectedDate = date
        binding.reviewDateText.text = ReviewDates.format(date)
    }

    private fun pickDate() {
        val picker = MaterialDatePicker.Builder.datePicker()
            .setTitleText(getString(R.string.review_date))
            .setSelection(MaterialDatePicker.todayInUtcMilliseconds())
            .build()
        picker.addOnPositiveButtonClickListener { millis ->
            chooseDate(ReviewDates.fromPickerMillis(millis))
        }
        picker.show(childFragmentManager, "review-date")
    }

    private fun prefill(decision: Decision) {
        binding.titleInput.setText(decision.title)
        binding.predictionInput.setText(decision.prediction)
        binding.reasoningInput.setText(decision.reasoning)
        binding.confidenceSlider.value = decision.confidence.coerceIn(0, 100).toFloat()
        binding.confidenceLabel.text = getString(
            R.string.confidence_percent,
            decision.confidence.toInt(),
        )

        optionRows.toList().forEach { binding.optionsContainer.removeView(it) }
        optionRows.clear()
        val options = decision.options.ifEmpty { listOf("") }
        options.forEach { addOptionRow(it) }

        for (index in 0 until binding.stateGroup.childCount) {
            val chip = binding.stateGroup.getChildAt(index) as? Chip ?: continue
            chip.isChecked = chip.text.toString() == decision.state
        }

        for (index in 0 until binding.tagsGroup.childCount) {
            val chip = binding.tagsGroup.getChildAt(index) as? Chip ?: continue
            chip.isChecked = decision.tags.contains(chip.text.toString())
        }

        val extra = decision.tags.filterNot { DecisionStates.SUGGESTED_TAGS.contains(it) }
        binding.extraTagsInput.setText(extra.joinToString(", "))
    }

    private fun selectedState(): String {
        val chip = binding.stateGroup.findViewById<Chip>(binding.stateGroup.checkedChipId)
        return chip?.text?.toString() ?: "calm"
    }

    private fun selectedTags(): List<String> {
        val suggested = binding.tagsGroup.checkedChipIds.mapNotNull { id ->
            binding.tagsGroup.findViewById<Chip>(id)?.text?.toString()
        }
        val extra = binding.extraTagsInput.text?.toString().orEmpty()
            .split(',')
            .map { it.trim().lowercase() }
            .filter { it.isNotEmpty() }
        return (suggested + extra).distinct()
    }

    private fun save() {
        if (saving) return

        val title = binding.titleInput.text?.toString()?.trim().orEmpty()
        val prediction = binding.predictionInput.text?.toString()?.trim().orEmpty()
        if (title.isEmpty() || prediction.isEmpty() || (!editing && selectedDate == null)) {
            showError(getString(R.string.required_fields))
            return
        }

        val options = optionRows.mapNotNull { row ->
            row.findViewById<TextInputEditText>(R.id.optionInput)
                .text?.toString()?.trim()?.takeIf { it.isNotEmpty() }
        }
        val uid = checkNotNull(currentUid())
        val repository = Repositories.decisions(uid)

        setSaving(true)
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                if (editing) {
                    repository.update(
                        editingId!!,
                        mapOf(
                            "title" to title,
                            "options" to options,
                            "reasoning" to binding.reasoningInput.text?.toString()?.trim().orEmpty(),
                            "prediction" to prediction,
                            "confidence" to binding.confidenceSlider.value.toLong(),
                            "state" to selectedState(),
                            "tags" to selectedTags(),
                        ),
                    )
                    (activity as? MainActivity)?.goBack()
                } else {
                    val id = repository.create(
                        title = title,
                        options = options,
                        reasoning = binding.reasoningInput.text?.toString()?.trim().orEmpty(),
                        prediction = prediction,
                        confidence = binding.confidenceSlider.value.toLong(),
                        state = selectedState(),
                        tags = selectedTags(),
                        reviewDate = selectedDate!!,
                    )
                    (activity as? MainActivity)?.openDetailAfterCreate(id)
                }
            } catch (error: Exception) {
                showError(
                    getString(
                        R.string.save_failed,
                        error.localizedMessage ?: getString(R.string.generic_failure),
                    ),
                )
                setSaving(false)
            }
        }
    }

    private fun setSaving(value: Boolean) {
        saving = value
        binding.saveButton.isEnabled = !value
        binding.cancelButton.isEnabled = !value
    }

    private fun showError(message: String) {
        binding.errorText.text = message
        binding.errorText.visibility = View.VISIBLE
    }

    companion object {
        private const val ARG_ID = "decisionId"

        fun forCreate(): NewDecisionFragment = NewDecisionFragment()

        fun forEdit(id: String): NewDecisionFragment = NewDecisionFragment().apply {
            arguments = bundleOf(ARG_ID to id)
        }
    }
}
