# ADR-1012 — Inventário agregado de vínculos de assessment

Status: preparação privada, não homologada.

Preparar contagem agregada de propostas cujo assessment aponta para Cliente diferente da oportunidade, incluindo inspeções arquivadas, sem retornar nomes, IDs ou valores. Consulta destina-se a superadmin ativo, com gate e trava de autorização; não corrige, desvincula ou altera dados. O resultado não comprova ausência de outras inconsistências ou permissões incorretas.

Manter função privada e gate fechado até validar FORCE RLS do proprietário, autorização, custo em volume, privacidade, concorrência e revisão adversarial. Não executar em dados oficiais como parte desta preparação.
