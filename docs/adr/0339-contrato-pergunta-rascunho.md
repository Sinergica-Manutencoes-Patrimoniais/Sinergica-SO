# ADR-0339 — Contrato de obrigatoriedade por pergunta em rascunho

Status: proposta, não homologada.

O PCM configura explicitamente se uma pergunta identificada do questionário atual de uma Rotina rascunho exige resposta. A configuração é imutável por revisão, vinculada a Plano, versão, Rotina e questionário e guarda a pergunta histórica correspondente, sem editar o cadastro Auvo. Mudança posterior do questionário ou substituição do vínculo torna a declaração não confiável para aprovação e requer nova conferência. Nenhuma regra de foto é inventada.

A decisão ainda não é incorporada automaticamente ao snapshot aprovado: comando de aprovação e cópia para revisões precisam de integração e testes antes de uso operacional. Gate próprio e EXECUTE fechados; histórico legado não é alterado. A ausência de contrato permanece indeterminada.
