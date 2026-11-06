# ADR-0463 — diagnóstico sanitizado de falha na fila

Status: proposto; não aplicado nem homologado. A consulta revalida Cliente, capacidade e objeto de Sistema/Equipamento, e expõe somente estado persistido, tentativas e presença de mensagem de erro, sem revelar ou classificar texto bruto. Estado remoto é desconhecido, inclusive após erro; nenhuma operação na fila ocorre. A tabela não é trilha imutável de falhas e o diagnóstico não substitui histórico de tentativas. Gates/grants fechados; revisão de escopo e testes antes de habilitar.
