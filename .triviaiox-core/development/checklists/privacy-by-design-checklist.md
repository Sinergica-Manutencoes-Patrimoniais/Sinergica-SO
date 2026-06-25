# Privacy by Design Checklist

```yaml
checklist:
  id: privacy-by-design
  version: 1.0.0
  created: 2026-05-08
  updated: 2026-05-08
  purpose: "Validate that a story implements Privacy by Design principles before development starts. Gate for all stories that process personal data."
  mode: blocking
  owner: Pax (Balancer / @po)
  reference: "Cavoukian's 7 Foundational Principles of Privacy by Design, GDPR Article 25, ISO 27701"
  note: "Run data-classification.md first. If privacy_gate_required=false, this checklist is N/A."
```

---

## Applicability

```yaml
applicability:
  - id: pbd-applicable
    check: "data-classification.md shows privacy_gate_required = true"
    type: blocking
    note: "If privacy_gate_required = false: mark checklist as N/A and proceed"
```

---

## Principle 1 — Proactive, Not Reactive

```yaml
principle_1_proactive:
  - id: pia-completed
    check: "Privacy Impact Assessment (PIA/DPIA) completed before development starts"
    type: blocking
    validation: "docs/stories/{story_id}/privacy/pia.md exists with decision = APPROVED"

  - id: no-high-unmitigated-risks
    check: "PIA has no HIGH-severity unmitigated privacy risks"
    type: blocking
    validation: "PIA risk table has no HIGH rows without mitigation"
```

---

## Principle 2 — Privacy as Default

```yaml
principle_2_default:
  - id: data-minimization
    check: "Only data necessary for the feature purpose is collected"
    type: blocking
    validation: "Each data item in classification has 'necessary = yes' documented"

  - id: opt-in-not-opt-out
    check: "Any data collection beyond core function requires explicit opt-in"
    type: blocking
    validation: "Consent design documented or N/A rationale given"

  - id: no-unnecessary-data-fields
    check: "Database schema does not include fields not required for stated purpose"
    type: advisory
```

---

## Principle 3 — Privacy Embedded into Design

```yaml
principle_3_embedded:
  - id: pii-not-in-logs-plaintext
    check: "PII not present in application logs in plaintext"
    type: blocking
    validation: "Code review confirms PII masked or absent in log statements"

  - id: pii-encrypted-at-rest
    check: "Sensitive personal data encrypted at rest"
    type: blocking
    condition: "any Confidential-Sensitive data in classification"
    validation: "Database column encryption or field-level encryption implemented"

  - id: pii-encrypted-in-transit
    check: "All personal data transmitted over TLS/HTTPS"
    type: blocking
    validation: "No HTTP endpoints for PII transmission"
```

---

## Principle 4 — Full Lifecycle Protection

```yaml
principle_4_lifecycle:
  - id: retention-policy-defined
    check: "Retention policy defined for all personal data"
    type: blocking
    validation: "data-retention-policy.md exists with periods and deletion methods"

  - id: deletion-implementation-planned
    check: "Automated deletion or anonymization story created in backlog"
    type: advisory
    validation: "Backlog has story for retention automation"

  - id: deletion-on-user-request
    check: "Process exists for user data deletion on request"
    type: blocking
    validation: "Consent design or PIA documents deletion request handling"
```

---

## Principle 5 — End-to-End Security

```yaml
principle_5_security:
  - id: access-control
    check: "Personal data access restricted to roles with need-to-know"
    type: blocking
    validation: "RLS policies or access control configured on tables with PII"

  - id: audit-trail
    check: "Access to personal data logged for audit"
    type: advisory
    validation: "Access log exists for sensitive data tables"
```

---

## Principle 6 — Visibility and Transparency

```yaml
principle_6_transparency:
  - id: legal-basis-documented
    check: "Legal basis for each data processing activity documented in PIA"
    type: blocking
    validation: "PIA Section 1 has legal basis for all data items"

  - id: third-party-dpa
    check: "DPA (Data Processing Agreement) exists for each third-party processor"
    type: blocking
    condition: "any third-party processor in classification"
    validation: "PIA Section 5 has DPA status = Signed for all processors"
```

---

## Principle 7 — Respect for User Privacy

```yaml
principle_7_user_rights:
  - id: opt-out-mechanism
    check: "Opt-out mechanism designed and implemented"
    type: blocking
    validation: "Consent design documents opt-out flow and blocklist"

  - id: user-rights-process
    check: "Process documented for: access, correction, deletion, portability"
    type: blocking
    validation: "PIA Section 4 has all rights covered"

  - id: opt-out-permanent
    check: "Opt-out is permanent — re-opt-in requires explicit new action by user"
    type: blocking
    validation: "Blocklist table exists and is checked before every outbound message"
```

---

## Scoring

```yaml
scoring:
  method: count-blocking-failures
  thresholds:
    PASS: 0 blocking failures
    CONCERNS: advisory failures only — document and proceed
    FAIL: 1+ blocking failures — story cannot move to em-progresso
  note: "Privacy gate FAIL means story is blocked until all blocking items resolved"
```
