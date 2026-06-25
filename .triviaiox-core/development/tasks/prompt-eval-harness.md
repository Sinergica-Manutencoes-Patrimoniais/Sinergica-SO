# Prompt Eval Harness Task

Build an eval set and grader to measure prompt quality objectively.

**Reference:** OpenAI Evals cookbook, Braintrust docs, "Evaluating Large Language Models" (Guo et al.).

---

## Task Definition

```yaml
task: promptEvalHarness()
responsavel: Pria (Alchemist)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: prompt_card_path
    tipo: file_path
    obrigatorio: true

  - campo: sample_inputs
    tipo: array
    obrigatorio: true
    validacao: Minimum 5 representative inputs; 20 recommended

Saida:
  - campo: eval_set
    tipo: file
    destino: docs/prompts/evals/{slug}-eval.jsonl
    persistido: true

  - campo: grader_config
    tipo: file
    destino: docs/prompts/evals/{slug}-grader.yaml
    persistido: true

  - campo: baseline_results
    tipo: file
    destino: docs/prompts/evals/{slug}-baseline.json
    persistido: true
```

---

## Execution Steps

### Step 1 — Categorize cases

For a minimum viable eval (20 cases), distribute:

| Category | Count | Rationale |
|---|---|---|
| Typical / happy path | 8 | Core functionality |
| Edge case | 6 | Boundary inputs |
| Borderline / ambiguous | 4 | Where the spec is unclear |
| Adversarial / tricky | 2 | Known failure modes |

### Step 2 — Define the grader

Choose grader type based on output:

**Exact match** (best for classification, extraction, routing):

```yaml
grader:
  type: exact_match
  field: output.{field}
  expected: {value}
  case_sensitive: false
```

**LLM judge** (for open-ended generation):

```yaml
grader:
  type: llm_judge
  judge_model: claude-sonnet-latest
  judge_prompt: |
    Given the task: {task_description}
    Rate this output on a scale of 1-5 where 5 is perfect:
    Output: {output}
    Respond with only a JSON: {"score": N, "reason": "..."}
  pass_threshold: 4  # ≥ 4 = pass
```

**Multi-dimension** (for complex outputs):

Define separate graders per dimension:

- `correctness` — did it answer correctly?
- `format` — is it the right structure?
- `safety` — any harmful/inappropriate content?
- `completeness` — are all required fields present?

### Step 3 — Build eval set

Each eval case in JSONL format:

```json
{
  "case_id": "case-001",
  "category": "typical",
  "input": {"variable1": "...", "variable2": "..."},
  "expected": "...",
  "notes": "What this case tests"
}
```

### Step 4 — Run baseline

Execute all eval cases against the current prompt. Record:

- Pass rate per dimension
- P50/P95/P99 latency
- Token usage (input + output)
- Estimated cost per call

Store in `{slug}-baseline.json`. This is the reference for all future regressions.

### Step 5 — Identify weak spots

Cases that fail the grader are the most valuable:

- Analyze failure patterns
- Group by failure type
- If ≥ 30% fail a dimension: prompt needs redesign, not iteration

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Eval set has ≥ 20 cases covering all 4 categories
    blocker: true
  - [ ] Grader defined and executable
    blocker: true
  - [ ] Baseline results recorded
    blocker: true
  - [ ] Weak spots identified and noted in prompt card
    blocker: false
```
