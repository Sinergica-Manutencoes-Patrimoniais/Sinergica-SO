# ADR-0980 — Reconciliação de parcela em ciclo posterior

Status: preparação privada, não homologada.

As consultas e o comando de reconciliação existentes operam por parcela e atribuição, sem exigir o vínculo legado. Preparar mediadores que acrescentam Cliente, ciclo posterior e ator esperado, validam capacidades e origem da promoção, serializam a autorização e delegam aos fluxos existentes. O registro continua uma declaração humana, não prova parada e não autoriza devolução automaticamente. A repetição preserva o histórico e a identidade do pedido.

Os mediadores não concedem EXECUTE e devem permanecer com os gates existentes fechados. Revisar lock global e ordem de Chamado/ciclo/parcela, replay após mudança de ciclo, autorização e RLS, atualizações de evidência e de OS, concorrência e consumidores antigos; executar testes integrados e revisão adversarial antes de ativar. Sem produção ou Auvo real.
