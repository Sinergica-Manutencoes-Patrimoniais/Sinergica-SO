# Runbook: {Failure Mode Title}

```yaml
runbook:
  service: "{service_id}"
  failure_mode: "{one-line symptom}"
  default_severity: SEV{1|2|3}
  alert_name: "{exact alert name that triggers this runbook}"
  owner: "{team or engineer}"
  last_tested: "{YYYY-MM-DD}"
  last_updated: "{YYYY-MM-DD}"
  related_runbooks:
    - "{path/to/adjacent-runbook.md}"
```

---

## Symptom

What the on-call sees that brings them here:

- **Alert:** `{exact alert text}`
- **Dashboard:** [{service} dashboard]({url})
- **User report pattern:** {what users say, if applicable}

If this alert fires with `{other alert}` simultaneously, check `{other-runbook.md}` first.

---

## Severity Guidance

| Condition | Severity |
|-----------|----------|
| {users unable to X entirely} | SEV1 — page and declare |
| {users experiencing degraded X} | SEV2 — investigate |
| {internal only, no user impact} | SEV3 — ticket |

---

## Detect — Confirm This Is Real

Run these queries to confirm the failure mode (not adjacent):

```
# Confirm error rate is elevated, not just noisy
{query or command}
# Expected output: {what you should see}

# Confirm it's not a monitoring artifact
{query or command}
# Expected output: {what you should see}
```

If queries show normal values → this is likely a false positive. Check `{alert tuning guide}`.

---

## Diagnose — Find the Cause

Work through these in order. Stop when you find the cause.

### 1. {First most likely cause}

```bash
# Check {thing}
{command}
# Look for: {symptom of this cause}
```

→ If you see {indicator}: this is cause 1. Go to **Mitigate → Option A**.

### 2. {Second most likely cause}

```bash
# Check {thing}
{command}
# Look for: {symptom of this cause}
```

→ If you see {indicator}: this is cause 2. Go to **Mitigate → Option B**.

### 3. Unknown cause

If neither above applies: escalate to `{technical lead}` with:

- Current error rate
- Last deploy time and author
- Queries run and their outputs

---

## Mitigate — Stop the Bleeding

**Mitigate before root cause is confirmed.**

### Option A — Rollback last deploy

```bash
{rollback command}
# Wait 2-3 minutes, then verify with:
{verification query}
```

### Option B — Disable feature flag

```bash
{feature flag disable command}
# Verify: {check command}
```

### Option C — Scale up resource

```bash
{scale command}
# Monitor: {metric to watch}
```

---

## Resolve — Full Fix

After mitigation is confirmed (user impact gone):

1. {Root cause fix step 1}
2. {Root cause fix step 2}
3. Redeploy via @devops with `{command}`

---

## Verify — Confirm Recovery

```bash
# Confirm SLI back to normal
{query}
# Expected: {normal range}
```

Wait {N} minutes for metrics to stabilize. If SLI does not recover within {N} minutes after fix: re-escalate.

---

## Escalate

If you cannot mitigate within **{N minutes}** or are unsure:

| Who | Contact | When |
|-----|---------|------|
| {technical lead} | {contact method} | Any time for SEV1/SEV2 |
| {product owner} | {contact method} | SEV1 with customer impact |
| {previous on-call} | {contact method} | During handoff overlap |

When escalating, share:

1. Incident record link
2. Severity
3. What you tried and the outcome
4. Current error rate

---

## Postmortem Trigger

A blameless postmortem is required if:

- SEV1 regardless of duration
- SEV2 with confirmed customer impact

Create postmortem within 5 business days using `*postmortem-blameless`.

---

*Authored by: {author} | Tested by: {tester} | Template: TRIVIAIOX runbook-template.md v1.0*
