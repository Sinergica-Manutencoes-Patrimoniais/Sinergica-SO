# ADR-1018 — Histórico privado das fontes do orçamento

Status: preparação privada, não homologada.

Preparar leitura paginada das parcelas congeladas em uma composição por Cliente, proposta e versão. O servidor valida vínculo atual com Cliente, permissões de orçamento, despesa e custos, identidade, gate e unicidade da composição. A leitura apresenta a fotografia registrada no momento da composição; não infere que a despesa atual permaneça igual nem que outras origens tenham sido cobertas.

Descrição e valores são privados e não devem chegar ao Portal. Função nasce privada e gate fechado. Validar RLS/FORCE, revogação, integridade dos recibos, paginação, histórico legado, volume, privacidade e revisão adversarial antes de conceder acesso. Nenhum dado ou versão é alterado.
