# ADR-0114 — Mudança versionada do dia contratual

**Estado:** proposta fechada, não aplicada nem homologada. Complementa ADR-0053 e ADR-0091.

## Decisão

Mudança futura cria versão da mesma série e encerra a vigência anterior no dia imediatamente anterior; conserva âncora semanal, intervalo, horário, fuso, duração e deslocamento. A escrita é transacional, autorizada por `plano.gerir`, revisionada pelo número da última regra, auditada e idempotente. Gate privado fechado e EXECUTE revogado.

Como ainda não há mecanismo seguro de adequação transacional das Visitas materializadas, o comando recusa mudança se existir qualquer Visita regular originada da série na faixa futura; não mexe em extras, reprogramações, históricos, feriados ou referências Auvo. Essa restrição é provisória e não cobre todo AC-3; removê-la requer projetar a adaptação seletiva das Visitas não confirmadas, preservar exceções e proteger concorrência com todos seus escritores.

Não criar ocorrências pelo mecanismo antigo: ele não conhece identidade Rotina + alvo + ciclo, revisão e origem PMOC nem garante baseline. O comando de materialização permanece pendente até se definirem persistência canônica e relação com fontes de feriados e cronogramas; nenhum atalho deve declarar AC-1/AC-5 concluído.

## Riscos e rollout

Antes de aplicar, testar autorização/revogação concorrente, ordem de locks, dados legados, atualização de vigência, concorrência com criação de Visita/feriado, fuso e comportamento das triggers. A consulta de Visitas não bloqueia inserções concorrentes feitas por escritores legados. A projeção de calendário e tratamento de feriados não estão completos. Sem ligar gate ou fazer deploy antes de CI/db-tests e revisão adversarial. Mudança é incompatível com um simples rollback depois de produzir histórico; não apagar versões.
