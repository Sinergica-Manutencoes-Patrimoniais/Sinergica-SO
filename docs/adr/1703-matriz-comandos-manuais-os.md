---
name: adr-1703
description: Matriz de transições do RPC e dos controles manuais de OS.
alwaysApply: false
---

# Matriz de transições dos comandos manuais de OS

E01-S200, DEF-52 e DEF-35. A matriz de transições governa os comandos manuais de OS no cartão, detalhe e lote, inclusive com a flag antiga desligada. O RPC existente é exclusivo da interface web. O banco verifica a origem sob lock e mantém a autorização por Cliente para concluir a OS. Os escritores automáticos continuam nos comandos existentes.

O caminho manual de Em execução para Validação PCM segue E01-S200 AC-1 enquanto o PCM define as fontes de evidência aceitas, as exceções e a trilha de auditoria. A mudança de fase manual não registra retorno de campo. Validação PCM pode devolver a OS a Em execução conforme AC-3.
