---
name: tasks
description: Decomposição e gates de E02-S37. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E02-S37 · Mídia recebida pela Evolution

## Plano

| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | `_shared/evolution-midia.ts` — porte direto (mimes, limites, saneamento, textos) | AC-2, AC-4, AC-10 | — | `deno test supabase/functions/_shared/evolution-midia.test.ts` | todo |
| 2  | Migration `1833` — colunas, CHECKs, índice de derivada, buckets privados | AC-14 | — | `pnpm run db:test -- midia_recebida` | todo |
| 3  | `fn_pode_ler_conversa` + RPC de ingestão de mídia/aviso (reserva + mensagem + texto do agente) | AC-7, AC-11 | 2 | `pnpm run db:test -- ingerir_midia` | todo |
| 4  | Migration `1834` — transcrição na mesma mensagem | AC-8, AC-9 | 2 | `pnpm run db:test -- transcricao_unica` | todo |
| 5  | `ingerir-midia.ts` — pipeline de conferência (matriz de decisão completa) | AC-2, AC-3, AC-5, AC-12 | 1, 3 | `deno test supabase/functions/atendimento-evolution-webhook/ingerir-midia.test.ts` | todo |
| 6  | Webhook despacha `midia` e `aviso` para a RPC | AC-1, AC-11 | 5 | `deno test supabase/functions/atendimento-evolution-webhook/handler.test.ts` | todo |
| 7  | `atendimento-anexo` — proxy autenticado (404 indistinguível, cabeçalhos) | AC-6 | 3 | `deno test supabase/functions/atendimento-anexo/index.test.ts` | todo |
| 8  | `domain/mensagens.ts` — conteúdo tipado, anexo, aviso `[P]` | AC-1 | 2 | `pnpm vitest run apps/web/src/features/atendimento/domain/mensagens.test.ts` | todo |
| 9  | `MensagemBubble.tsx` — imagem com lightbox, vídeo, documento, figurinha, aviso, transcrição | AC-1, AC-8, AC-9 | 7, 8 | `pnpm vitest run apps/web/src/features/atendimento/components/MensagemBubble.test.tsx` | todo |
| 10 | Pipeline do Zé lê `texto_para_agente`; mídia sem legenda pausa a conversa | AC-10 | 3 | `deno test supabase/functions/pcm-ze-agent/midia.test.ts` | todo |
| 11 | Auditoria de log: nenhum campo proibido `[P]` | AC-13 | 6 | `deno test ... --filter "log sem conteudo"` | todo |
| 12 | Regressão de texto, emoji e áudio `[P]` | AC-15 | 9 | `pnpm vitest run apps/web/src/features/atendimento` | todo |
| 13 | Débito em `docs/SECURITY_DEBT.md`: exclusão a pedido precisa apagar mídia guardada | — | 2 | revisão humana | todo |
| 14 | Glossário: anexo, estado do anexo, aviso recebido, texto para o agente | — | — | `grep` em `docs/glossary.md` | todo |
| 15 | `/revisao-adversarial` (tier arquitetural) | todos | 12 | achado reproduzido vira teste | todo |

## Plano de teste

- **Unidade:** `sanearNome` com `../../etc/passwd`, nome de 400 chars, caracteres de controle, nome
  vazio, nome sem extensão; `mimeAceito` por conteúdo; `extensaoPerigosa` com `.svg`, `.html`, `.jar`,
  `.PDF.exe`; `textoParaAgente` com e sem legenda; `textoDeMidiaNaoGuardada` nos 3 estados.
- **Integração (pipeline):** **todas as 8 linhas da matriz de decisão** da spec, com fake de download
  (`fetch` injetado) devolvendo: arquivo bom, 0 bytes, acima do limite, mime divergente do declarado,
  erro de rede, timeout.
- **Integração (proxy):** usuário sem acesso recebe `404` **idêntico** ao de anexo inexistente;
  cabeçalhos corretos por tipo; `mensagemId` inexistente; rate limit.
- **DB (pgTAP, `db-tests` não pulado):** CHECK recusa `anexo_bucket` em mensagem de saída; recusa
  `anexo_estado='guardado'` sem bucket/path; índice de derivada única; idempotência de mídia repetida;
  transcrição grava na própria mensagem e não cria segunda linha.
- **Aceite:** um teste por AC-1..AC-15.
- **Smoke real (antes do PASS):** de um celular, mandar para o canal de teste os 7 tipos — texto,
  emoji, áudio, imagem com legenda, imagem sem legenda, vídeo, PDF, figurinha, localização — e conferir
  os 9 na conversa em até 30 s cada.

## Divergências (SPEC_DEVIATION)

- [ ] <task # · motivo · resolução: corrigir código OU atualizar spec/ADR>

## Checklist de Definition of Done

- [ ] Todos os AC verdes **pelo gate executável**
- [ ] CI verde no PR (`db-tests` **não pulado**)
- [ ] Smoke real com os 9 tipos registrado no PR
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] `/revisao-adversarial` rodada
- [ ] Débito registrado em `docs/SECURITY_DEBT.md`
- [ ] Glossário atualizado
- [ ] `docs/STATE.md` atualizado via `/handoff`
