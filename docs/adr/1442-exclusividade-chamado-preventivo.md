# ADR 1442 — Exclusividade da origem preventiva

Quando um ciclo já possui Chamado preventivo, novas OS pelo vínculo legado e novos vínculos de Grupo devem apontar ao mesmo Chamado. Origens ambíguas são recusadas. Os comandos de criação de Chamado conferem OS já existentes e serializam os vínculos com travas de tabela; registros anteriores não são reescritos.

Essa proteção não substitui a reconciliação de OS antigas nem integra os consumidores de envio e retorno. Validar interações, concorrência, locks e a migração coordenada de múltiplas OS antes de habilitar; revisão adversarial obrigatória.
