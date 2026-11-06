# ADR-0201 — Feriados declarados com fonte por Cliente/contrato

Status: proposta, não homologada.

Gestor individual de Plano declara uma data civil de feriado para Cliente ou contrato do mesmo Cliente, com fonte textual e motivo. Pode retirar declaração por comando separado, com revisão esperada e motivo; a fonte original e histórico são preservados. Consulta por contrato inclui declarações gerais e específicas, sinalizadas. Nenhum dado é inferido, obtido por rede ou considerado oficial; lista vazia não prova ausência de feriados. Não gera Visita, ocorrência, supressão ou tarefa.

Gate e RPCs ficam fechados. Pendentes: correção/reativação, fonte oficial verificável, escopo municipal, fuso, duplicidades globais, integração de materialização com exceções e histórico, testes de autorização/concorrência e revisão adversarial. Não usar a consulta como lista completa ou como confirmação de feriado legal.
