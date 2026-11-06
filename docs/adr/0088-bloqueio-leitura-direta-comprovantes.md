---
name: "docs-adr-0088-bloqueio-leitura-direta-comprovantes-md"
description: "Documento Sinérgica SO: ADR-0088 — Bloqueio faseado de leitura direta de comprovantes"
alwaysApply: false
---

# ADR-0088 — Bloqueio faseado de leitura direta de comprovantes

## Decisão

Após disponibilizar a rota intermediada e o cliente que a consome, restringir `SELECT` de usuários autenticados no bucket `financeiro-comprovantes`. A rota usa autorização atual pelo lançamento e acesso de serviço ao objeto. A restrição não afeta outros buckets nem remove objetos ou os grants de upload existentes. Testar criação de arquivo por usuário financeiro, download pela rota e recusa de assinatura direta com Storage real antes de adoção.

Links assinados já emitidos continuam válidos até expiração, pois seu uso não é revalidado pela RLS. Inventário e remediação auditada de links e artefatos anteriores permanecem obrigatórios. Serviço privilegiado continua capaz de ler e assinar: limitar credenciais e auditar outras rotas. Verificar o escopo de Cliente e a janela de revogação em ADR-0087.

## Ordem de implantação e reversão

Não aplicar isoladamente. Primeiro publicar e testar a migration 0310 e a Edge Function; em seguida disponibilizar cliente que usa a rota e validar clientes antigos. Somente depois aplicar esta restrição, com janela de compatibilidade e plano operacional: clientes antigos que leem Storage diretamente deixam de abrir comprovantes. Reverter a restrição reabre emissão de links e só é aceitável mediante decisão de segurança registrada. Preservar upload, objetos e evidências. Nenhum deploy é autorizado por esta decisão.
