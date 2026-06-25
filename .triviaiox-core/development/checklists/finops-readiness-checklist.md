# FinOps Readiness Checklist

```yaml
checklist:
  id: finops-readiness
  version: 1.0.0
  created: 2026-05-08
  updated: 2026-05-08
  purpose: "Validate that a service is ready for cost-intelligent operations. Run before first production launch of any LLM-driven or API-intensive service."
  mode: advisory
  owner: Atlas (Decoder / @analyst)
  reference: "FinOps Foundation Framework (Inform/Optimize/Operate), AWS/GCP cost tagging best practices"
```

---

## Section 1 — Instrumentation (Inform)

```yaml
instrumentation:
  - id: cost-schema-documented
    check: "Cost tracking schema documented at docs/finops/{service_id}-cost-schema.md"
    type: blocking
    validation: "File exists with cost_sources, attribution_schema, and database_schema sections"

  - id: cost-events-captured
    check: "Cost events captured per call for all external API sources (LLM, scraper, image gen, etc.)"
    type: blocking
    validation: "cost_events table populated after test run with non-zero cost_usd values"

  - id: rollup-views-exist
    check: "v_cost_per_story and v_daily_cost views exist and queryable"
    type: blocking
    validation: "SELECT from both views returns results without error"

  - id: cost-per-run-baseline
    check: "Baseline cost-per-run (p50 and p95) documented"
    type: blocking
    validation: "docs/finops/ has baseline file with p50, p95, and date"
```

---

## Section 2 — Budget & Alerts (Operate)

```yaml
budget_alerts:
  - id: monthly-budget-set
    check: "Monthly budget defined at ops/finops/{service_id}-budget.yaml"
    type: blocking
    validation: "File exists with monthly_budget_usd > 0"

  - id: alert-thresholds-configured
    check: "Alerts configured for 50%, 80%, 100%, 120% of monthly budget"
    type: blocking
    validation: "All 4 thresholds present in budget config with non-empty action"

  - id: alert-channel-tested
    check: "Alert channel tested with sample message"
    type: advisory
    validation: "Test alert received in configured channel"

  - id: runbook-for-breach
    check: "Runbook documented for budget breach response"
    type: advisory
    validation: "Breach runbook references cost-anomaly-detect and cost-per-task-report tasks"
```

---

## Section 3 — Optimization Readiness (Optimize)

```yaml
optimization:
  - id: model-routing-documented
    check: "Model routing strategy documented at docs/prompts/model-routing.md"
    type: advisory
    validation: "File exists with tier assignments for all LLM tasks"

  - id: prompt-caching-evaluated
    check: "Prompt caching evaluated for system prompts > 1024 tokens"
    type: advisory
    validation: "model-routing.md includes caching section with eligible prompts"

  - id: batch-processing-evaluated
    check: "Batch API evaluated for non-real-time LLM tasks"
    type: advisory
    validation: "model-routing.md includes batch eligibility assessment"

  - id: cost-anomaly-schedule
    check: "Cost anomaly detection scheduled to run at least daily"
    type: blocking
    validation: "Scheduled job or cron exists for cost-anomaly-detect task"
```

---

## Section 4 — Governance

```yaml
governance:
  - id: cost-owner-assigned
    check: "Atlas (@analyst) designated as cost intelligence owner for service"
    type: advisory

  - id: monthly-review-scheduled
    check: "Monthly cost review scheduled"
    type: advisory
    validation: "Calendar recurring event or sprint ritual exists"

  - id: cost-reported-in-retrospective
    check: "Cost metrics included in sprint retrospective or weekly reporting"
    type: advisory
```

---

## Scoring

```yaml
scoring:
  method: count-blocking-failures
  thresholds:
    PASS: 0 blocking failures
    CONCERNS: 1-2 blocking failures (launch with documented plan to fix within 2 weeks)
    FAIL: 3+ blocking failures
```
