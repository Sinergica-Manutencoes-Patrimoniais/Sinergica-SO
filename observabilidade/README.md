---
name: observabilidade
description: Padrão de log estruturado, taxonomia de erro e health check. Puxe ao construir borda (interfaces) ou integração.
alwaysApply: false
---

# Observabilidade

> Sistema observável é o que você consegue **diagnosticar sem reproduzir**. O mínimo: log
> estruturado com correlação, erro padronizado e um health check. Código de referência:
> `src/shared/log.ts` (logger) e `src/interfaces/http/problem.ts` (erro). O domínio não loga —
> quem loga é `interfaces/` e `infrastructure/`.

## Log estruturado
- **JSON, uma linha por evento** (`src/shared/log.ts`): `{ ts, nivel, msg, ...campos }`.
- **Correlação:** todo fluxo de requisição gera um `reqId` na borda e o propaga em **todos** os
  logs e na resposta de erro (`problem.reqId`). É o que liga "o cliente viu erro X" ao log do servidor.
- **Níveis:** `debug` (dev), `info` (evento de negócio), `warn` (degradação/recuperável),
  `error` (falha que exige atenção). Não logue `info` em loop quente.
- **NUNCA logar PII** (CPF, email, telefone), segredo (token, senha) nem o corpo cru do request.
  Logue **ids e contagens**, não conteúdo sensível. (Risco LGPD — ver `os-layer/seguranca/os-grade.md`.)

## Taxonomia de erro (RFC 7807)
- Toda resposta de erro da borda é `application/problem+json` via `problem(status, detail, { reqId })`.
- `detail` é **seguro para o cliente** — mensagem, nunca stack trace ou dado interno.
- Erro inesperado → `500 "Erro interno"` + `log.error` com `reqId` no servidor. O cliente recebe o
  `reqId`; o detalhe fica no log.
- Erro de validação na borda → `422`; erro de regra de domínio (`ErroValidacao`) → `422`;
  não autenticado → `401`; sem permissão → `403`. Ver exemplo em `src/interfaces/http/registrar-comissao.ts`.

## Health check
- Exponha um `/health` que responde 200 rápido (sem dependências) e, se útil, um `/ready` que
  verifica dependências críticas (banco, fila). Use no smoke test pós-deploy e no monitor do provedor.

## O que medir (e onde olhar)
- **Edge Functions / API:** taxa de erro 5xx, latência p95, throughput — logs do Supabase/provedor.
- **Front:** Web Vitals (LCP/INP/CLS) — ver `performance/README.md`.
- **Negócio:** 1–2 métricas que provam que a feature funciona (ex.: comissões registradas/dia).
- Alerta no que dói: 5xx acima do limite, falha de integração, expiração de token (ver runbooks).

## SLO/SLI (perfil OS / serviço crítico)
Defina SLI (o que mede) e SLO (o alvo) para o caminho crítico — template em
`observabilidade/slo-sli.template.md`. Dono: `@reliability`.
