# ADR-0226 — Guardas das rotas legadas de proposta

**Estado:** preparação fechada, não homologada nem implantada.

Enquanto o gate estiver fechado, endpoints e permissões legados mantêm comportamento anterior. Com o gate aberto, proposta vinculada a origem operacional não pode ser decidida pelo endpoint público sem versão nem duplicada pelo atalho Comercial: deve usar decisão versionada e fluxo operacional de complemento. A decisão versionada, após autorização e validação, invoca internamente a função legada de decisão somente quando há oportunidade, preservando seu movimento de funil. Propostas não operacionais mantêm o fluxo anterior.

Edição direta de proposta/itens/versões depende das guardas da ADR-0223; leitura pública legada de orçamento, contratos, snapshots, RLS e outras funções `security definer` ainda requerem auditoria integral. O gate não deve ser aberto isoladamente. Validar vazamento via helper de policy, concorrência de origem/decisão, permissões, legado e migrações, testar integração e executar revisão adversarial.
