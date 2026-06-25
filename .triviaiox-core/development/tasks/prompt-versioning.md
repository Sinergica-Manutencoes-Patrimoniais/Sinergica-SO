# Prompt Versioning Task

Apply semantic versioning to a prompt with changelog and backward compatibility notes.

---

## Task Definition

```yaml
task: promptVersioning()
responsavel: Pria (Alchemist)
responsavel_type: Agente
atomic_layer: Atom

Entrada:
  - campo: prompt_card_path
    tipo: file_path
    obrigatorio: true
  - campo: change_description
    tipo: string
    obrigatorio: true
  - campo: regression_report_path
    tipo: file_path
    obrigatorio: true

Saida:
  - campo: updated_prompt_card
    tipo: file
    destino: docs/prompts/{slug}-v{new_version}.md
    persistido: true
```

---

## Semantic Versioning for Prompts

```
MAJOR.MINOR.PATCH

MAJOR (1.0.0 → 2.0.0):
  - Behavioral contract change (different task scope)
  - Breaking output schema change
  - Requires re-running all downstream evals

MINOR (1.0.0 → 1.1.0):
  - New capability added without breaking existing behavior
  - New output field (backward compatible)
  - Significant quality improvement

PATCH (1.0.0 → 1.0.1):
  - Wording refinement with no behavioral change
  - Typo fix
  - Edge case improvement confirmed by eval
```

## Execution Steps

### Step 1 — Determine version bump

Read regression report. Based on change type:

- Output schema changed → MAJOR
- New capability, no regression → MINOR
- Same behavior, better quality → PATCH

### Step 2 — Update prompt card

- Bump version in front matter
- Add changelog entry with date, author, change description, and regression result
- Keep previous version content in the git history (via @devops), not inline

### Step 3 — Create immutable artifact

Prompt cards are immutable once published:

- Name file `{slug}-v{version}.md` — never overwrite past versions
- Keep a `{slug}-latest.md` symlink-equivalent pointing to current

### Step 4 — Update references

Search for places that import this prompt (config files, code) and:

- For PATCH/MINOR: no update required if using `latest`
- For MAJOR: update all callers explicitly; treat as breaking API change
