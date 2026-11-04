# ADR-1176 — Confirmação da tarefa T−24 por leitura posterior

Status: proposta local, não aplicada nem homologada.

Preparar comando privado de serviço que aceita leitura normalizada de tarefa apenas para tentativa iniciada e fence atual. Compara identidade, técnico, data, alvo e questionário com fotografia esperada; revalida ator, ciência e fontes. Na mesma transação vincula o ID à OS, marca candidata confirmada e outbox enviada, registra auditoria e recibo idempotente. Divergência, cancelamento, revisão alterada ou contenção não pode declarar sucesso. IDs observados não são aceitos de navegador.

A leitura fornecida pelo serviço ainda exige procedência comprovada e contrato Auvo validado; uma comparação JSON não prova a origem. O executor deve encaminhar divergência e respostas tardias à reconciliação. Gate permanece fechado e função sem EXECUTE. Validar campos, unicidade, replays, concorrência, callbacks tardios, travas, todos os gatilhos, RLS/FORCE, contrato remoto e revisão adversarial antes de ativar.
