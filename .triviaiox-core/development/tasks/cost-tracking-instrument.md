# Cost Tracking Instrument Task

Add cost instrumentation to a service or pipeline so that cost-per-task can be tracked, reported, and alerted on.

**Reference:** FinOps Foundation Framework (Inform phase), AWS/GCP cost tagging best practices.

---

## Task Definition

```yaml
task: costTrackingInstrument()
responsavel: Atlas (Decoder)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: service_id
    tipo: string
    obrigatorio: true

  - campo: cost_sources
    tipo: array
    obrigatorio: true
    validacao: |
      List of cost-generating calls: e.g., [anthropic_api, apify, replicate, resend, stripe]
      Each entry: {name, type: llm|scraper|image_gen|email|payment, metric: tokens|requests|units}

Saida:
  - campo: instrumentation_spec
    tipo: file
    destino: docs/finops/{service_id}-cost-schema.md
    persistido: true

  - campo: schema_migration
    tipo: file
    destino: supabase/migrations/{timestamp}_add_cost_tracking.sql
    persistido: true
```

---

## Pre-Conditions

```yaml
pre-conditions:
  - [ ] Service deployed and generating calls to cost sources
    blocker: true
  - [ ] Billing/usage API access confirmed for each cost source
    blocker: false
```

---

## Execution Steps

### Step 1 — Identify cost attribution schema

For each cost source, define how cost is attributed:

| Source | Unit | Attribution | Example |
|---|---|---|---|
| LLM (Anthropic, OpenAI) | tokens | prompt + completion | `{input_tokens: 500, output_tokens: 200, cost_usd: 0.00045}` |
| Scraper (Apify) | requests or actor-compute-units | per run | `{actor_run_id: ..., cost_usd: 0.003}` |
| Image gen (Replicate) | prediction | per image | `{prediction_id: ..., model: ..., cost_usd: 0.0055}` |
| Email (Resend) | messages | per send | `{email_id: ..., cost_usd: 0.0001}` |

### Step 2 — Design the tracking table / column

Standard schema (append to existing execution table or create dedicated):

```sql
-- Option A: Extend existing agent_executions table
ALTER TABLE agent_executions
  ADD COLUMN cost_usd DECIMAL(10, 6) DEFAULT 0,
  ADD COLUMN cost_breakdown JSONB DEFAULT '{}',
  ADD COLUMN model_used TEXT,
  ADD COLUMN tokens_input INTEGER,
  ADD COLUMN tokens_output INTEGER;

-- Option B: Dedicated cost_events table (for multi-source pipelines)
CREATE TABLE cost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  execution_id UUID REFERENCES agent_executions(id),
  story_id TEXT,
  source TEXT NOT NULL,          -- 'anthropic' | 'apify' | 'replicate' | etc.
  source_type TEXT NOT NULL,     -- 'llm' | 'scraper' | 'image_gen' | 'email'
  cost_usd DECIMAL(10, 6) NOT NULL,
  metadata JSONB DEFAULT '{}'    -- source-specific: tokens, model, run_id, etc.
);
```

### Step 3 — Add cost capture in code

For each cost source, capture cost immediately after the call:

```typescript
// LLM call example
const response = await anthropic.messages.create({...})
await db.insert('cost_events', {
  execution_id,
  source: 'anthropic',
  source_type: 'llm',
  cost_usd: calculateCost(response.usage.input_tokens, response.usage.output_tokens, model),
  metadata: {
    model,
    tokens_input: response.usage.input_tokens,
    tokens_output: response.usage.output_tokens
  }
})
```

### Step 4 — Create cost rollup views

```sql
-- Cost per story
CREATE VIEW v_cost_per_story AS
SELECT
  story_id,
  SUM(cost_usd) AS total_cost_usd,
  jsonb_object_agg(source, SUM(cost_usd)) AS cost_by_source,
  MIN(created_at) AS first_event,
  MAX(created_at) AS last_event
FROM cost_events
GROUP BY story_id;

-- Daily cost trend
CREATE VIEW v_daily_cost AS
SELECT
  DATE_TRUNC('day', created_at) AS day,
  source,
  SUM(cost_usd) AS total_cost_usd,
  COUNT(*) AS event_count
FROM cost_events
GROUP BY 1, 2
ORDER BY 1, 2;
```

### Step 5 — Document instrumentation spec

Publish `docs/finops/{service_id}-cost-schema.md`:

- Cost sources list with unit types
- Attribution schema
- Database schema choice and migration
- Rollup views
- Update `@analyst` on how to access this data for reporting

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Cost schema documented
    blocker: true
  - [ ] Migration or table alteration SQL created
    blocker: true
  - [ ] Code capture points identified and handed off to @dev for implementation
    blocker: true
  - [ ] Rollup views defined
    blocker: false
```
