# ADR-0628 — Reconciliação humana de declarações

Decisões imutáveis e versionadas por par de declarações de serviço e material, da mesma OS e Cliente. O operador informa possível duplicidade, fatos distintos ou inconclusivo e motivo; a versão otimista evita sobrescrever decisão concorrente. O histórico é paginado e autorizado. Declaração de fatos distintos não comprova identidade física nem autoriza faturamento; dados e cobrança não são alterados. Gate fechado e sem concessões. Testar concorrência, permissões e integração antes de ativar.
