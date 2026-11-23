package com.modi.decisionjournal.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import com.modi.decisionjournal.R
import com.modi.decisionjournal.data.Decision
import com.modi.decisionjournal.data.DecisionStates
import com.modi.decisionjournal.data.currentUid
import com.modi.decisionjournal.databinding.FragmentInsightsBinding
import com.modi.decisionjournal.databinding.ItemCalibrationRowBinding
import com.modi.decisionjournal.databinding.ItemStatRowBinding

class InsightsFragment : Fragment() {

    private var _binding: FragmentInsightsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: DecisionsViewModel by viewModels {
        DecisionsViewModel.factory(checkNotNull(currentUid()) { "A signed-in user is required" })
    }

    private data class Bucket(val min: Int, val max: Int, val midpoint: Int)

    private val buckets = listOf(
        Bucket(0, 49, 25),
        Bucket(50, 59, 55),
        Bucket(60, 69, 65),
        Bucket(70, 79, 75),
        Bucket(80, 89, 85),
        Bucket(90, 100, 95),
    )

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentInsightsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        viewModel.decisions.observe(viewLifecycleOwner) { render(it) }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun render(decisions: List<Decision>) {
        val open = decisions.filter { it.isOpen }
        val reviewed = decisions.filter { it.isReviewed }
        val overdue = open.filter { it.isDue }
        val postponed = decisions.filter { it.wasPostponed }

        binding.openCount.text = open.size.toString()
        binding.reviewedCount.text = reviewed.size.toString()
        binding.overdueCount.text = overdue.size.toString()
        binding.postponedCount.text = if (decisions.isEmpty()) {
            postponed.size.toString()
        } else {
            "${
                postponed.size
            } · ${Math.round(postponed.size * 100.0 / decisions.size)}%"
        }

        val enough = reviewed.size >= 5
        binding.statsGroup.isVisible = enough
        binding.notEnoughText.isVisible = !enough
        if (!enough) {
            binding.notEnoughText.text = getString(R.string.not_enough_data, reviewed.size)
            return
        }

        renderCalibration(reviewed)
        renderByState(reviewed)
        renderByTag(reviewed)
    }

    private fun renderCalibration(reviewed: List<Decision>) {
        binding.calibrationRows.removeAllViews()
        var shown = 0

        buckets.forEach { bucket ->
            val items = reviewed.filter {
                it.confidence >= bucket.min && it.confidence <= bucket.max
            }
            if (items.size < 3) return@forEach

            val hits = items.sumOf { decision ->
                when (decision.review?.predictionResult) {
                    "yes" -> 1.0
                    "partly" -> 0.5
                    else -> 0.0
                }
            }
            val rate = hits / items.size
            val row = ItemCalibrationRowBinding.inflate(
                layoutInflater,
                binding.calibrationRows,
                false,
            )
            row.nameText.text = if (bucket.min == 0) "0–49" else "${bucket.min}–${bucket.max}"
            row.midpointText.text = "${bucket.midpoint}%"
            row.countText.text = items.size.toString()
            row.rateText.text = percent(rate)
            row.gapText.text = percent(rate - bucket.midpoint / 100.0)
            binding.calibrationRows.addView(row.root)
            shown++
        }

        binding.noBandText.isVisible = shown == 0
    }

    private fun renderByState(reviewed: List<Decision>) {
        binding.stateRows.removeAllViews()
        DecisionStates.ALL.forEach { state ->
            val items = reviewed.filter { it.state == state }
            if (items.isEmpty()) return@forEach
            val sound = items.count { it.review?.reasoningRating == "sound" }
            addStatRow(binding.stateRows, state, items.size, sound.toDouble() / items.size)
        }
    }

    private fun renderByTag(reviewed: List<Decision>) {
        binding.tagRows.removeAllViews()
        val tags = reviewed.flatMap { it.tags }.distinct().sorted()
        binding.noTagsText.isVisible = tags.isEmpty()

        tags.forEach { tag ->
            val items = reviewed.filter { it.tags.contains(tag) }
            val sound = items.count { it.review?.reasoningRating == "sound" }
            addStatRow(binding.tagRows, tag, items.size, sound.toDouble() / items.size)
        }
    }

    private fun addStatRow(
        container: android.widget.LinearLayout,
        name: String,
        count: Int,
        share: Double,
    ) {
        val row = ItemStatRowBinding.inflate(layoutInflater, container, false)
        row.nameText.text = name
        row.countText.text = count.toString()
        row.shareText.text = percent(share)
        container.addView(row.root)
    }

    private fun percent(value: Double): String = "${Math.round(value * 100)}%"
}
