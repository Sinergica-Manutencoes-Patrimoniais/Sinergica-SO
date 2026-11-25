# Data model — E06-S01 (schema `marketing`)

DDL completo em `supabase/migrations/1900_E06-S01_marketing_indicadores_meta.sql`; o esqueleto e
as razões estão no [plan.md](./plan.md) §1. Aqui ficam as relações, as chaves naturais e as
invariantes.

## Hierarquia da plataforma

```
contas_anuncio 1─n campanhas 1─n conjuntos 1─n anuncios 1─n metricas_anuncio_dia
                                                 │
                                                 ├─n links_rastreados
                                                 └─n entradas_anuncio ──0..1── comercial.oportunidades
```

| Entidade | Chave natural (idempotência) | Invariantes |
|---|---|---|
| `contas_anuncio` | `(plataforma, conta_externa_id)` | `conta_externa_id` só dígitos (os de `act_<id>`); `moeda` em `[A-Z]{3}`; **nunca** guarda credencial. |
| `campanhas` | `(conta_id, campanha_externa_id)` | nome obrigatório; `situacao` livre (rótulo da Meta). |
| `conjuntos` | `(campanha_id, conjunto_externo_id)` | — |
| `anuncios` | `anuncio_externo_id` **global** | o ad id é único na plataforma inteira, não por conta. |
| `metricas_anuncio_dia` | `(anuncio_id, dia)` — a PK | contadores `>= 0`; `gasto_centavos` inteiro; `dia` entre 2015-01-01 e amanhã. |
| `links_rastreados` | `token` único, `^[a-z0-9]{12}$` | `url_destino` começa com `https://`; desligar é `ativo = false`, nunca apagar. |
| `entradas_anuncio` | id próprio | `anuncio_id` nulo = sem origem (AC-14); `oportunidade_id` **único** — uma oportunidade pertence a no máximo uma entrada (AC-15, evita contar receita duas vezes). |
| `sincronizacoes` | id próprio | append-only (GRANT só `select, insert`); `origem in ('meta','demonstracao')`; `resultado in ('sucesso','falha')`. |
| `sso_indicadores_meta_gate` | linha única (`id = true`) | leitura para `authenticated`, nenhuma escrita por GRANT; nasce `habilitado = true`. |

## Fronteira com o Comercial

`entradas_anuncio.oportunidade_id → comercial.oportunidades(id)` é a **única** FK que sai do
schema. Precedente: `comercial.oportunidades` já referencia `atendimento.conversas` e
`relacionamento.contatos`. A leitura conjunta (receita) acontece só em
`marketing.fn_receita_por_campanha`, que exige os dois claims. O front do Marketing não importa
nada de `features/comercial` (ADR-1699 §2).

## Transições de estado

Não há máquina de estados nesta story. `situacao` de campanha/conjunto/anúncio é rótulo espelhado
da Meta, não estado próprio — o SO nunca o altera (FR-017).

A única transição é a da **entrada**: `sem oportunidade` → `vinculada`, por
`marketing.fn_vincular_oportunidade`, irreversível pela UI (desvincular não está no escopo).

## Retenção

Dado de plataforma é cópia re-sincronizável: apagar e re-sincronizar reproduz o estado.
`entradas_anuncio` contém dado pessoal mínimo (nome, e-mail, telefone) e segue a trilha de LGPD do
projeto; `sincronizacoes` não contém dado pessoal e é histórico de operação.
