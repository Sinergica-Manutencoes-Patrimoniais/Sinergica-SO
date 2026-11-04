# ADR-0978 — Declaração de interrupção de ciclo posterior

Status: preparação privada, não homologada.

Preparar comando para declarar ou revogar interrupção em parcela de ciclo posterior ativo, pois o comando legado exige vínculo permanente que pertence à parcela anterior. O comando reutiliza atribuições, estados, eventos e auditoria existentes; exige ator esperado, capacidade, suspensão, revisão, ciclo e OS associados. A declaração é administrativa: não interrompe execução nem comprova parada remota.

Gate e EXECUTE permanecem fechados. Antes de qualquer ativação, conectar seleção e interface autorizadas, migrar consumidores legados, comprovar protocolo de parada, revisar locks e fontes de autorização, RLS/FORCE, condições de repetição e todas as transições, executar testes integrados e revisão adversarial. Não aplicar em produção nem enviar tarefas.
