# QA Hallucination Eval Task

Evaluate hallucination risk in LLM-generated content. Especially critical for features that present LLM output as factual.

**Reference:** OWASP LLM Top 10 — LLM09 (Overreliance), TruthfulQA, Anthropic model cards.

---

## Task Definition

```yaml
task: qaHallucinationEval()
responsavel: Quinn (Guardian)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: story_id
    tipo: string
    obrigatorio: true

  - campo: feature_type
    tipo: enum
    obrigatorio: true
    validacao: |
      factual_claim | recommendation | code_generation | summarization | classification | creative

  - campo: source_of_truth
    tipo: string
    obrigatorio: false
    validacao: Where ground truth can be verified (DB, external API, domain expert)

Saida:
  - campo: hallucination_report
    tipo: file
    destino: docs/stories/{story_id}/qa/hallucination-eval.md
    persistido: true
```

---

## Risk Classification by Feature Type

| Feature Type | Hallucination Risk | QA Approach |
|---|---|---|
| Factual claim (business info, product details) | HIGH | Verify against source of truth |
| Recommendation (which service, action to take) | HIGH | Validate logic against rubric |
| Code generation | HIGH | Run code, verify output |
| Summarization | MEDIUM | Check no fabricated facts added |
| Classification | MEDIUM | Eval set pass rate |
| Creative (copy, descriptions) | LOW | Human review for plausibility |

## Evaluation Procedures

### For HIGH risk features

1. Create 10 test cases with known ground truth
2. Run LLM against each case
3. Compare output to ground truth
4. Flag any fabricated facts, wrong references, or invented specifics

### Fabrication indicators to check

- Specific numbers or statistics not present in input context
- Named entities (companies, people, products) not in context
- Dates or events that don't exist
- Technical specifications that are plausible but unverified

### Confidence calibration

Does the feature present outputs with appropriate uncertainty?

- Is there a disclaimer when confidence is low?
- Does the UI indicate AI-generated content?
- Is the user able to verify the claim independently?

## Evaluation

- **PASS:** No systematic hallucinations found; appropriate disclaimers present
- **CONCERNS:** Minor unverified claims in low-stakes contexts
- **FAIL:** Systematic fabrication in factual claims presented as truth

## Remediation

- Reduce hallucination: use retrieval-augmented generation (RAG) with source grounding
- Add uncertainty markers to outputs
- Add human-in-the-loop for high-stakes factual claims
