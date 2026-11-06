# ADR-1013 — Vínculo mediado de assessment

Status: preparação privada, não homologada.

Preparar comando que associa uma inspeção ativa à proposta, verificando ator, capacidade `orcamento.emitir` no Cliente da oportunidade, Cliente da inspeção e estado editável. O comando conserva um vínculo já existente: repetição idêntica não grava novamente e tentativa de trocar por outra inspeção é recusada. Retorna apenas IDs e não expõe custos. Integração do adapter sob flag desligada; cliente recarrega proposta pelas permissões já existentes.

O comando depende da guarda do ADR-1010/1011 habilitada para proteger também alterações inversas. Gate, EXECUTE e flag permanecem fechados. Validar atomicidade, replays após perda de resposta, autorização, FORCE RLS, edição concorrente, arquivamento de inspeção, compatibilidade de propostas e revisão adversarial antes de liberar. O caminho legado permanece e não deve ser considerado protegido antes do rollout completo.
