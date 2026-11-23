package com.modi.decisionjournal.ui

import android.annotation.SuppressLint
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.color.MaterialColors
import com.modi.decisionjournal.R
import com.modi.decisionjournal.data.Decision
import com.modi.decisionjournal.databinding.ItemDecisionBinding

class DecisionAdapter(
    private val onOpen: (Decision) -> Unit,
    private val onReview: (Decision) -> Unit,
    private val onPostpone: (Decision) -> Unit,
) : RecyclerView.Adapter<DecisionAdapter.Holder>() {

    private var items: List<Decision> = emptyList()

    @SuppressLint("NotifyDataSetChanged")
    fun submit(newItems: List<Decision>) {
        items = newItems
        notifyDataSetChanged()
    }

    inner class Holder(val binding: ItemDecisionBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val binding = ItemDecisionBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false,
        )
        return Holder(binding)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val decision = items[position]
        val binding = holder.binding
        val context = binding.root.context

        binding.decisionTitle.text = decision.title
        binding.confidenceText.text = context.getString(R.string.confidence_value, decision.confidence)
        binding.predictionText.text = context.getString(R.string.quoted, decision.prediction)

        when {
            decision.isReviewed -> {
                binding.statusText.setText(R.string.reviewed)
                binding.reviewDateText.text = context.getString(
                    R.string.reviewed_date,
                    ReviewDates.formatTimestamp(decision.review?.reviewedAt),
                )
            }
            decision.isDue -> {
                binding.statusText.setText(R.string.due)
                binding.reviewDateText.text = context.getString(
                    R.string.review_date_value,
                    ReviewDates.formatTimestamp(decision.reviewDate),
                )
            }
            else -> {
                binding.statusText.setText(R.string.open)
                binding.reviewDateText.text = context.getString(
                    R.string.review_date_value,
                    ReviewDates.formatTimestamp(decision.reviewDate),
                )
            }
        }

        binding.postponedText.isVisible = decision.wasPostponed
        binding.cardActions.isVisible = decision.isDue
        binding.postponeButton.isVisible = decision.isDue && !decision.wasPostponed

        val statusColor = when {
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
        }
        binding.statusText.setTextColor(statusColor)

        binding.root.setOnClickListener { onOpen(decision) }
        binding.reviewButton.setOnClickListener { onReview(decision) }
        binding.postponeButton.setOnClickListener { onPostpone(decision) }
    }
}
