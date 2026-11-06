---
name: "supabase-tests-manual-e01-s165-avaliacao-tardia-visita-concorrencia-1741-md"
description: "Documento Sinérgica SO: Avaliação tardia e geração substituta de Visita"
alwaysApply: false
---

# Avaliação tardia e geração substituta de Visita

Usar somente clone descartável com migrations até 1741. Preparar `manual_E01-S165_fluxo_nova_visita_1705.sql` até antes da geração, usando `manual_E01-S165_aprovacao_nova_visita_1703.sql` com gate `sso_protocolo_revisao_1731_gate` habilitado exclusivamente no clone em lugar da substituição da guarda 1045. Avanço de data civil é simulado apenas no clone. Executar retirada da fila anterior e confirmar a preparação sintética.

Montar somente no clone, com `session_replication_role=replica`, plano legado, ocorrência e ponte sintéticos ligados à preparada antiga terminada em 161; a ponte e suas referências são simuladas, não comprovam a jornada de criação da ponte. A geração é feita com triggers normais pela RPC autenticada `pcm.sso_preparar_visita_canonica` para a Visita 083, versão 181, com revisão e rotina da escolha 231.

Na sessão A, inserir avaliação para a legada e manter transação aberta. A geração em B deve receber `55P03`. Confirmada a avaliação, geração deve recusar `origem_antiga_exige_reconciliacao`. Na ordem inversa, manter geração aberta: inserção deve aguardar ou atingir `lock_timeout`. Reverter ambas as transações e descartar o clone.

As duas ordens e a recusa de avaliação preexistente passaram. Teste usa ponte sintética e relógio simulado; não comprova todos os caminhos de vínculo nem efeitos externos. A guarda 1045 real permaneceu intacta; nenhuma tarefa Auvo foi criada.
