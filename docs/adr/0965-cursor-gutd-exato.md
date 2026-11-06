# ADR-0965 — Cursor decimal exato do ranking

Status: preparação privada, não homologada.

Pontuação GUTD é `numeric` e pode conter dízima; converter para número binário JavaScript e devolver como cursor pode mudar a fronteira da página. Preparar wrapper privado que retorna o score como texto decimal exato e recebe o mesmo texto no cursor, convertendo-o para `numeric` no servidor. Interface valida formato e compara decimais sem arredondamento; exibição não altera cursor.

Não prova correção de paginação concorrente, consistência da assinatura, collation, limites ou autorização. Manter núcleo e wrapper privados e gates fechados até testes diferenciais e revisão adversarial.
