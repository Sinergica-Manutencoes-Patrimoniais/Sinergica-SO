# ADR-0229 — Ocorrência preparada por Visita contratual identificada

Status: proposta, não homologada.

Comando privado associa explicitamente Rotina lógica aprovada à série do mesmo Cliente. Outro comando gera somente registro preparado por Rotina, alvo, série e semana de origem da Visita regular 0313, após conferir vigência, ciclo semanal, origem Plano e declaração humana de fonte para dia sem feriado. Feriados já declarados ativos bloqueiam. Unicidade e requestId preservam identidade na repetição; não cria ocorrência legada, OS ou tarefa Auvo.

Lista declarada de feriados não é fonte oficial completa; declaração humana não prova ausência de feriado. Faltam fonte confiável, suprressão auditada integral, integração à fila oficial, recorrências não semanais, conflito PMOC, versões e consumidores, concorrência, testes e revisão adversarial. RPCs revogadas e gates fechados; não ativar isoladamente.
