# Research — E01-S167

## Decision

trocar conversão única por criação N:1 idempotente, referência OS única e read-model de Chamado com várias OS sem cards duplicados; registrar escopo resolvido/restante, continuação com validação PCM, aptidão calculada e encerramento explícito com retorno de escopo.

## Evidence and Reuse

- `apps/web/src/features/pcm/application/chamados.ts`
- `apps/web/src/features/pcm/infrastructure/supabase-chamados-adapter.ts`
- `apps/web/src/features/pcm/components/ChamadoPainel.tsx`
- `supabase/migrations/0171_E01-S129_uma_os_por_chamado.sql`
- `supabase/migrations/0151_E01-S99_chamado_id_unico.sql`
- `supabase/migrations/0209_E01-S151_backlog_sem_chamado.sql`

A análise desta conversa verificou código/migrations da branch baseada em 22aca391. Referências legadas não são prova de implantação em produção. Reler os trechos tocados antes do teste que falha; não reconstruir relatórios de 14/10.

## Rationale

As definições posteriores do Fabrício prevalecem: Plano amplo/Rotina alvo único, modos por calendário/Visita, tolerâncias explícitas, alias administrativo e staging aprovado. Proteger os IDs e cadastros atuais reduz migração e preserva histórico.

## Alternatives considered

- Recriar módulo/cadastro com nova identidade: rejeitado; há base funcional reutilizável.
- Adaptar operação aprovada ao limite atual do código: rejeitado; limite deve evoluir por migration compatível.
- Antecipar Auvo, deploy ou Copiloto completo: fora de escopo; interfaces de recepção e doubles bastam para preparar esta fatia.

## Technical gates

Dependências E01-S170 precisam contrato estável antes da integração. APIs Auvo não comprovadas permanecem fechadas; testar depois em ambiente autorizado, com fixture até lá. P01/P02/P03 não estão abertas. Não há decisão funcional pendente nesta story; unknown de contrato real vira gate de liberação e SPEC_DEVIATION se contradizer design.

## Inventário local de compatibilidade — 2026-10-27

Revalidado contra o checkout local, não contra produção. ADR-0026/0027/0028 e contratos-programa mantêm Chamado como necessidade, OS como unidade executável e autorização atual no servidor. A fundação de capacidades E01-S170 existe localmente, sem homologação; não pressupor concessões aos usuários atuais.

- `application/chamados.ts` consulta uma OS existente por Chamado e, em erro de criação, volta a procurar uma OS antes de marcar o vínculo singular. Esse retry não distingue comandos novos de repetição e não pode governar 1:N.
- `supabase-ordem-servico-adapter.ts` usa `maybeSingle()` por Chamado, insere OS diretamente e atualiza vínculo e estado em chamadas separadas. A confirmação posterior de Chamado também altera o número explicitamente. Substituir cada caminho por comandos transacionais compatíveis antes de liberar múltiplas OS; preservar a função de conversão legada até migração dos consumidores.
- `0171` impõe uma OS ativa por Chamado; `0151` e sua evolução `0209` definem trigger de número. Remover somente o índice não resolve a unicidade numérica, os writers ou retries. `0224` também impõe unicidade da OS por ocorrência preventiva; não removê-la antes de mapear origem da ocorrência e consumidores.
- `pcm.operacao_itens` em `0208` apresenta uma linha por OS e uma linha sintética de Chamado aberto sem OS. A lista de execução pode manter OS individuais, mas o quadro gerencial de AC-2 precisa de projeção agrupada por Chamado sem supor que esta view já oferece um card único.
- `supabase-chamados-adapter.ts`, `supabase-ordem-servico-adapter.ts`, `pcm-auvo-tasks-import`, `pcm-ze-agent`, `_shared/auvo/os-from-task.ts` e fluxo preventivo são consumidores/escritores relevantes; inventário completo de RPCs, políticas, Portal e dados efetivos permanece gate antes de alterar constraints. As chamadas externas existentes não são autorização para disparo real.
- ADR-0090 e migration local `0312` preparam leitura restrita e paginada, ainda não integrada nem implantada. Ela não prova snapshot entre páginas, escrita 1:N ou permissão de todos os leitores. Caracterização em banco isolado mostrou vínculo com Cliente divergente possível no legado e restrição 1:1 ainda ativa; corrigir por migração aditiva e conferência, sem apagar registros.

Sequência segura: inventário e testes de compatibilidade; contrato transacional com requestId e revisão; adaptar leitores e escritores e proteger origem/Cliente; só então planejar remoção das restrições antigas, com numeração nova única e preservação do legado. CI/db-tests, concorrência real e revisão adversarial continuam obrigatórios.
