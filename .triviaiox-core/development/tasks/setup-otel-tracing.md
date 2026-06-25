# Setup OpenTelemetry Tracing Task

Instrument a service with OpenTelemetry for distributed tracing, correlated metrics, and structured logs.

**Reference:** OpenTelemetry specification (opentelemetry.io), CNCF Observability Whitepaper.

---

## Execution Modes

### 1. YOLO Mode — Auto-instrumentation (0-1 prompts)

- Detects language/framework, applies auto-instrumentation
- **Best for:** Standard frameworks with mature OTel support

### 2. Interactive Mode — Manual span design (5-10 prompts) **[DEFAULT]**

- Identifies critical spans, span attributes, sampling strategy
- **Best for:** Custom business logic, LLM-driven services

### 3. Pre-Flight Planning — Architecture-first

- Maps service boundaries, designs trace propagation, sampling tiers
- **Best for:** Multi-service systems, high-volume services

**Parameter:** `mode` (optional, default: `interactive`)

---

## Task Definition

```yaml
task: setupOtelTracing()
responsavel: Rex (Sentinel)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: service_id
    tipo: string
    obrigatorio: true

  - campo: language_runtime
    tipo: enum
    obrigatorio: true
    validacao: node | python | go | rust | deno | java | dotnet

  - campo: otlp_endpoint
    tipo: string
    obrigatorio: true
    validacao: Reachable OTLP HTTP/gRPC endpoint

Saida:
  - campo: instrumentation_pr
    tipo: branch
    destino: feature branch via @devops
    persistido: true

  - campo: trace_validation
    tipo: object
    destino: ops/observability/{service_id}-trace-test.json
    persistido: true
```

---

## Pre-Conditions

```yaml
pre-conditions:
  - [ ] OTLP backend reachable from service environment
    blocker: true
  - [ ] Service has stable entry point (HTTP, gRPC, queue consumer)
    blocker: true
  - [ ] Trace ID propagation strategy decided (W3C Trace Context default)
    blocker: false
```

---

## Execution Steps

### Step 1 — Choose instrumentation strategy

- **Auto-instrumentation:** language SDK + framework integration. Lowest effort, may miss business spans.
- **Manual instrumentation:** explicit spans for business operations. Higher effort, richer signal.
- **Hybrid (recommended):** auto for transport/database, manual for business-critical spans.

### Step 2 — Define span taxonomy

Map what deserves a span:

- **Inbound entry points:** HTTP routes, gRPC methods, queue consumers
- **Outbound calls:** databases, external APIs, LLM invocations, message publishes
- **Business operations:** named workflow steps that survive refactor

Span naming convention: `{verb}.{noun}` lowercase (e.g., `prospect.qualify`, `llm.complete`).

### Step 3 — Define span attributes

Mandatory attributes:

- `service.name`, `service.version`, `deployment.environment`
- `user.id` (hashed if PII concern), `tenant.id`, `story.id` if applicable
- For LLM spans: `llm.model`, `llm.tokens.prompt`, `llm.tokens.completion`, `llm.cost.usd`
- For DB spans: `db.system`, `db.statement` (parameterized), `db.rows_affected`

Anti-pattern: high-cardinality attributes (full URLs with IDs, raw user input) without sampling controls.

### Step 4 — Configure sampling

- **Head sampling:** decide at trace start. Cheap, may miss interesting traces.
- **Tail sampling:** decide after trace completes. Catches errors and slow traces, requires collector capacity.
- **Hybrid:** head sample at 10%, tail sample for error/slow regardless.

For LLM-heavy services with cost-sensitive workloads: 100% sampling on error/slow, 5-10% on success.

### Step 5 — Set up exporter and collector

- Local dev: OTLP → console exporter or Jaeger all-in-one
- Production: OTLP → collector → backend (Tempo, Honeycomb, Grafana Cloud, Datadog, etc.)
- Resource attribution: ensure `service.name`, `deployment.environment` set via env vars

### Step 6 — Validate

Send a test request, verify trace appears in backend within 60 seconds with:

- Correct service name
- Spans for entry, business operation, and outbound calls
- Trace ID propagated across service boundaries
- Attributes populated

Save validation report to `ops/observability/{service_id}-trace-test.json`.

### Step 7 — Hand off to @devops

Branch with instrumentation changes goes to @devops for PR creation. Include in PR description:

- Sampling configuration
- New environment variables required
- Backend dashboards updated/created

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Test trace visible in backend with all expected spans
    blocker: true
  - [ ] Trace context propagates across at least one service boundary
    blocker: true
  - [ ] Sampling configuration documented
    blocker: true
  - [ ] LLM cost attributes populated (if applicable)
    blocker: false
```

---

## Anti-patterns

- Tracing everything at 100% — collector cost explodes
- Logs disconnected from traces — no `trace_id` correlation
- High-cardinality attributes without limits
- Skipping LLM spans — token cost and latency become invisible
- Manual instrumentation without auto for transport — gaps in causality chain
