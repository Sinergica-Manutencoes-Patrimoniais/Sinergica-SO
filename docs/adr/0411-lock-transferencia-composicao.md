# ADR-0411 — locks de transferência e encerramento

Status: proposto; não aplicado nem homologado.

Encerramento de membro e desvinculação de OS usam o lock por Visita já definido na ADR-0408. Transferências preparadas usam o lock de pedido e, em seguida, os locks de ambas as Visitas em ordem crescente de UUID. Com gate fechado, nenhum lock adicional é adquirido. Grants públicos originais de encerramento/desvinculação são preservados; transferências preparadas continuam sem grants.

O protocolo ainda não cobre todas as fontes e escritores, nem elimina riscos de deadlock ou alterações via referências a funções antigas. A guarda 0632 continua fechada até inventário, revisão e testes concorrentes. Nenhum envio é realizado.
