---
name: tasks
description: Decomposição e gates — canais Meta (WA/Templates/Instagram/Messenger).
alwaysApply: false
---

# Tasks — Config de canais Meta

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `NNNN_E02-S16_atendimento_canais_meta.sql` (config por canal + status; segredos referenciam Vault; RLS FORCE + grant) | AC-1,AC-2,AC-3,AC-4 | — | `supabase test db` | done |
| 2  | Domínio + use-cases: conectar/salvar Meta WA, CRUD Templates, conectar Instagram/Messenger | AC-1,AC-2,AC-3 | — | test do caso de uso | done |
| 3  | Adapter Supabase + tratamento de segredo (nunca no client) | AC-1,AC-2,AC-3 | 1,2 | test do adapter | done |
| 4  | Abas `MetaWATab`/`WhatsappTemplatesTab`/`InstagramTab`/`MessengerTab` + status de conexão + gating | AC-1,AC-2,AC-3,AC-4 | 2,3 | test de componente | done |
| 5  | `pnpm run ci:local` + paridade heziomos + ROADMAP/STATE | todos | 1–4 | `pnpm run ci:local` | done |

## Plano de teste
- Integração: RLS/adapter, segredo fora do client. Componente: 4 abas + status + gating. Aceite: 1 por AC.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Nenhum segredo Meta no client (`docs/SECURITY_DEBT.md` se houver dívida)
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
