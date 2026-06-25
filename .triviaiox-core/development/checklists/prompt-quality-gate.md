# Prompt Quality Gate Checklist

```yaml
checklist:
  id: prompt-quality-gate
  version: 1.0.0
  created: 2026-05-08
  updated: 2026-05-08
  purpose: "Gate checks before a prompt change ships to production. Run after regression test passes."
  mode: blocking
  owner: Pria (Alchemist / @prompt-engineer)
  reference: "Anthropic Prompt Engineering Guide, OWASP LLM Top 10"
```

---

## Section 1 — Behavioral Specification

```yaml
behavioral_spec:
  - id: task-defined
    check: "Prompt card documents: task in one sentence, 2 success examples, 3 failure modes, out-of-scope items, constraints"
    type: blocking
    validation: "All 5 behavioral spec fields populated in prompt card"

  - id: output-schema-defined
    check: "Output format is explicitly defined (JSON schema, example, or structured prose)"
    type: blocking
    validation: "Output section in prompt card is non-empty with example"

  - id: token-budget-set
    check: "Max input and output token budget documented and within cost model"
    type: blocking
    validation: "prompt card.token_budget.input_max and output_max set"
```

---

## Section 2 — Eval Coverage

```yaml
eval_coverage:
  - id: eval-set-size
    check: "Eval set has ≥ 20 cases"
    type: blocking
    validation: "JSONL file has ≥ 20 lines"

  - id: eval-categories-covered
    check: "Eval set includes: typical, edge case, borderline, adversarial categories"
    type: blocking
    validation: "At least 2 cases per category"

  - id: grader-defined
    check: "Grader configuration exists and is executable"
    type: blocking
    validation: "grader.yaml parseable and grader_type set"

  - id: baseline-exists
    check: "Baseline results exist for regression comparison"
    type: blocking
    validation: "baseline.json has pass_rates and latency_p95 recorded"
```

---

## Section 3 — Regression Test

```yaml
regression:
  - id: pass-rate-no-regression
    check: "Primary pass rate delta ≥ -5% vs baseline"
    type: blocking
    validation: "regression_report.primary_metric.delta >= -0.05"

  - id: latency-no-regression
    check: "p95 latency delta ≤ +20% vs baseline"
    type: blocking
    validation: "regression_report.latency_p95.delta <= +0.20"

  - id: cost-no-regression
    check: "Cost per call delta ≤ +10% vs baseline"
    type: blocking
    validation: "regression_report.cost_per_call.delta <= +0.10"
```

---

## Section 4 — Injection Safety

```yaml
injection_safety:
  - id: injection-audit-run
    check: "Prompt injection audit completed using prompt-injection-defense.md"
    type: blocking
    validation: "injection-audit.md exists for this prompt version"

  - id: no-successful-overrides
    check: "Zero successful instruction overrides in injection test battery"
    type: blocking
    validation: "audit_report.successful_overrides == 0"

  - id: pii-not-in-output
    check: "Prompt does not leak PII from untrusted input into output"
    type: blocking
    validation: "PII test cases in eval set pass"
```

---

## Section 5 — Versioning

```yaml
versioning:
  - id: semantic-version-bumped
    check: "Prompt version bumped correctly (MAJOR/MINOR/PATCH per versioning rules)"
    type: blocking
    validation: "Prompt card version > previous version"

  - id: changelog-entry
    check: "Changelog entry added with date, author, change description, regression result"
    type: blocking
    validation: "prompt card changelog has entry for this version"

  - id: prompt-card-complete
    check: "All required sections of prompt card are populated"
    type: blocking
    validation: "No empty required sections or unfilled {{placeholders}}"
```

---

## Scoring

```yaml
scoring:
  method: count-blocking-failures
  thresholds:
    PASS: 0 blocking failures
    CONCERNS: 1 advisory failure (document and ship)
    FAIL: 1+ blocking failures (do not ship)
```
