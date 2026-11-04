# ADR-1180 — Montagem explícita do payload Auvo T−24

Status: proposta local, não conectada nem homologada.

Preparar montagem pura de criação e alteração usando fotografia da candidata, fuso, variantes de campos e mapa de prioridades fornecidos por contrato comprovado. Não escolher automaticamente entre `taskType` e `taskTypeId`, entre representação singular e lista do equipamento, nem aplicar prioridade padrão. Sem mapeamento, ID numérico seguro, data representável ou limite explícito de orientação, bloquear. Uma corretiva sem questionário não recebe questionário preventivo.

A marca de contrato no parâmetro não é prova de procedência; fonte do contrato, persistência, busca completa, comportamento PATCH/GET e autorização precisam ser validados antes de qualquer conexão. A função não faz rede. Validar Unicode/limites do fornecedor, fusos, precisão, prioridade e revisão adversarial antes de habilitar.
