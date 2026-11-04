# ADR-0050 — Preparação de nova versão após aprovação

**Status:** decisão para implementação local E01-S165. **Data:** 2026-10-27.

Para Plano aprovado ainda não ativo, o gestor pode iniciar uma revisão a partir do snapshot da versão aprovada mais recente. A operação cria uma nova versão de rascunho e novas linhas de Rotina, preservando o identificador lógico de cada Rotina, sem modificar a versão anterior nem gerar eventos operacionais. A origem dos campos é o snapshot, não as linhas atuais de catálogo ou Rotina. A identidade de cada nova linha é criada pelo servidor e devolvida no resultado idempotente; requestId, revisão e autorização são verificados transacionalmente e a mudança é auditada.

Esta primeira etapa não cria revisão de Plano ativo: separar estado operacional e edição, prever efeitos em ocorrências/OS e estabelecer vigências não sobrepostas é necessário antes desse caso. Não disponibilizar o comando na interface até que a aprovação de nova versão trate intervalos de vigência, a prévia de impactos e a concorrência. Isto limita o incremento técnico local, não altera as regras aprovadas nem declara a story concluída.
