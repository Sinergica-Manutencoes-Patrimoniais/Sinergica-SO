# ADR-0328 — Documentos privados em levantamento

Prepara-se associação de documento PDF armazenado em bucket privado próprio a linha de levantamento do mesmo Cliente, com objeto de propriedade do remetente e request id idempotente. A origem é upload SSO: não se aceita URL, não se busca conteúdo remoto e não se atribui proveniência Auvo/Campo verificada. O vínculo não publica nem incorpora documento ao cadastro oficial.

O bucket, gate e RPCs permanecem fechados; não há leitura direta. Antes de ativar são necessários endpoint mediado com rechecagem de autorização, verificação de assinatura/tamanho, inspeção de conteúdo/malware, regras de retenção, tratamento de órfãos e testes. MIME declarado não comprova segurança ou autenticidade.
