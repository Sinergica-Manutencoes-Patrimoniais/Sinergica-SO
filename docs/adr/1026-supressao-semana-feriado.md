# ADR-1026 — Registro da semana suprimida por feriado

Status: preparação fechada, não homologada.

Preparar registro auditável de supressão por série e semana de origem, com regra e declaração de feriado observadas. A gravação exige Cliente, atores e permissões, confirma recorrência e vigência, verifica declaração aplicável e recusa quando já existe origem contratual para a semana. Trava por série/semana coordena a declaração e novas origens, sem criar Visita, ocorrência, OS ou tarefa Auvo.

Histórico é imutável. A revogação da supressão precisa ser explícita e auditada, nunca automática ao retirar o feriado; suporte de reversão e interface ainda devem ser implementados. Origem contratual ausente não prova inexistência de Visitas legadas: inventariar e reconciliar antes de ativar. Gate e EXECUTE fechados; validar concorrência, autorização, RLS/FORCE, vigência, histórico, reprogramações, fontes legadas e revisão adversarial.
