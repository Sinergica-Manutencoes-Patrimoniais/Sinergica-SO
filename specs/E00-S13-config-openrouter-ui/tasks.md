---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Configurar OpenRouter na UI (Configurações > Integrações)

> Tier pequeno. Reusa E00-S12 (write/checagem de segredo — genérica por chave, sem RPC nova de
> escrita). A parte nova é a **leitura** do segredo pela Edge (RPC `security definer` + fallback
> env). Deno não roda local — validar Edge no CI/prod. Segurança: chave só no Vault, nunca no client/log.

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1 | Migration `NNNN`: `config.fn_obter_segredo_integracao(chave)` `security definer`, só service_role, lê `vault.decrypted_secrets`; grant mínimo | AC-3,AC-4 | — | lint:migrations | todo |
| 2 | Metadado do modelo de import em `config.integracoes` (provedor `openrouter`, campo `import_model`) | AC-2 | — | lint:migrations | todo |
| 3 | UI `IntegracoesPage`: provedor OpenRouter — campo Chave (write-only, reusa `fn_definir_segredo_integracao`) + campo Modelo (opcional); gate superadmin | AC-1,AC-2 | — | typecheck | todo |
| 4 | `_shared/openrouter.ts`: lê chave via RPC (Vault) com fallback `Deno.env.OPENROUTER_API_KEY`; modelo via config com default | AC-3 | 1,2 | (deno CI) | todo |
| 5 | Erro claro quando não configurado ("configure em Configurações > Integrações"), legível | AC-5 | 4 | vitest | todo |
| 6 | Validar ponta a ponta (Lucas): configurar chave pela UI → subir Excel de inspeção → classifica | AC-1,AC-3 | — | manual (Lucas) | todo |

## Plano de teste
- Unidade: fallback env↔Vault; erro "não configurado"; chave nunca reexibida.
- Aceite: Lucas configura chave real na UI, sobe Excel, IA classifica os itens.
- Deno: leitura do RPC de segredo na Edge (CI).

## Riscos / segurança
- `fn_obter_segredo_integracao` só pode ser chamável por service_role — nunca por `authenticated`
  (senão vaza segredo). Testar a guarda (pgTAP/CI).
- Nunca logar a chave; erro nunca ecoa o valor.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate (typecheck/vitest/biome/lint:migrations)
- [ ] Migration aplicada em prod com verificação
- [ ] Chave só no Vault, guarda service_role testada, nunca reexibida/logada
- [ ] Import de inspeção validado com chave da UI (Lucas)
- [ ] ROADMAP.md + STATE.md atualizados
