# ADR-0549 — Remoção explícita de característica

Remover uma chave de característica exige comando autorizado, motivo, revisão do Grupo e registro auditado antes/depois. A guarda 0772 permanece ativa para escritas sem autorização transacional interna; demais chaves são preservadas. Nenhuma exclusão de histórico ocorre. Gate desligado e sem concessão; revisão adversarial, concorrência e testes antes de habilitar.
