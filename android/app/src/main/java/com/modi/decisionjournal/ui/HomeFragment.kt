package com.modi.decisionjournal.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.modi.decisionjournal.MainActivity
import com.modi.decisionjournal.R
import com.modi.decisionjournal.data.Decision
import com.modi.decisionjournal.data.DecisionStates
import com.modi.decisionjournal.data.currentUid
import com.modi.decisionjournal.databinding.FragmentHomeBinding

class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!

    private val viewModel: DecisionsViewModel by viewModels {
        DecisionsViewModel.factory(checkNotNull(currentUid()) { "Home requires a signed-in user" })
    }

    private lateinit var dueAdapter: DecisionAdapter
    private lateinit var recentAdapter: DecisionAdapter

    private var selectedTag: String? = null
    private var tagItems: List<String> = emptyList()
    private var allDecisions: List<Decision> = emptyList()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        dueAdapter = DecisionAdapter(
            onOpen = { openDetail(it) },
            onReview = { openReview(it) },
            onPostpone = { openDetail(it) },
        )
        recentAdapter = DecisionAdapter(
            onOpen = { openDetail(it) },
            onReview = { openReview(it) },
            onPostpone = { openDetail(it) },
        )

        binding.dueList.layoutManager = LinearLayoutManager(requireContext())
        binding.dueList.adapter = dueAdapter
        binding.recentList.layoutManager = LinearLayoutManager(requireContext())
        binding.recentList.adapter = recentAdapter

        buildStatusChips()

        binding.statusGroup.setOnCheckedStateChangeListener { _, _ -> render() }
        binding.tagGroup.setOnCheckedStateChangeListener { group, _ ->
            selectedTag = checkedChipTag(group)?.ifEmpty { null }
            render()
        }

        binding.insightsButton.setOnClickListener {
            (activity as? MainActivity)?.openInsights()
        }
        binding.settingsButton.setOnClickListener {
            (activity as? MainActivity)?.openSettings()
        }
        binding.newDecisionFab.setOnClickListener {
            (activity as? MainActivity)?.openNewDecision()
        }

        viewModel.decisions.observe(viewLifecycleOwner) { decisions ->
            allDecisions = decisions
            refreshTagChips(decisions)
            render()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun newChip(label: String, value: String): Chip = Chip(requireContext()).apply {
        id = View.generateViewId()
        text = label
        tag = value
        isCheckable = true
        isClickable = true
    }

    private fun buildStatusChips() {
        val options = listOf(
            "all" to getString(R.string.all),
            "open" to getString(R.string.open),
            "reviewed" to getString(R.string.reviewed),
        )
        options.forEach { (value, label) ->
            binding.statusGroup.addView(newChip(label, value))
        }
        (binding.statusGroup.getChildAt(0) as? Chip)?.isChecked = true
    }

    private fun checkedChipTag(group: ChipGroup): String? {
        val id = group.checkedChipId
        if (id == View.NO_ID) return null
        return group.findViewById<Chip>(id)?.tag as? String
    }

    private fun refreshTagChips(decisions: List<Decision>) {
        val tags = (DecisionStates.SUGGESTED_TAGS + decisions.flatMap { it.tags })
            .distinct()
            .sorted()
        if (tags == tagItems) return

        val previous = selectedTag
        tagItems = tags

        binding.tagGroup.removeAllViews()
        binding.tagGroup.addView(newChip(getString(R.string.all), ""))
        tags.forEach { tag -> binding.tagGroup.addView(newChip(tag, tag)) }

        val index = if (previous == null) 0 else tags.indexOf(previous) + 1
        (binding.tagGroup.getChildAt(index.coerceAtLeast(0)) as? Chip)?.isChecked = true

        if (previous != null && !tags.contains(previous)) {
            selectedTag = null
        }
    }

    private fun render() {
        val status = checkedChipTag(binding.statusGroup) ?: "all"
        val tagFilter = selectedTag
        val matches = allDecisions.filter { decision ->
            (tagFilter == null || decision.tags.contains(tagFilter)) &&
                (status == "all" || decision.status == status)
        }

        val due = matches.filter { it.isDue }.sortedBy { it.reviewDate?.seconds ?: 0L }
        val recent = matches.take(20)

        dueAdapter.submit(due)
        recentAdapter.submit(recent)

        val showDue = status != "reviewed" && due.isNotEmpty()
        binding.dueHeader.isVisible = showDue
        binding.dueList.isVisible = showDue
        binding.recentHeader.isVisible = recent.isNotEmpty()
        binding.recentList.isVisible = recent.isNotEmpty()

        binding.emptyText.isVisible = allDecisions.isEmpty()
        binding.nothingMatches.isVisible =
            allDecisions.isNotEmpty() && due.isEmpty() && recent.isEmpty()
    }

    private fun openDetail(decision: Decision) {
        (activity as? MainActivity)?.openDetail(decision.id ?: return)
    }

    private fun openReview(decision: Decision) {
        (activity as? MainActivity)?.openReview(decision.id ?: return)
    }
}
