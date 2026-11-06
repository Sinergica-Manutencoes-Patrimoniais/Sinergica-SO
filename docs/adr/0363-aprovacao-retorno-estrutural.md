# ADR-0363 — Aprovação preparada com condição estrutural atual

Status: proposta, não homologada.

O comando preparado exige permissão atual, cobertura marcada como comprovada pela fonte canônica existente, conferência e revisões atuais, revalidação estrutural transacional e decisão explícita do PCM. Reutiliza o comando versionado de aprovação e prepara pendências Não OK na mesma transação, sem fechar OS ou Chamado e sem contato Auvo. Uma falha reverte tudo. A guarda canônica não é contornada e o comando não transforma evidência declarada em conteúdo autenticado.

No fluxo manual atual `cobertura_comprovada` permanece falsa e nenhuma fonte foi identificada para promovê-la com segurança; portanto a aprovação não fica disponível nesse caminho. Gate próprio e EXECUTE nascem fechados. Critério operacional de comprovação, efeitos de status, testes e revisão adversarial precedem ativação.
