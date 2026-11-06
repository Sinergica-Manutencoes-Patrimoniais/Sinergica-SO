# ADR-0747 — Fronteiras de concorrência para calendário vencido

## Status

Investigação complementar à ADR-0732. Não aprova abertura de gate, materialização de ciclo vencido, migração 0968, tarefas Auvo ou execução em produção.

## Evidências do inventário

- `0766` prepara sob lock do Plano SSO; `0764` bloqueia primeiro a preparada e depois o Plano SSO e legado. O encadeamento exige ordem comum, não comprovada apenas por unicidade de inserção.
- O gerador `0224` é executável por `authenticated` e `service_role`, lê o Plano Preventivo legado sem `FOR UPDATE` e cria ocorrências até a data solicitada; chave `(plano_id, indice)` não relaciona um ciclo SSO ou uma agenda PMOC a outro plano legado.
- `0796` também insere ocorrência legada; `0228`, `0308` e `pcm-preventivas-confirmar` atualizam resultado ou ocorrência. Os escritores de revisão/estado SSO incluem `0416`, `0419`, `0271`, `0708` e `0712`.
- O gate `0787`, desligado por padrão, coordena escritas de preparadas, ocorrências, pontes e OS via advisory lock não bloqueante; não cobre atualização de Plano Preventivo, Plano SSO ou `pmoc_schedules`. Um trigger posterior à obtenção de um lock de linha não garante ordem global.
- `supabase-pmoc-adapter.ts` cria propriedade, contrato, agenda e equipamentos em requisições distintas; `pcm-auvo-webhook` e o cron `0105` atualizam agenda. Adicionar um lock apenas à inserção da agenda não torna esse fluxo inteiro atômico nem garante identidade entre origens.
- Na definição `0023`, `pmoc_schedules` identifica contrato, propriedade, data e tipo, não uma Rotina/alvo SSO. A verificação de coincidência de data das ADRs anteriores não demonstra equivalência funcional e não deve ser usada para deduplicação automática.

## Encaminhamento técnico para revisão

Manter fail-closed o tratamento operacional individual. Antes de 0968: inventariar privilégios e funções finais no banco e chamadas indiretas; projetar uma identidade ou vínculo explícito auditável entre as origens, sem criar vínculo por coincidência de data; especificar aquisição do mesmo lock antes de locks de linha em todas as fronteiras participantes, com retry não bloqueante e revalidação após adquiri-lo. A coexistência com fluxo PMOC multipartes requer protocolo próprio, não apenas trigger isolado. Não desativar ferramentas legadas como efeito colateral de uma migration opt-in.

Ensaios em banco descartável devem usar barreiras verificáveis, timeout e duas sessões: geração SSO versus gerador legado; revisão de Plano versus materialização; PMOC versus SSO depois de vínculo comprovado; e mudanças de versão, gate ou autorização. Verificar ambos sentidos da ordem, rollback completo, ausência de chamadas externas e preservação das operações com gates desligados. A ausência de identidade comprovável permanece bloqueio de liberação, não uma nova decisão operacional de Fabrício.
