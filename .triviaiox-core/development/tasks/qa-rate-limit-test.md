# QA Rate Limit Test Task

Test rate limiting on LLM-driven and public endpoints to prevent abuse, runaway costs, and denial-of-service.

**Reference:** OWASP LLM Top 10 — LLM04 (Model Denial of Service), OWASP API Security Top 10 — API4 (Unrestricted Resource Consumption).

---

## Task Definition

```yaml
task: qaRateLimitTest()
responsavel: Quinn (Guardian)
responsavel_type: Agente
atomic_layer: Atom

Entrada:
  - campo: story_id
    tipo: string
    obrigatorio: true

  - campo: endpoints_to_test
    tipo: array
    obrigatorio: true
    validacao: List of endpoints or agent triggers that invoke LLMs or expensive operations

Saida:
  - campo: rate_limit_report
    tipo: file
    destino: docs/stories/{story_id}/qa/rate-limit-test.md
    persistido: true
```

---

## Test Procedures

### Test 1 — Rate limit exists

Send N+1 requests where N is the configured limit. Verify HTTP 429 is returned.

```
Expected: 429 Too Many Requests after limit exceeded
Check: Retry-After header present
Check: Error message does not reveal rate limit configuration details
```

### Test 2 — Rate limit per user (not global)

Verify rate limit is per-user or per-IP, not a shared global counter:

- User A exhausts their limit
- User B can still make requests

### Test 3 — Token/cost rate limit

For LLM endpoints: does rate limiting consider token count (not just request count)?

A single request with 50,000 tokens is more expensive than 100 requests with 100 tokens each.

Check: Is there a max_tokens enforcement per request?

### Test 4 — Autonomous agent loops

For features that trigger AI agent loops:

- Is there a max iterations guard?
- Is there a timeout guard?
- Can a single user trigger an unbounded loop?
- Is there circuit-breaking if cost spikes suddenly?

### Test 5 — Unauthenticated endpoints

Any endpoint callable without auth:

- Rate limit should be stricter (IP-based, lower threshold)
- Verify 429 fires before any expensive operation (LLM call, DB write) runs

## Evaluation

- **FAIL (blocking):** LLM endpoint callable without rate limit (DoS risk and cost risk)
- **CONCERNS:** Rate limit exists but does not account for token volume
- **PASS:** All endpoints have per-user rate limit; LLM endpoints have token cap; agent loops have bounded iteration
