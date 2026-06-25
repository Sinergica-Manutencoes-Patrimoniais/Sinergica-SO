# Data Retention Policy Task

Define or validate a data retention policy for personal data introduced by a story.

**Reference:** Privacy by Design Principle 4 (End-to-End Security — Full Lifecycle), GDPR Article 5(1)(e) (Storage Limitation), ISO 27701.

---

## Task Definition

```yaml
task: dataRetentionPolicy()
responsavel: Pax (Balancer)
responsavel_type: Agente
atomic_layer: Atom

Entrada:
  - campo: story_id
    tipo: string
    obrigatorio: true

  - campo: data_classification_path
    tipo: file_path
    obrigatorio: true

Saida:
  - campo: retention_policy
    tipo: file
    destino: docs/compliance/retention-policy.md (appended)
    persistido: true
```

---

## Retention Policy Framework

For each personal data type, define:

| Data Type | Retention Period | Trigger | Deletion Method | Legal Basis Reference |
|---|---|---|---|---|
| User contact data | 180 days after last interaction | Last activity timestamp | Hard delete or anonymize | Legitimate interest |
| Transaction/financial data | 5 years | Transaction date | Archive then delete | Legal obligation |
| Access logs | 90 days | Log creation | Automatic purge | Security policy |
| LLM prompt inputs with PII | 30 days | Call timestamp | Purge from logs | Minimization principle |
| Exported/generated content with PII | 7 days | Generation date | Auto-delete | Minimization principle |

## Standard Retention Defaults

Reference defaults when no specific requirement exists:

| Category | Default Retention |
|---|---|
| Personal contact data (outreach) | 180 days without positive engagement |
| Session and auth logs | 90 days |
| Financial records | 5-7 years (check local regulation) |
| Support tickets | 2 years after closure |
| Marketing consent records | Duration of consent + 2 years evidence |
| LLM inputs (no PII) | No special requirement |
| LLM inputs (with PII) | 30 days maximum |

## Automation Requirements

For each data type with a defined retention period, create a story for:

1. A scheduled job (daily/weekly) that identifies records past retention period
2. A delete or anonymize operation
3. An audit log of what was deleted (without PII — just count/timestamp)

## Post-Conditions

```yaml
post-conditions:
  - [ ] Retention period defined for all Confidential data items
    blocker: true
  - [ ] Deletion/anonymization method specified
    blocker: true
  - [ ] Automation story created in backlog if not already implemented
    blocker: false
```
