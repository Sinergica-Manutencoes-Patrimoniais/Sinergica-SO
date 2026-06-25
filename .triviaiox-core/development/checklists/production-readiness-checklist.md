# Production Readiness Checklist

```yaml
checklist:
  id: production-readiness
  version: 1.0.0
  created: 2026-05-08
  updated: 2026-05-08
  purpose: "Validate that a service or feature is ready for production load. Run before first launch and before significant capacity events."
  mode: advisory  # Blocking items must pass; advisory items are team judgment
  reference: "Google SRE Book Production Readiness Review (PRR), DORA research"
  owner: Rex (Sentinel / @reliability)
```

---

## Section 1 — Observability

```yaml
observability:
  - id: slo-defined
    check: "SLO documented at docs/slo/{service_id}.md with SLI, target, and window"
    type: blocking
    validation: "File exists and has SLI definition + numeric target"

  - id: traces-instrumented
    check: "Entry point, database, and external API calls have OTel spans"
    type: blocking
    validation: "Test trace in backend with ≥ 3 span types"

  - id: metrics-red-use
    check: "RED metrics for request-driven services OR USE metrics for resources"
    type: blocking
    validation: "rate, error_rate, duration metrics queryable in backend"

  - id: logs-structured
    check: "Logs are structured JSON with trace_id, service, level, message"
    type: blocking
    validation: "Sample log line parseable as JSON with required fields"

  - id: error-budget-alert
    check: "Burn-rate alert rules active in monitoring backend"
    type: blocking
    validation: "Fast-burn (1h) and slow-burn (6h) alerts exist"

  - id: dashboard-exists
    check: "Service dashboard shows SLI, error rate, latency (p50/p95/p99)"
    type: advisory
```

---

## Section 2 — Reliability Architecture

```yaml
reliability_architecture:
  - id: circuit-breaker
    check: "Outbound calls to unreliable dependencies have circuit breaker or retry with backoff"
    type: blocking
    validation: "Code review or integration test demonstrates graceful degradation"

  - id: timeout-all-calls
    check: "All outbound calls (HTTP, DB, LLM, queue) have explicit timeout"
    type: blocking
    validation: "Grep for timeout configuration in each client initialization"

  - id: graceful-shutdown
    check: "Service handles SIGTERM gracefully: drains in-flight, closes connections"
    type: blocking
    validation: "Kill -SIGTERM test shows in-flight requests complete before exit"

  - id: health-endpoints
    check: "Liveness and readiness probes respond correctly"
    type: blocking
    validation: "GET /health and /ready return 200 with correct body"

  - id: dependency-degradation
    check: "Service degrades gracefully when non-critical dependency is unavailable"
    type: advisory
    validation: "Chaos experiment or integration test with dependency mocked offline"
```

---

## Section 3 — Capacity Planning

```yaml
capacity:
  - id: load-profile-documented
    check: "Expected requests/sec, concurrent users, and data volume at launch documented"
    type: blocking
    validation: "docs/slo/{service_id}.md includes capacity section"

  - id: resource-limits-set
    check: "CPU and memory limits configured (not just requests)"
    type: blocking
    validation: "Deployment config shows both resource.requests and resource.limits"

  - id: database-connection-pool
    check: "DB connection pool sized correctly for expected concurrency"
    type: blocking
    validation: "Pool max < (DB max_connections / replicas) with headroom"

  - id: load-test-run
    check: "Load test at 2x expected peak traffic shows no degradation"
    type: advisory
    validation: "Load test results attached to PRR doc"

  - id: cost-estimate
    check: "Monthly cost estimate at expected load documented"
    type: advisory
    validation: "Estimate includes compute, DB, LLM tokens, external APIs"
```

---

## Section 4 — Incident Readiness

```yaml
incident_readiness:
  - id: runbooks-exist
    check: "Runbooks exist for top 3 failure modes"
    type: blocking
    validation: "ops/runbooks/{service_id}/ has ≥ 3 files"

  - id: on-call-rotation
    check: "On-call rotation defined with at least 2 engineers"
    type: blocking
    validation: "On-call schedule exists in ops/oncall/"

  - id: escalation-path
    check: "Escalation contacts documented with SLA expectations"
    type: blocking
    validation: "Incident runbooks include escalation section"

  - id: rollback-plan
    check: "Deploy rollback procedure documented and tested"
    type: blocking
    validation: "Rollback tested in staging within 30 days"

  - id: game-day-run
    check: "At least one chaos experiment or game day completed"
    type: advisory
    validation: "ops/chaos/ has at least one experiment for this service"
```

---

## Section 5 — Security & Compliance

```yaml
security:
  - id: secrets-not-in-code
    check: "No credentials, API keys, or PII in source code or logs"
    type: blocking
    validation: "Secret scanning clean + log review shows no PII"

  - id: authentication-required
    check: "All user-facing endpoints require authentication"
    type: blocking
    validation: "Integration test confirms 401 on unauthenticated request"

  - id: rate-limiting
    check: "Rate limiting configured for public and authenticated endpoints"
    type: blocking
    validation: "429 returned after limit exceeded in integration test"

  - id: data-retention
    check: "Data retention policy documented and enforced for all PII tables"
    type: advisory
    validation: "docs/compliance/ has retention schedule"
```

---

## Scoring

```yaml
scoring:
  method: count-blocking-failures
  thresholds:
    PASS: 0 blocking failures
    CONCERNS: 1-2 blocking failures (proceed with documented plan to fix within 1 sprint)
    FAIL: 3+ blocking failures (do not launch until resolved)
  advisory_items: Record open advisory items as technical debt stories
```
