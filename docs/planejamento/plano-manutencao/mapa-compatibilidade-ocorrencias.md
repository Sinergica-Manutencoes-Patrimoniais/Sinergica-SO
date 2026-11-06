# E01-S166 — Inventário inicial de compatibilidade de Ocorrências

Estado em 2026-10-27: **parcial; não autoriza gerar Ocorrências de origem nova**. Complementa ADR-0075. Referências abaixo foram verificadas no código local; políticas também foram conferidas no banco local. Falta levantamento exaustivo de funções, permissões, integrações e dados de produção.

## Contratos existentes que não podem ser quebrados

| Superfície | Comportamento observado | Consequência para origem nova |
| --- | --- | --- |
| `supabase/migrations/0224_E01-S53_preventivas_pcm.sql` | `plano_id` obrigatório aponta a `planos_preventivos`; `(plano_id, indice)` e `chave_externa` são únicos; OS possui índice único por `ocorrencia_preventiva_id`. | Não fabricar Plano legado nem remover constraints sem estratégia testada; cardinalidade de OS do novo fluxo exige evolução explícita e preservação das OS antigas. |
| `materializar_ocorrencias_preventivas` na migration 0224 | Materializa ciclos desde a primeira data de Plano preventivo legado e usa `PREV-{plano}-{indice}`; chamada com escrita PCM/service role. | Manter escritor legado restrito ao legado; não chamar para Plano/Rotina novos. |
| Políticas das três tabelas em 0224 e 0305 | A política original concede leitura por módulo PCM amplo ou superadmin, sem filtro de Cliente. `0305` restringe essa política à origem legada, inclusive para avaliações e achados; legado continua amplo. | Testar políticas combinadas, relações indiretas e dois Clientes antes de qualquer dado novo; service role continua privilegiado. |
| `apps/web/src/features/pcm/infrastructure/supabase-preventivas-adapter.ts` | Consulta Planos legados por Cliente, Ocorrências por `plano_id`, avaliações e OS por seus IDs. Bloqueia alteração estrutural de Plano com Ocorrências. | Leitura nova precisa de contrato próprio, sem sumir do fluxo nem quebrar legado; teste de isolamento não pode depender só do filtro da interface. |
| `apps/web/src/features/pcm/infrastructure/supabase-detalhe-sistema-adapter.ts` | Histórico do Sistema deriva Ocorrências de IDs de Planos preventivos legados e consulta OS por vínculo. | Incluir origem nova de modo explícito no 360/histórico, sem duplicar resultados nem inferir alvo pelo Plano antigo. |
| `supabase/functions/pcm-preventivas-confirmar/index.ts` | Lê Ocorrência, reserva envio e carrega `planos_preventivos` por `ocorrencia.plano_id` antes de construir OS/tarefa. | Não expor origem nova a este escritor até separar roteamento, autorização por Cliente, concorrência e contrato Auvo. Um erro após reservar pode deixar estado incerto. |
| `supabase/functions/pcm-preventivas-enviar-backlog/index.ts` | Parte de avaliação, obtém `ocorrencia.plano_id` e dele Cliente/alvos para criar OS de achado, usando serviço privilegiado. | Novo caminho deve validar origem e acesso atual no servidor, resolver Cliente/alvo da nova origem e preservar idempotência; filtro de UI ou RLS da leitura não protege service role. |
| `pcm-auvo-tasks-import` e `pcm-auvo-webhook` | Importação encontra Ocorrência pela OS/tarefa e grava avaliações; webhook sincroniza resultado pela OS. `0226` define upsert de avaliações e `0228` atualiza resultado histórico. | Provar que tarefas e OS de ambas as origens não se confundem; adaptar e testar autorização/isolamento e correlação antes de habilitar integração nova. |
| `0225_E01-S53_auditoria_preventivas.sql` | Triggers auditam Ocorrências, avaliações e achados. | Preservar auditoria e verificar comportamento com colunas/origem novas e transações concorrentes. |

## Próximos gates técnicos

1. Inventariar constraints, índices, triggers, políticas e funções efetivos do banco alvo, incluindo scripts fora de `apps/web`/`supabase` e dependências indiretas. Conferir quantidade/cardinalidade real das OS e possíveis consumidores externos antes do rollout.
2. Preparar testes que provem acesso negado entre Clientes também por avaliações e achados, com usuário PCM legado, gestor novo e service role controlado; testar cada Edge Function e chamada legada com origem indevida.
3. Definir e testar migração aditiva, identidade estável entre versões e cancelamentos, caminho de reversão, múltiplas OS por Chamado/Ocorrência e impacto de índices existentes. Não alterar cadastros, UUIDs ou códigos legados.
4. Apenas depois liberar escrita de origem nova com snapshot aprovado, revisão, auditoria e idempotência transacional. Validar concorrência, feriados, vencidos, recuo, consumidores e revisão adversarial antes de PASS.

Nenhuma tarefa foi enviada ao Auvo e nenhum dado operacional foi alterado neste levantamento.
