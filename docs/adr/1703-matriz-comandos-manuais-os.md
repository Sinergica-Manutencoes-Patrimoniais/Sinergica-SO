---
name: adr-1703
description: Matriz de transições do RPC e dos controles manuais de OS.
alwaysApply: false
---

# Matriz de transições dos comandos manuais de OS

E01-S200, DEF-52 e DEF-35. A matriz de transições governa os comandos manuais de OS no cartão, detalhe e lote. A matriz é obrigatória e a antiga flag de ativação foi retirada. O RPC existente é exclusivo da interface web. O banco verifica a origem sob lock e mantém a autorização por Cliente para concluir a OS. Os escritores automáticos continuam nos comandos existentes.

O caminho manual de Em execução para Validação PCM segue E01-S200 AC-1 enquanto o PCM define as fontes de evidência aceitas, as exceções e a trilha de auditoria. A mudança de fase manual não registra retorno de campo. Validação PCM pode devolver a OS a Em execução conforme AC-3.

A migration da matriz usa 1905 após a reserva de 1904 para o DEF-23 no PR #129. A revisão da
view em 1906 mantém o filtro de ponto de E01-S142 no banco antes da contagem e da paginação,
inclusive para acentos decompostos e espaços externos. A ordem preserva o Chamado sintético em
Demanda na view introduzida em 1861.

O encerramento atestado de E01-S168 mantém o comando privado, com os gates, a autorização
por Cliente e as verificações de retorno, cobertura e revisão vigentes. A migration 1907 grava
a finalização dentro desse comando após as verificações e preserva o registro auditado e o
replay. A presença de uma atestação não libera um salto pelo RPC manual.
