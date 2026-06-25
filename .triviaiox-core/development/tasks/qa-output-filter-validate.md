# QA Output Filter Validate Task

Validate that output sanitization and content filtering is working correctly for LLM-generated content before it reaches users or downstream systems.

**Reference:** OWASP LLM Top 10 — LLM02 (Insecure Output Handling), NIST AI RMF.

---

## Task Definition

```yaml
task: qaOutputFilterValidate()
responsavel: Quinn (Guardian)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: story_id
    tipo: string
    obrigatorio: true

  - campo: output_types
    tipo: array
    obrigatorio: true
    validacao: "List: html | markdown | json | plaintext | sql | code"

  - campo: downstream_consumers
    tipo: array
    obrigatorio: true
    validacao: "List: browser | database | api | email | whatsapp | log"

Saida:
  - campo: output_filter_report
    tipo: file
    destino: docs/stories/{story_id}/qa/output-filter.md
    persistido: true
```

---

## Validation Checks by Output Type

### HTML output (rendered in browser)

```
Test: LLM returns <script>alert('xss')</script>
Expected: Sanitized before render — no JS execution
Check: Does sanitization library strip all script tags and event handlers?
```

### Markdown (rendered as HTML)

```
Test: LLM returns [click me](javascript:alert('xss'))
Expected: javascript: links stripped
Test: LLM returns dangerous HTML block inside markdown
Expected: Escaped or stripped
```

### JSON output (consumed by API or DB)

```
Test: LLM returns JSON with extra fields not in schema
Expected: additionalProperties validation rejects it
Test: LLM returns SQL injection attempt in a string field
Expected: Value treated as string, not executed
```

### WhatsApp/Email output (rendered in messaging)

```
Test: LLM returns template with HTML tags
Expected: Stripped or escaped for plain text
Test: LLM returns content with links to external sites
Expected: Links validated against allowlist or flagged
```

## Key Validation Questions

1. Is LLM output ever passed directly to `eval()`, `innerHTML`, or an ORM without escaping?
2. Is there schema validation between LLM output and storage?
3. Is Markdown-to-HTML conversion using a sanitizing library?
4. For messaging: is output length validated before sending?

## Evaluation

- **FAIL (blocking):** Any path where unsanitized LLM output reaches DOM, DB exec, or external service
- **CONCERNS:** Partial sanitization with documented compensating controls
- **PASS:** All output paths have appropriate sanitization validated
