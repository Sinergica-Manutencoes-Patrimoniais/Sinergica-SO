# ADR-1260 — Acesso condicionado à recepção XLSX

**Status:** proposta local, não homologada. Complementa ADR-0954, ADR-0957 e ADR-1259.

Preparar concessão ao papel autenticado para recepção atestada e recuperação, necessárias ao cliente com sessão do usuário. Ambas continuam submetidas ao gate de banco fechado, autorização atual e trava; a gravação exige ainda assinatura vinculada aos bytes e à identidade. Não conceder leitura de tabelas, segredo ou acesso anônimo.

Não aplicar ou abrir gate antes de validar assinatura, Vault, bypass direto, concorrência, recuperação, ACL/RLS, runtime real e revisão adversarial. Não registrar ou implantar a função Edge nesta etapa.
