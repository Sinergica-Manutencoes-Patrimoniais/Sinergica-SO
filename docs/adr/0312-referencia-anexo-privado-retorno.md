# ADR-0312 — Referência privada de foto em retorno

Status: proposta, não homologada.

Um operador pode referenciar em um retorno uma foto já vinculada por nota à mesma OS e ao mesmo Cliente em Storage privado `os-anexos`. O comando confere nota, objeto, bucket privado, prefixo de Cliente e metadado JPEG/PNG, registra ID e caminho de forma privada e audita a declaração. Isto comprova apenas a existência da referência e o metadado de tipo no momento da transação; não autentica conteúdo, autoria de campo, integridade posterior ou pertinência a uma pergunta. Não captura anexos remotos do Auvo e não altera cobertura ou encerra OS.

Gate próprio e EXECUTE ficam fechados. Downloads devem usar rota autorizada específica, nunca expor caminho diretamente ao cliente; essa rota, inspeção de conteúdo e revisão de segurança permanecem pendentes. Testes e revisão adversarial antecedem ativação.
