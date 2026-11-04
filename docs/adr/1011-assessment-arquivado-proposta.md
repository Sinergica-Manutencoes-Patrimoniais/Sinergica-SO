# ADR-1011 — Preservação de assessment arquivado

Status: preparação fechada, não homologada. Complementa ADR-1010.

O fluxo legado permite arquivar uma inspeção já vinculada sem apagar o vínculo ou os itens copiados da proposta. A guarda de Cliente deve verificar a identidade da inspeção independentemente de `deleted_at` e não impedir seu arquivamento. A seleção de uma inspeção ativa para novo vínculo permanece responsabilidade do comando de vínculo e de suas permissões, não de uma alteração histórica automática.

Não habilitar a guarda até testar duplicação de proposta, inspeção arquivada, alterações concorrentes de Cliente, RLS e preservação de snapshots. Alterações já preparadas permanecem sem aplicação e sem teste.
