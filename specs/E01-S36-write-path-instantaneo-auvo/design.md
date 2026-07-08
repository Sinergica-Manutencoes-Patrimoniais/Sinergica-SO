---
name: design
description: Technical Design Doc — propagação instantânea PCM→Auvo em qualquer alteração (todas as entidades).
alwaysApply: false
---

# Technical Design Doc — Write path instantâneo PCM→Auvo

> **Tier:** arquitetural · **Status:** rascunho
> **Autor:** sessão A · **Revisores:** Lucas · **Data:** 2026-07-08
> Responde: **como** fazer create/edit/delete no PCM refletir no Auvo em segundos, reusando o motor de
> outbox de E01-S22 sem perder auditoria/retry.

## Contexto da funcionalidade
E01-S22 construiu o motor genérico: trigger `pcm.fn_auvo_enqueue` grava em `pcm.auvo_sync_outbox`, e a
Edge Function `pcm-auvo-push` drena o outbox chamando o Auvo. **Mas hoje ele nunca chama o Auvo de verdade:**
todos os descriptors em `_shared/auvo/registry/*.ts` têm `writeEnabled:false`, então `pcm-auvo-push`
marca a linha como "pulado (dry-run)" e retorna. Além disso o drain só roda pelo **cron de 1 min**
(`0025`), então mesmo com `writeEnabled:true` a propagação não seria "instantânea".

Duas lacunas visíveis ao Lucas: cadastrar funcionário não aparece no Auvo (o CREATE tem caminho síncrono
próprio via `pcm-auvo-users-create`, mas edit/desativar caem no outbox e morrem); e "qualquer alteração
deve refletir imediatamente". Ver `product.md`. Pré-requisito: E01-S35 (funções deployadas).

## Goals / Non-goals
**Goals**
- `writeEnabled:true` nas entidades com **mapeamento verificado** contra a API Auvo real.
- Drain **disparado na hora** após cada escrita (não esperar o cron); cron vira retry/fallback.
- Edit/desativar de funcionário propagam ao Auvo.
- Entidade não verificada permanece `writeEnabled:false` **documentada** (skip explícito, não silêncio — integra E00-S11).

**Non-goals**
- Reescrever o outbox, o anti-loop (GUC `app.auvo_sync_write`) ou a idempotência por `auvo_id` de E01-S22 — reusar.
- Pull Auvo→PCM / botão de sync — `E01-S37`.
- Deploy/secrets — `E01-S35`.

## Design proposto

### Drain imediato pós-enqueue
Hoje: `escrita → trigger enqueue → (espera até 1 min) → cron → pcm-auvo-push`.
Proposto: acionar `pcm-auvo-push` **logo após** a escrita, mantendo o cron como rede de segurança.

Duas opções de gatilho (decidir na task 1):

**Opção A — invoke a partir do adapter (front/Edge):** após o caso de uso gravar e o outbox enfileirar,
o próprio caminho de escrita chama `supabase.functions.invoke("pcm-auvo-push")` (fire-and-forget). Simples,
sem novo componente de DB. Risco: escrita que não passa pelo adapter (ex.: webhook) não dispara — mas essas
já são caminhos server-side com seu próprio fluxo.

**Opção B — `pg_net` no trigger:** a trigger de enqueue faz `net.http_post` para `pcm-auvo-push` (mesmo
padrão dos crons `0011`/`0037`). Cobre qualquer escrita, inclusive não-UI, e mantém a lógica no DB. Risco:
acopla a trigger ao `pg_net`/Vault secret; ruído se muitas escritas em lote.

**Decisão final (implementada em `0051_E01-S36_drain_imediato.sql`): Opção B.** Na execução, Opção B se
mostrou mais segura que a recomendação original — uma única mudança centralizada em `fn_auvo_enqueue()`
cobre TODA escrita (inclusive fora do adapter do front, ex. futuras integrações server-side) sem precisar
tocar em ~10 adapters TS individualmente, cada um um ponto de esquecimento possível. Reusa exatamente o
padrão `pg_net`+Vault já validado em produção por `0011`/`0037`/`0038`. SPEC_DEVIATION registrado em
`tasks.md`. O cron de 1 min (`0025`) permanece como rede de segurança.

```
UI create/edit/delete
  └── adapter grava linha  ── trigger fn_auvo_enqueue → outbox (pending)
        └── adapter: invoke("pcm-auvo-push")  (fire-and-forget, não bloqueia UI)
              └── drena a(s) linha(s) pending → Auvo (POST/PATCH/DELETE) → fn_apply_auvo_sync grava auvo_id
   (fallback) cron 1 min drena o que sobrou / retenta status=error
```

### Flip de `writeEnabled` guardado por verificação
Cada descriptor em `_shared/auvo/registry/*.ts` (funcionarios, clientes, equipamentos, ferramentas, tickets,
servicos, equipes, tipos-tarefa, categorias, segmentos, grupos) só vira `writeEnabled:true` **após** um teste
de contrato do seu mapeamento de campos (nomes exatos, `externalIdField`, `deleteStrategy`/`deactivatePatch`)
contra a API Auvo real ou sandbox. O `client.ts` avisa em comentário que esses nomes nunca foram
verificados — este é o ponto onde a dívida é paga, entidade por entidade.

