package com.modi.decisionjournal.ui

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.os.bundleOf
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.google.android.material.chip.Chip
import com.modi.decisionjournal.MainActivity
import com.modi.decisionjournal.R
import com.modi.decisionjournal.data.Decision
import com.modi.decisionjournal.data.DecisionStates
import com.modi.decisionjournal.data.Repositories
import com.modi.decisionjournal.data.currentUid
import com.modi.decisionjournal.databinding.FragmentReviewBinding
import kotlinx.coroutines.launch

class ReviewFragment : Fragment() {

    private var _binding: FragmentReviewBinding? = null
    private val binding get() = _binding!!

    private val decisionId: String get() = requireArguments().getString(ARG_ID)!!

    private val viewModel: DecisionsViewModel by viewModels {
        DecisionsViewModel.factory(checkNotNull(currentUid()) { "A signed-in user is required" })
    }

    private var prefilled = false
    private var redirected = false
    private var saving = false

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentReviewBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        buildChips()
        binding.cancelButton.setOnClickListener { (activity as? MainActivity)?.goBack() }
        binding.saveButton.setOnClickListener { save() }

        viewModel.decisions.observe(viewLifecycleOwner) { decisions ->
            val decision = decisions.firstOrNull { it.id == decisionId } ?: return@observe
            if (!decision.isOpen) {
                if (!redirected) {
                    redirected = true
                    (activity as? MainActivity)?.goBack()
                }
                return@observe
            }
            render(decision)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun buildChips() {
        val resultLabels = listOf("Yes", "Partly", "No")
        DecisionStates.PREDICTION_RESULTS.forEachIndexed { index, value ->
            val chip = Chip(requireContext()).apply {
                id = View.generateViewId()
                text = resultLabels[index]
                tag = value
                isCheckable = true
                isClickable = true
            }
            binding.resultGroup.addView(chip)
        }

        val ratingLabels = listOf("Sound", "Flawed", "Unsure")
        DecisionStates.REASONING_RATINGS.forEachIndexed { index, value ->
            val chip = Chip(requireContext()).apply {
                id = View.generateViewId()
                text = ratingLabels[index]
                tag = value
                isCheckable = true
                isClickable = true
            }
            binding.ratingGroup.addView(chip)
        }
    }

    private fun render(decision: Decision) {
        if (!prefilled) {
            prefilled = true
            binding.reviewTitle.text = getString(R.string.review) + ": " + decision.title
            binding.predictedOnLabel.text = getString(
                R.string.predicted_on,
                ReviewDates.formatTimestamp(decision.createdAt),
            )
            binding.predictionText.text = getString(R.string.quoted, decision.prediction)
            binding.confidenceText.text = getString(R.string.confidence_at_time) + ": " +
                getString(R.string.confidence_percent, decision.confidence)
        }
    }

    private fun selectedValue(group: com.google.android.material.chip.ChipGroup): String? {
        val chip = group.findViewById<Chip>(group.checkedChipId) ?: return null
        return chip.tag as? String
    }

    private fun save() {
        if (saving) return

        val outcome = binding.outcomeInput.text?.toString()?.trim().orEmpty()
        val predictionResult = selectedValue(binding.resultGroup)
        val reasoningRating = selectedValue(binding.ratingGroup)

        if (outcome.isEmpty() || predictionResult == null || reasoningRating == null) {
            binding.errorText.text = getString(R.string.review_required)
            binding.errorText.visibility = View.VISIBLE
            return
        }

        val repository = Repositories.decisions(checkNotNull(currentUid()))
        saving = true
        binding.saveButton.isEnabled = false
        binding.cancelButton.isEnabled = false

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                repository.review(
                    id = decisionId,
                    outcome = outcome,
                    predictionResult = predictionResult,
                    reasoningRating = reasoningRating,
                    lesson = binding.lessonInput.text?.toString()?.trim().orEmpty(),
                )
                (activity as? MainActivity)?.goBack()
            } catch (error: Exception) {
                Log.e(javaClass.simpleName, "Saving the review failed", error)
                Toast.makeText(
                    requireContext(),
                    getString(R.string.review_failed),
                    Toast.LENGTH_LONG,
                ).show()
                saving = false
                binding.saveButton.isEnabled = true
                binding.cancelButton.isEnabled = true
            }
        }
    }

    companion object {
        private const val ARG_ID = "decisionId"

        fun forDecision(id: String): ReviewFragment = ReviewFragment().apply {
            arguments = bundleOf(ARG_ID to id)
        }
    }
}
