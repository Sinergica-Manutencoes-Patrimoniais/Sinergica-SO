---
name: tasks
description: Decomposição e gates de E02-S37. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E02-S37 · Mídia recebida pela Evolution

## Plano

| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | `_shared/evolution-midia.ts` — porte direto (mimes, limites, saneamento, textos) | AC-2, AC-4, AC-10 | — | `deno test .../evolution-midia.test.ts` (15 testes) | done |
| 2  | Migration `1852` (renumerada de `1833`) — colunas, CHECKs, buckets | AC-14 | — | `supabase test db` — `midia_recebida.test.sql` | done — **SPEC_DEVIATION** |
| 3  | RPC de ingestão de mídia/aviso (reserva + mensagem + texto do agente) | AC-7, AC-11 | 2 | idem, 6 asserts | done (sem `fn_pode_ler_conversa` — não há proxy novo, ver SPEC_DEVIATION) |
| 4  | Migration de transcrição na mesma mensagem | AC-8, AC-9 | 2 | — | **não se aplica** — não existe transcrição de áudio hoje na Sinérgica, nada a corrigir |
| 5  | `ingerir-midia.ts` — pipeline de conferência | AC-2, AC-3, AC-5, AC-12 | 1, 3 | `deno test .../handler.test.ts` (4 testes novos cobrindo a matriz) | done |
| 6  | Webhook despacha `midia` e `aviso` para a RPC | AC-1, AC-11 | 5 | idem | done |
| 7  | `atendimento-anexo` — proxy autenticado | AC-6 | 3 | — | **não construído — SPEC_DEVIATION** |
| 8  | `domain/mensagens.ts` — conteúdo tipado, anexo, aviso `[P]` | AC-1 | 2 | — | todo |
| 9  | `MensagemBubble.tsx` — imagem com lightbox, vídeo, documento, figurinha, aviso, transcrição | AC-1, AC-8, AC-9 | 7, 8 | — | todo |
| 10 | Pipeline do Zé lê `texto_para_agente`; mídia sem legenda pausa a conversa | AC-10 | 3 | — | todo (texto já é gravado corretamente; a pausa automática da conversa não foi ligada ao agendador do Zé) |
| 11 | Auditoria de log: nenhum campo proibido `[P]` | AC-13 | 6 | leitura do código — `ingerir-midia.ts` nunca loga nome/legenda/conteúdo | done (sem teste automatizado) |
| 12 | Regressão de texto, emoji e áudio `[P]` | AC-15 | 9 | suíte completa de `supabase/functions` (421 testes, 0 falhas) | done |
| 13 | Débito em `docs/SECURITY_DEBT.md`: exclusão a pedido precisa apagar mídia guardada | — | 2 | revisão humana | todo |
| 14 | Glossário: anexo, estado do anexo, aviso recebido, texto para o agente | — | — | — | todo |
| 15 | `/revisao-adversarial` (tier arquitetural) | todos | 12 | achado reproduzido vira teste | todo |

## SPEC_DEVIATION registrada

`plan.md` previa colunas `anexo_bucket`/`anexo_path`/`anexo_nome`/`anexo_mime`/
`anexo_tamanho_bytes`, bucket novo `atendimento-midias` com `allowed_mime_types` e proxy
`atendimento-anexo` com RLS por `service_role`. **A Sinérgica já tinha**, desde a migration
`0063_E02-S21` (antes deste porte começar): bucket `atendimento-midias` (sem restrição de mime,
20MB) e colunas `mensagens.midia_url/midia_nome/midia_mime`, com RLS **por sessão** no
`storage.objects` (mesma granularidade de `conversas_select`: `authenticated` + módulo
`atendimento`), e o adapter do app já gera signed URL a partir de `midia_url`. Reaproveitar é menos
código e mais consistente com o resto do inbox. Resolução: `plan.md` fica desatualizado nesse
ponto (apontado aqui, não reescrito); a migration `1852` eleva só o `file_size_limit` do bucket
existente (20→25MB), sem mexer em RLS. **Consequência real:** AC-6 ("mesma resposta 404 pra quem
não pode ler") não tem o mesmo nível de garantia por mensagem que um proxy teria — a granularidade
é por módulo, igual ao resto do sistema, não por conversa individual. Isso é uma divergência
aceitável SE a app não tiver ACL por conversa em nenhum outro lugar (parece ser o caso), mas não
foi verificado a fundo — fica registrado aqui para revisão humana.

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
