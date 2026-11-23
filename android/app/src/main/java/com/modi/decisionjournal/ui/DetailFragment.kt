package com.modi.decisionjournal.ui

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.os.bundleOf
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.google.android.material.color.MaterialColors
import com.google.android.material.datepicker.MaterialDatePicker
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.modi.decisionjournal.MainActivity
import com.modi.decisionjournal.R
import com.modi.decisionjournal.data.Decision
import com.modi.decisionjournal.data.Repositories
import com.modi.decisionjournal.data.currentUid
import com.modi.decisionjournal.databinding.FragmentDetailBinding
import kotlinx.coroutines.launch
import java.util.Date

class DetailFragment : Fragment() {

    private var _binding: FragmentDetailBinding? = null
    private val binding get() = _binding!!

    private val decisionId: String get() = requireArguments().getString(ARG_ID)!!

    private val viewModel: DecisionsViewModel by viewModels {
        DecisionsViewModel.factory(checkNotNull(currentUid()) { "A signed-in user is required" })
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentDetailBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.reviewNowButton.setOnClickListener {
            (activity as? MainActivity)?.openReview(decisionId)
        }
        binding.editButton.setOnClickListener {
            (activity as? MainActivity)?.openEditDecision(decisionId)
        }
        binding.postponeButton.setOnClickListener { showPostponeDialog() }
        binding.deleteButton.setOnClickListener { confirmDelete() }

        viewModel.decisions.observe(viewLifecycleOwner) { decisions ->
            if (decisions.isEmpty()) return@observe
            val decision = decisions.firstOrNull { it.id == decisionId }
            if (decision == null) {
                binding.notFoundText.isVisible = true
                binding.actionsGroup.isVisible = false
            } else {
                binding.notFoundText.isVisible = false
                render(decision)
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun render(decision: Decision) {
        binding.detailTitle.text = decision.title
        binding.statusText.setText(
            when {
                decision.isReviewed -> R.string.reviewed
                decision.isDue -> R.string.due
                else -> R.string.open
            },
        )
        binding.statusText.setTextColor(
            when {
                decision.isReviewed -> MaterialColors.getColor(
                    binding.statusText,
                    com.google.android.material.R.attr.colorOnSurfaceVariant,
                )
                decision.isDue -> MaterialColors.getColor(
                    binding.statusText,
                    com.google.android.material.R.attr.colorSecondary,
                )
                else -> MaterialColors.getColor(
                    binding.statusText,
                    com.google.android.material.R.attr.colorPrimary,
                )
            },
        )

        binding.predictionText.text = decision.prediction
        binding.confidenceText.text = getString(R.string.confidence_percent, decision.confidence)
        binding.optionsText.text = decision.options.joinToString(", ").ifEmpty { "—" }
        binding.reasoningText.text = decision.reasoning.ifEmpty { "—" }
        binding.stateText.text = decision.state
        binding.tagsText.text = decision.tags.joinToString(", ").ifEmpty { "—" }
        binding.reviewDateText.text = ReviewDates.formatTimestamp(decision.reviewDate)
        binding.createdText.text = getString(
            R.string.recorded_on,
            ReviewDates.formatTimestamp(decision.createdAt),
        )

        binding.postponedText.isVisible = decision.wasPostponed
        binding.postponedText.text = getString(
            R.string.postponed_once,
            ReviewDates.formatTimestamp(decision.postponedAt),
        )

        if (decision.isReviewed) {
            binding.reviewGroup.isVisible = true
            binding.permanentNote.isVisible = true
            binding.actionsGroup.isVisible = false

            val review = decision.review
            binding.reviewOutcomeText.text = review?.outcome ?: "—"
            binding.reviewResultText.text = review?.predictionResult ?: "—"
            binding.reviewReasoningText.text = review?.reasoningRating ?: "—"
            binding.reviewLessonText.text = review?.lesson?.ifEmpty { null } ?: "—"
            binding.reviewLessonLabel.isVisible = !review?.lesson.isNullOrEmpty()
            binding.reviewLessonText.isVisible = !review?.lesson.isNullOrEmpty()
            binding.reviewedAtText.text = getString(
                R.string.reviewed_on,
                ReviewDates.formatTimestamp(review?.reviewedAt),
            )
        } else {
            binding.reviewGroup.isVisible = false
            binding.permanentNote.isVisible = false
            binding.actionsGroup.isVisible = true
            binding.reviewNowButton.isVisible = decision.isDue
            binding.postponeButton.isVisible = decision.isDue && !decision.wasPostponed
        }
    }

    private fun showPostponeDialog() {
        val options = arrayOf(
            getString(R.string.one_week),
            getString(R.string.one_month),
            getString(R.string.three_months),
            getString(R.string.pick_date),
        )
        MaterialAlertDialogBuilder(requireContext())
            .setTitle(R.string.postpone_title)
            .setMessage(R.string.postpone_body)
            .setItems(options) { _, which ->
                when (which) {
                    0 -> postpone(ReviewDates.inDays(7))
                    1 -> postpone(ReviewDates.inDays(30))
                    2 -> postpone(ReviewDates.inDays(90))
                    else -> pickPostponeDate()
                }
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun pickPostponeDate() {
        val picker = MaterialDatePicker.Builder.datePicker()
            .setTitleText(getString(R.string.review_date))
            .setSelection(MaterialDatePicker.todayInUtcMilliseconds())
            .build()
        picker.addOnPositiveButtonClickListener { millis ->
            postpone(ReviewDates.fromPickerMillis(millis))
        }
        picker.show(childFragmentManager, "postpone-date")
    }

    private fun postpone(date: Date) {
        val repository = Repositories.decisions(checkNotNull(currentUid()))
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                repository.postpone(decisionId, date)
            } catch (error: Exception) {
                Log.e(javaClass.simpleName, "Postponing failed", error)
                toast(getString(R.string.postpone_failed))
            }
        }
    }

    private fun confirmDelete() {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle(R.string.delete_title)
            .setMessage(R.string.delete_body)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.delete_confirm) { _, _ -> delete() }
            .show()
    }

    private fun delete() {
        val repository = Repositories.decisions(checkNotNull(currentUid()))
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                repository.delete(decisionId)
                (activity as? MainActivity)?.openHome()
            } catch (error: Exception) {
                Log.e(javaClass.simpleName, "Deleting failed", error)
                toast(getString(R.string.delete_failed))
            }
        }
    }

    private fun toast(message: String) {
        Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show()
    }

    companion object {
        private const val ARG_ID = "decisionId"

        fun forDecision(id: String): DetailFragment = DetailFragment().apply {
            arguments = bundleOf(ARG_ID to id)
        }
    }
}
