package com.modi.decisionjournal.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Spinner
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.recyclerview.widget.LinearLayoutManager
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

    private val statusValues = listOf("all", "open", "reviewed")

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

        binding.statusSpinner.adapter = ArrayAdapter(
            requireContext(),
            android.R.layout.simple_spinner_dropdown_item,
            listOf(
                getString(R.string.all_statuses),
                getString(R.string.open),
                getString(R.string.reviewed),
            ),
        )

        binding.insightsButton.setOnClickListener {
            (activity as? MainActivity)?.openInsights()
        }
        binding.settingsButton.setOnClickListener {
            (activity as? MainActivity)?.openSettings()
        }
        binding.newDecisionFab.setOnClickListener {
            (activity as? MainActivity)?.openNewDecision()
        }

        binding.statusSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) = render()
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }

        viewModel.decisions.observe(viewLifecycleOwner) { decisions ->
            allDecisions = decisions
            refreshTagSpinner(decisions)
            render()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun refreshTagSpinner(decisions: List<Decision>) {
        val tags = (DecisionStates.SUGGESTED_TAGS + decisions.flatMap { it.tags }).distinct().sorted()
        if (tags == tagItems) return

        tagItems = tags
        val labels = listOf(getString(R.string.all_tags)) + tags
        binding.tagSpinner.adapter = ArrayAdapter(
            requireContext(),
            android.R.layout.simple_spinner_dropdown_item,
            labels,
        )
        val selectedIndex = selectedTag?.let { labels.indexOf(it) } ?: 0
        binding.tagSpinner.setSelection(selectedIndex.coerceAtLeast(0), false)

        binding.tagSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                selectedTag = if (position == 0) null else tags[position - 1]
                render()
            }

            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
    }

    private fun render() {
        val status = statusValues[binding.statusSpinner.selectedItemPosition.coerceIn(0, 2)]
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
