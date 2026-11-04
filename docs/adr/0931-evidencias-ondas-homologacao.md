# ADR-0931 — Registro privado de evidências das ondas

Status: preparação local, não aplicada nem homologada.

## Contexto

S186 exige evidência por Cliente, versão, ambiente, executor, data e cenário, com histórico e repetição idempotente. O catálogo na interface é apenas documental; não representa execução nem aceite. Ainda não existe trilha persistida para as evidências.

## Decisão

Preparar estrutura aditiva privada com uma revisão por Cliente/onda e registros imutáveis de evidências. Cada comando exige requestId, revisão esperada e autorização atual no Cliente; grava revisão, evidência e evento de auditoria na mesma transação. A identidade do executor vem da sessão; IDs e referências de artefatos são identificadores limitados, não URLs ou conteúdo de arquivos. Registros anteriores não são substituídos quando uma execução é refeita. A capacidade `plano.gerir` é uma restrição conservadora já utilizada no diagnóstico S186, não uma decisão definitiva sobre quem homologa todas as ondas.

Funções e tabelas permanecem sem acesso aos papéis externos e o gate nasce fechado. O registro é declaração do executor, não comprova autenticidade dos artefatos, aprovação funcional, CI, integridade dos resultados nem liberação para produção. Nenhum comando de aceite, ativação ou migração é introduzido por esta decisão.

## Compatibilidade e reversão

Nenhum objeto existente é alterado ou dado migrado. Desativar o gate interrompe novas declarações; preservar registros e auditoria. Qualquer concessão ou abertura requer decisão posterior, verificação de permissões por onda, autorização e gate sob concorrência, acesso por Cliente, privacidade, testes de integridade e replay no Supabase completo e revisão adversarial. Não eliminar tabelas ou histórico para reverter.
