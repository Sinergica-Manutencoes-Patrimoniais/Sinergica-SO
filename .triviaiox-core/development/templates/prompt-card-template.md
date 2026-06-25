# Prompt Card: {Prompt Name}

```yaml
prompt:
  id: "{slug}"
  name: "{Human-readable name}"
  version: "1.0.0"
  status: draft | active | deprecated
  model_family: "{claude-haiku | claude-sonnet | claude-opus | gpt-4o | gemini-flash | ...}"
  owner: "@{agent-or-team}"
  created: "{YYYY-MM-DD}"
  updated: "{YYYY-MM-DD}"
  tags: ["{domain}", "{task-type}"]
```

---

## Behavioral Specification

**Task (one sentence, imperative):**
> {What this prompt does}

**Success looks like:**
1. {Example of a perfect output for a typical input}
2. {Example of a perfect output for an edge case}

**Common failure modes:**
1. {How this can go wrong — #1}
2. {How this can go wrong — #2}
3. {How this can go wrong — #3}

**Out of scope (what this prompt should NOT do):**
- {Item 1}
- {Item 2}

**Constraints:**
- Tone: {formal | casual | neutral}
- Max output tokens: {N}
- Language: {language(s)}
- Safety: {what to refuse or avoid}

---

## Input Variables

| Variable | Type | Required | Description |
|---|---|---|---|
| `{variable}` | string | Yes | {what it contains} |
| `{variable}` | object | No | {what it contains, default: N/A} |

---

## Prompt Template

```
{SYSTEM PROMPT}
---
{Paste full system prompt here}
{Use {{variable_name}} markers for injected variables}
{Use <xml_tags> to isolate untrusted inputs}
---

{USER TEMPLATE}
---
{Paste user message template here}
---
```

---

## Output Schema

```json
{
  "type": "object",
  "required": ["{field1}", "{field2}"],
  "additionalProperties": false,
  "properties": {
    "{field1}": {
      "type": "string",
      "description": "{what this field means}"
    }
  }
}
```

---

## Few-Shot Examples

*(Include only if architecture = few-shot. 2–6 examples recommended.)*

### Example 1 — {label}

**Input:**
```json
{
  "{variable}": "{value}"
}
```

**Output:**
```json
{
  "{field1}": "{expected value}"
}
```

---

## Token Budget

| Dimension | Value |
|---|---|
| Avg input tokens | {N} |
| Max input tokens | {N} |
| Avg output tokens | {N} |
| Max output tokens | {N} |
| Estimated cost per call | ${N} at {model} pricing |

---

## Eval Baseline

*(Fill after running prompt-eval-harness.md)*

| Metric | Value | Date |
|---|---|---|
| Pass rate | {N}% | {YYYY-MM-DD} |
| p50 latency | {N}ms | {YYYY-MM-DD} |
| p95 latency | {N}ms | {YYYY-MM-DD} |
| Cost per call | ${N} | {YYYY-MM-DD} |

Eval set: `docs/prompts/evals/{slug}-eval.jsonl` ({N} cases)
Grader: `docs/prompts/evals/{slug}-grader.yaml`

---

## Security

Injection audit: `docs/prompts/security/{slug}-injection-audit.md`
Last audited: {YYYY-MM-DD}
Result: {PASS / FAIL}

Untrusted input fields: `[{variable names that receive external input}]`
Isolation strategy: {XML tagging | input sanitization | schema enforcement}

---

## Changelog

| Version | Date | Author | Change | Regression |
|---|---|---|---|---|
| 1.0.0 | {YYYY-MM-DD} | @{agent} | Initial version | Baseline |

---

*Template: TRIVIAIOX prompt-card-template.md v1.0 | Author: @prompt-engineer*
