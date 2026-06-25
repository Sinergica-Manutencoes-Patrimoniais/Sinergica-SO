# Cost Attribution Schema: {Service Name}

```yaml
schema:
  service_id: "{service_id}"
  version: "1.0.0"
  created: "{YYYY-MM-DD}"
  updated: "{YYYY-MM-DD}"
  owner: "@analyst"
```

---

## Cost Sources

| Source | Type | Billing Unit | API/Provider | Notes |
|---|---|---|---|---|
| {source_name} | llm \| scraper \| image_gen \| email \| payment \| other | tokens \| requests \| units | {provider} | {any notes} |

---

## Cost Attribution Fields

For each source, define what to capture:

### LLM Sources (Anthropic, OpenAI, Gemini, etc.)

```json
{
  "source": "anthropic",
  "source_type": "llm",
  "cost_usd": 0.000450,
  "metadata": {
    "model": "claude-haiku-4-5",
    "tokens_input": 500,
    "tokens_output": 200,
    "cache_hit_tokens": 300
  }
}
```

### Scraper Sources (Apify, ScraperAPI, etc.)

```json
{
  "source": "apify",
  "source_type": "scraper",
  "cost_usd": 0.003000,
  "metadata": {
    "actor_name": "{actor}",
    "actor_run_id": "{id}",
    "compute_units": 1.2
  }
}
```

### Image Generation Sources (Replicate, Stability, DALL-E)

```json
{
  "source": "replicate",
  "source_type": "image_gen",
  "cost_usd": 0.005500,
  "metadata": {
    "model": "{model_id}",
    "prediction_id": "{id}",
    "width": 1024,
    "height": 1024
  }
}
```

### Messaging Sources (Resend, SendGrid, Twilio, Z-API)

```json
{
  "source": "resend",
  "source_type": "email",
  "cost_usd": 0.000100,
  "metadata": {
    "email_id": "{id}",
    "to_domain": "{hashed_or_anonymized}"
  }
}
```

---

## Database Schema

**Choice:** *(Extend existing table OR dedicated cost_events table)*

```sql
-- Recommended: dedicated cost_events table
CREATE TABLE cost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  execution_id UUID,               -- FK to your pipeline execution table
  story_id TEXT,                   -- Story/task identifier
  service_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_type TEXT NOT NULL,
  cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_cost_events_service_date ON cost_events (service_id, created_at DESC);
CREATE INDEX idx_cost_events_story ON cost_events (story_id);
```

---

## Rollup Views

```sql
-- Cost per story
CREATE OR REPLACE VIEW v_cost_per_story AS
SELECT
  story_id,
  service_id,
  SUM(cost_usd)                                        AS total_cost_usd,
  jsonb_object_agg(source, SUM(cost_usd))              AS cost_by_source,
  MIN(created_at)                                      AS started_at,
  MAX(created_at)                                      AS completed_at
FROM cost_events
GROUP BY story_id, service_id;

-- Daily cost trend by source
CREATE OR REPLACE VIEW v_daily_cost AS
SELECT
  DATE_TRUNC('day', created_at)                        AS day,
  service_id,
  source,
  source_type,
  SUM(cost_usd)                                        AS total_cost_usd,
  COUNT(*)                                             AS event_count,
  AVG(cost_usd)                                        AS avg_cost_per_event
FROM cost_events
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC, 4 DESC;
```

---

## Baseline (fill after first 7 days of production data)

| Metric | Value | Date Measured |
|---|---|---|
| Cost per pipeline run (p50) | ${N} | {YYYY-MM-DD} |
| Cost per pipeline run (p95) | ${N} | {YYYY-MM-DD} |
| Cost per pipeline run (p99) | ${N} | {YYYY-MM-DD} |
| Daily total (avg) | ${N} | {YYYY-MM-DD} |
| LLM share (%) | {N}% | {YYYY-MM-DD} |

---

*Template: TRIVIAIOX cost-attribution-schema.md v1.0 | Author: @analyst*
