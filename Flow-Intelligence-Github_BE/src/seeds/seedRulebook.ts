import { FlowRule } from "../models/FlowRule.js";
import { Recommendation } from "../models/Recommendation.js";

/**
 * Seeds the Flow Risk Rulebook (R1–R5) and their safe recommendations.
 * Idempotent — runs upsert so it can be called multiple times safely.
 */
export async function seedRulebook(): Promise<void> {
  // ── Flow Rules R1–R5 ────────────────────────────────────────────────────
  const rules = [
    {
      ruleCode: "R1",
      name: "Stale PR Risk",
      description: "A pull request has been open for more than 5 days without being merged or closed.",
      metricKey: "stale_pr_count",
      threshold: 3,
      thresholdUnit: "count",
      operator: "gte",
      severity: "high",
      evidenceType: "stale_pr",
    },
    {
      ruleCode: "R2",
      name: "Review Pickup Risk",
      description: "The average time from PR opening to first review exceeds 12 hours.",
      metricKey: "review_pickup_time_avg_hours",
      threshold: 12,
      thresholdUnit: "hours",
      operator: "gte",
      severity: "medium",
      evidenceType: "review_pickup",
    },
    {
      ruleCode: "R3",
      name: "Reviewer Concentration Risk",
      description: "More than 50% of reviews are performed by a single reviewer.",
      metricKey: "review_load_top_reviewer_pct",
      threshold: 50,
      thresholdUnit: "pct",
      operator: "gte",
      severity: "medium",
      evidenceType: "reviewer_concentration",
    },
    {
      ruleCode: "R4",
      name: "CI Friction Risk",
      description: "More than 25% of CI check runs in the analysis window failed.",
      metricKey: "failed_check_rate_pct",
      threshold: 25,
      thresholdUnit: "pct",
      operator: "gte",
      severity: "high",
      evidenceType: "ci_friction",
    },
    {
      ruleCode: "R5",
      name: "Oversized PR Risk",
      description: "More than 2 pull requests exceeded 500 lines of changes in the analysis window.",
      metricKey: "oversized_pr_count",
      threshold: 2,
      thresholdUnit: "count",
      operator: "gte",
      severity: "medium",
      evidenceType: "oversized_pr",
    },
  ] as const;

  for (const rule of rules) {
    await FlowRule.findOneAndUpdate(
      { ruleCode: rule.ruleCode },
      { $set: rule },
      { upsert: true, new: true }
    );
  }

  // ── Recommendations per rule ─────────────────────────────────────────────
  const recommendations = [
    // R1 – Stale PR
    {
      ruleCode: "R1",
      actionCode: "close_or_merge_stale_prs",
      title: "Review and action stale pull requests",
      description: "Schedule a team session to review open PRs older than 5 days. Merge, close, or convert to draft as appropriate.",
      category: "process",
    },
    {
      ruleCode: "R1",
      actionCode: "add_pr_age_dashboard",
      title: "Add PR age visibility to team workflow",
      description: "Make PR age visible in daily standups or add a PR aging label to surface stale work earlier.",
      category: "visibility",
    },
    // R2 – Review Pickup
    {
      ruleCode: "R2",
      actionCode: "define_review_sla",
      title: "Define a team review SLA",
      description: "Agree on a review pickup target (e.g. first review within 4 hours) and communicate it to the team.",
      category: "process",
    },
    {
      ruleCode: "R2",
      actionCode: "assign_backup_reviewer",
      title: "Assign backup reviewers for availability gaps",
      description: "When the primary reviewer is unavailable, route review requests to a designated backup to reduce wait time.",
      category: "communication",
    },
    // R3 – Reviewer Concentration
    {
      ruleCode: "R3",
      actionCode: "distribute_review_ownership",
      title: "Distribute review ownership across the team",
      description: "Rotate reviewer assignments to at least 3 active team members. This reduces bus factor risk without evaluating individual performance.",
      category: "process",
    },
    {
      ruleCode: "R3",
      actionCode: "enable_codeowners",
      title: "Enable CODEOWNERS for automatic routing",
      description: "Use GitHub CODEOWNERS to route review requests based on code area, reducing reliance on manual assignment.",
      category: "tooling",
    },
    // R4 – CI Friction
    {
      ruleCode: "R4",
      actionCode: "investigate_failing_checks",
      title: "Investigate the most frequently failing check suites",
      description: "Review the check suite failure breakdown and prioritize fixing the highest-fail-rate suite. Focus on environmental or flaky test causes.",
      category: "tooling",
    },
    {
      ruleCode: "R4",
      actionCode: "add_ci_failure_triage",
      title: "Add CI failure triage to the team workflow",
      description: "Include a standing CI health review in weekly team meetings to catch recurring failures early.",
      category: "visibility",
    },
    // R5 – Oversized PR
    {
      ruleCode: "R5",
      actionCode: "split_large_prs",
      title: "Break large changes into smaller pull requests",
      description: "Guide contributors to split PRs over 500 lines into smaller, focused units. Smaller PRs receive faster reviews and are easier to reason about.",
      category: "process",
    },
    {
      ruleCode: "R5",
      actionCode: "add_pr_size_check",
      title: "Add a PR size check to CI",
      description: "Add a GitHub Action or bot that warns when a PR exceeds the team's size threshold, prompting the author to split before review.",
      category: "tooling",
    },
  ] as const;

  for (const rec of recommendations) {
    await Recommendation.findOneAndUpdate(
      { ruleCode: rec.ruleCode, actionCode: rec.actionCode },
      { $set: rec },
      { upsert: true, new: true }
    );
  }

  console.log("[Seed] Rulebook R1–R5 and recommendations seeded successfully");
}
