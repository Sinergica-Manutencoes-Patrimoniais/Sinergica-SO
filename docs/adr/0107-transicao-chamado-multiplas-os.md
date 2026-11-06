# ADR-0107 — Fundação revisionada para Chamado com múltiplas OS

**Estado:** proposta local; não aplicada nem homologada. Complementa ADR-0026, ADR-0090 e ADR-0104.

## Inventário e risco

`application/chamados.ts` pressupõe uma OS e usa `maybeSingle`; `supabase-chamados-adapter.ts` mantém vínculo singular. `supabase-ordem-servico-adapter.ts` cria e vincula registros em chamadas distintas, assim como a importação `pcm-auvo-tasks-import`, `_shared/auvo/os-from-task.ts` e `pcm-ze-agent`. A conversão comercial em 0151 também cria e vincula OS. A view `pcm.operacao_itens` em 0208 é por OS e não fornece um card gerencial consolidado. A lista é inventário inicial e requer verificação completa, inclusive Portal, webhook e outras funções.

O índice `uq_ordens_servico_chamado` (0171) impede segunda OS; o índice preventivo 0224 também restringe sua origem. A trigger de 0209 atribui número do Chamado à OS, cujo número é único. Uma liberação parcial provocaria colisões, leituras incorretas ou ações não idempotentes. Há triggers legadas e caminhos de outbox; nenhuma operação real Auvo é autorizada.

### Levantamento adicional de consumidores — 2026-11-01

Busca estática por acesso direto a `ordens_servico` encontrou 18 arquivos TypeScript; não inclui SQL, RPCs, views, acesso indireto ou nomes gerados dinamicamente. Não é inventário completo nem prova de compatibilidade.

- `supabase-ordem-servico-adapter.ts` ainda possui criação e vínculo em etapas separadas e recuperação singular; o leitor recusa mais de uma OS, mas não fornece recuperação idempotente de um pedido específico.
- `supabase-hub-os-adapter.ts` lista e altera status por OS; `supabase-cliente-360-adapter.ts`, `supabase-portal-adapter.ts`, `supabase-operacao-adapter.ts`, `supabase-board-ativos-adapter.ts`, `supabase-sistemas-adapter.ts` e `supabase-detalhe-sistema-adapter.ts` incluem leituras operacionais por OS. Manter granularidade de OS nessas telas não substitui o card gerencial por Chamado; verificar filtros, paginação e vínculos no fluxo completo.
- `supabase-preventivas-adapter.ts` lê ocorrências de origem legada; antes reduzia OS por ocorrência a um único registro em `Map`, escolhendo arbitrariamente quando havia mais de uma linha. A adaptação local pagina com contagem, preserva as linhas retornadas, sinaliza conferência e não escolhe OS representativa quando há múltiplas. Ainda não testada: as páginas não compartilham fotografia transacional. `pcm-preventivas-confirmar` continua esperando no máximo uma OS por ocorrência legada; demonstrar compatibilidade antes de liberar a transição, sem alterar o legado às cegas.
- `pcm-preventivas-enviar-backlog` cria OS para achado de origem legada; não equivale ao Backlog canônico da S174 e não deve ser usado como implementação da nova regra. `pcm-auvo-tasks-import`, `_shared/auvo/os-from-task.ts` e `pcm-ze-agent` criam OS e Chamado em etapas diferentes. `pcm-auvo-webhook`, `pcm-auvo-open-task` e `pcm-auvo-create-task` leem ou atualizam OS por identidade externa/ID: conferir efeitos, locks e replays na transição sem executar tarefas reais.
- Confirmar também todas as funções SQL, triggers, políticas e escritores indiretos, além de integrações comercial, PMOC e Portal. A presença de um consumidor nesta lista não significa falha comprovada; ausência não significa compatibilidade.

## Decisão e fases

1. Adicionar revisão monotônica ao Chamado e mantê-la também nos updates legados por trigger; não modifica número, referências ou status. Preparar registro privado para comandos idempotentes, com RLS FORCE e sem concessão direta a usuários. A revisão cobre updates do Chamado, não alterações independentes nas OS; estas ainda precisam de serialização própria.
2. Inventariar e reconciliar anomalias usando 0321; adaptar todos leitores de gestão e escritores, inclusive transações comerciais/Auvo, sem mudar os números legados. Definir capacidade específica para criação de OS e política de revogação concorrente; não inferir permissão a partir de `chamado.encerrar`.
3. Implementar comando transacional com locks consistentes, revisão, requestId, Cliente, escopo e audit, número único de OS, validação de estado e supressão explícita de qualquer efeito externo. Adaptar trigger de número, restrições e consumidores em rollout coordenado e após prova de compatibilidade. Não alterar índice 0171 antes disso.
4. Completar composição de escopo, continuidade e aptidão; garantir que todas OS encerradas não impliquem atendimento integral. Exigir CI, testes de concorrência, Auth/RLS e revisão adversarial antes de habilitar qualquer escrita 1:N.

## Consequências

0324 prepara comando transacional de criação, mas não concede execução e mantém gate interno fechado. O comando também recusa operar enquanto índice singular ou trigger legada de numeração estiverem presentes. A capacidade `chamado.os.criar` ainda não foi cadastrada, e sua política de revogação concorrente não foi definida. As restrições legadas permanecem; nenhum procedimento de abertura do gate está autorizado. Antes de aplicar, testar migração em banco descartável, ordem das triggers, custo/locks de backfill e interação com integrações. O comando não implementa composição integral, criação por ocorrência, continuidade ou aptidão; não basta para conclusão de S167. Rollback exige verificar ausência de dependências futuras, remover trigger e função, e somente então avaliar remoção da coluna e tabela novas; nunca apagar registros de comandos usados. Não existe rotina automatizada de rollback ou correção de dados legados nesta proposta.