### Edit/desativar de funcionário
`supabase-funcionarios-adapter.ts` hoje só seta `auvo_sync_status:'pending'` no edit/desativar (a linha vai
pro outbox e morre). Com `funcionariosDescriptor.writeEnabled=true` + `deactivatePatch:{unavailableForTasks:true}`
(já existe do E01-S28) + drain imediato, o PATCH/desativação passa a sair. A idempotência por `auvo_id`
(AC-4 de E01-S22) garante que não vira novo POST.

## Cobertura dos 5 eixos

### 1. Tech stack
Sem lib nova. Reusa `_shared/auvo/client.ts` (`auvoPatch`/`auvoDelete` já implementados em S22), registry, outbox.

### 2. Arquitetura base
Camadas intactas. `application`/`infrastructure` dos features PCM ganham o disparo do drain pós-escrita.
Domínio não muda. Fronteira: nenhuma nova; é o motor de S22 ativado + acelerado.

### 3. Infra
Nenhum recurso novo no MVP (Opção A). Se Opção B, usa `pg_net`+Vault (já disponíveis). Feature flag natural:
`writeEnabled` por entidade **é** o flag de reversão — desligar volta ao dry-run seguro.

### 4. Qualidade
- **Contrato (Deno):** mapeamento por descriptor vs fixtures da API Auvo (AC-4) — gate antes de ligar cada flip.
- **Integração (Deno):** enqueue dispara `pcm-auvo-push`; edit/delete de funcionário propaga; idempotência sob drain imediato (edições rápidas não duplicam).
- **Budget:** drain fire-and-forget não pode bloquear a resposta da UI (p95 da escrita PCM inalterado); a chamada Auvo é assíncrona ao usuário.

### 5. Observabilidade
Cada linha de outbox registra `status` (`sent`/`error`/skip), `attempts`, `last_error`. A view
`pcm.auvo_sync_health` (E00-S11) expõe último push OK/erro por entidade — é como se prova que a propagação
funciona. `writeEnabled:false` aparece como skip explícito, nunca como sucesso.

## Mapa de dependências
| Dependência | Tipo | Descrição | Métodos / endpoints |
|-------------|------|-----------|---------------------|
| Auvo API | REST | Create/update/deactivate por entidade | `POST`/`PUT`/`PATCH` `/users`,`/customers`,`/equipments`,`/products`,`/services`,`/teams`,`/tickets`,catálogos |
| `pcm-auvo-push` (E01-S22) | Edge Function | Drena outbox | invoke direto (MVP) + cron 1 min (fallback) |
| E01-S35 | Pré-requisito | Funções deployadas + secrets | — |

## Alternativas consideradas
| Alternativa | Prós | Contras | Por que (não) escolhida |
|-------------|------|---------|-------------------------|
| A (escolhida) Outbox + drain imediato (invoke pós-escrita) + cron fallback | Mantém auditoria/retry/anti-loop de S22; instantâneo no caso da UI | Escrita fora do adapter não dispara imediato (cai no cron ≤60s) | Menor risco, reusa o motor pronto |
| B Chamada síncrona direta ao Auvo no caso de uso (bypass outbox) | Mais "instantâneo" ainda | Perde retry/idempotência/anti-loop; replica o anti-padrão dos 3 fluxos síncronos legados | Rejeitada — reintroduz fragilidade que S22 resolveu |
| C Só reduzir o cron (ex.: 10s) | Zero código de disparo | Não é instantâneo; carga de polling | Rejeitada — não atende "imediatamente" |

## Trade-offs e consequências
Ganha: propagação instantânea sem perder o motor auditável. Aceita: uma escrita fora do adapter espera o
cron (≤60s) no MVP; e o trabalho manual de verificar o mapeamento de cada entidade antes de ligar.

## Riscos
| Risco | Descrição | Prob. × Impacto | Ações / mitigações |
|-------|-----------|-----------------|--------------------|
| Mapeamento de campo errado | Auvo grava lixo / rejeita | alto × alto | AC-4: só liga `writeEnabled` com teste de contrato; entidade não verificada fica false documentada |
| Drain imediato falha silencioso | invoke fire-and-forget engolido | médio × médio | cron fallback reprocessa; `auvo_sync_health` mostra erro; nunca marca sucesso falso |
| Duplicação no Auvo | Reprocesso de linha `error` sem `auvo_id` persistido | médio × alto | Follow-up conhecido de S22 (persistir `externalId` antes de considerar sucesso) — endereçar aqui |

## Roadmap da feature
| Fase | Entrega | Depende de |
|------|---------|------------|
| 1 (MVP) | Drain imediato (Opção A) + flip das entidades já com `externalId` real verificado + funcionário edit/desativar | E01-S35 |
| 2 | Verificar e ligar as entidades restantes; avaliar Opção B se houver escrita não-UI | 1 |

## Questões em aberto
- [ ] Opção A vs B do gatilho — decidir na task 1 (depende de haver escrita fora do adapter que precise de instantaneidade).
- [ ] Qual ambiente para verificar o mapeamento Auvo (sandbox vs conta real com dado de teste) — Lucas.

> ADR: atualizar `docs/adr/0005-outbox-sync-auvo.md` (drain imediato + regra "só liga writeEnabled verificado" são aditivos à decisão do outbox).
