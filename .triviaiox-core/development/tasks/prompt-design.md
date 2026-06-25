# Prompt Design Task

Design a new LLM prompt from behavioral specification to production-ready template.

**Reference:** Anthropic Prompt Engineering Guide, OpenAI Prompt Engineering docs.

---

## Execution Modes

### 1. YOLO Mode — Generate from task description alone

### 2. Interactive Mode — Collaborative spec + design **[DEFAULT]**

### 3. Pre-Flight Planning — Full workshop with few-shot curation

**Parameter:** `mode` (optional, default: `interactive`)

---

## Task Definition

```yaml
task: promptDesign()
responsavel: Pria (Alchemist)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: task_description
    tipo: string
    obrigatorio: true
    validacao: What the prompt should accomplish, in plain language

  - campo: input_variables
    tipo: array
    obrigatorio: true
    validacao: List of variables the prompt receives (e.g., [company_name, description])

  - campo: output_format
    tipo: string
    obrigatorio: true
    validacao: Expected output structure (e.g., JSON schema, plain text, list)

  - campo: model_target
    tipo: string
    obrigatorio: false
    validacao: Model family the prompt is optimized for (default: claude-sonnet)

  - campo: token_budget
    tipo: object
    obrigatorio: false
    validacao: "{input_max: N, output_max: N}" — hard limits from cost model

Saida:
  - campo: prompt_card
    tipo: file
    destino: docs/prompts/{slug}-v{version}.md
    persistido: true

  - campo: prompt_template
    tipo: file
    destino: src/prompts/{slug}.ts  (or .py / .yaml)
    persistido: true
```

---

## Pre-Conditions

```yaml
pre-conditions:
  - [ ] Behavioral specification exists: what does success look like?
    blocker: true
  - [ ] At least 5 representative input examples available
    blocker: false
  - [ ] Token budget and latency target defined (from @reliability SLO or @analyst cost model)
    blocker: false
```

---

## Execution Steps

### Step 1 — Behavioral specification

Before writing a single word of prompt, answer:

1. **What is the task?** One sentence, imperative.
2. **What does a perfect output look like?** Describe 2 examples.
3. **What are common failure modes?** List 3 ways this can go wrong.
4. **What is out of scope?** Be explicit about what the prompt should NOT do.
5. **What constraints apply?** Tone, length, format, safety rules.

Do not proceed to Step 2 until these 5 questions are answered.

### Step 2 — Choose prompt architecture

Select the appropriate structure:

| Architecture | When to use |
|---|---|
| Zero-shot | Well-defined task, model has strong priors |
| Few-shot | Complex formatting, style consistency needed |
| Chain-of-thought | Multi-step reasoning, decisions with intermediate steps |
| Role + task | Needs persona/voice consistency |
| Structured output | JSON/YAML output with schema enforcement |
| Tool use | Needs to call external functions |

### Step 3 — Write the prompt

Use the structure:

```
[Role/Persona — if needed]
[Context/Background — what the model needs to know]
[Task — imperative, specific]
[Constraints — explicit limits]
[Output format — schema or example]
[Few-shot examples — if needed, interleaved with H/A turns or XML tags]
```

Guidelines:

- Put the most important instruction first AND last (primacy + recency)
- Use XML tags (`<context>`, `<task>`, `<examples>`) for clarity in long prompts
- Be direct: "Return JSON" not "If you think it's appropriate, you could perhaps return JSON"
- Enumerate constraints as a list, not prose
- For Anthropic models: use `<thinking>` tags if chain of thought needed

### Step 4 — Define output schema

If structured output: write the JSON schema or Zod schema explicitly.
Include `additionalProperties: false` and required fields.
Document what each field means and acceptable values.

### Step 5 — Curate few-shot examples (if needed)

Selection criteria for few-shot examples:

- Representative of actual input distribution
- Cover edge cases (not just easy cases)
- Demonstrate desired output format exactly
- Include at least one borderline case with correct handling

Number of examples: 2–6. More than 8 rarely helps and inflates cost.

### Step 6 — Fill prompt card template

Load `templates/prompt-card-template.md` and fill all sections:

- Prompt ID, version, model family
- Behavioral spec (from Step 1)
- Template with variable markers
- Few-shot examples
- Token budget
- Eval baseline (fill after `*prompt-eval-harness`)
- Change log

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Prompt card created at docs/prompts/{slug}-v{version}.md
    blocker: true
  - [ ] Output schema defined
    blocker: true
  - [ ] Behavioral spec answers all 5 questions
    blocker: true
  - [ ] Token estimate within budget
    blocker: false
  - [ ] Eval set created (trigger *prompt-eval-harness after this task)
    blocker: false
```

---

## Anti-patterns

- Skipping behavioral spec and writing directly (produces unverifiable prompts)
- Prompt so long it costs more than the value it delivers
- Vague constraints ("be helpful", "be concise") without operational definition
- Few-shot examples only from easy/happy-path cases
- No explicit output schema for structured outputs
