# ADR-1125 — Supressão de Visita futura sem vínculos ao mudar dia

Status: proposta local, não aplicada nem homologada.

Na mudança transacional de dia, uma Visita regular futura não confirmada cuja nova data coincida com feriado declarado poderá ser cancelada localmente e sua semana marcada como suprimida na mesma transação, somente se não houver ocorrência preparada ou vínculo de OS. São preservados ID e histórico da Visita; nenhuma OS, ocorrência ou tarefa é criada. A supressão usa a nova regra, a revisão do feriado, o lock da semana e o registro imutável existente. O operador precisa também da capacidade de cancelar Visita.

O estado técnico cancelado não deve ser confundido com indicador operacional de cancelamento: consumidores devem excluir semanas suprimidas dos indicadores, capacidade e cronogramas antes da liberação. Casos com ocorrências, vínculos ou efeitos externos continuam recusados para reconciliação; a alteração não apaga evidências nem valida parada remota. Gate fechado até adaptação de todos os consumidores, provas de concorrência/replay, RLS e revisão adversarial.
