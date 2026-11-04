
# ADR-0535 — Fuso declarado para o Plano

Status: preparado, gate desligado, não aplicado nem homologado. O cadastro atual de Plano SSO não possui vínculo de contrato nem fuso; o fuso de Visitas ou Plano Preventivo legado não é prova de fuso do Plano. PCM pode declarar fuso IANA, fonte, motivo e opcionalmente contrato de referência do mesmo Cliente, com revisão e auditoria.

Contrato de referência não prova vínculo contratual nem valida a fonte, e este cadastro não é usado automaticamente para geração, aprovação ou vencidos. Os caminhos que usam UTC permanecem bloqueados até decisão de política, comprovação/vigência da fonte, alteração transacional, testes e revisão adversarial; não se presume fuso.
