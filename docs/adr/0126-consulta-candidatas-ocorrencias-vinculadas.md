---
name: "docs-adr-0126-consulta-candidatas-ocorrencias-vinculadas-md"
description: "Documento Sinérgica SO: ADR-0126 — Consulta de candidatas vinculadas a ocorrências legadas"
alwaysApply: false
---

# ADR-0126 — Consulta de candidatas vinculadas a ocorrências legadas

**Estado:** proposta não aplicada nem homologada. Complementa ADR-0116.

## Decisão

Preparar uma consulta paginada, restrita por Cliente e autorização atual no servidor, das ocorrências preparadas com vínculo explícito a uma ocorrência legada. A consulta informa somente registros sem OS vinculada, sem envio remoto e com resultado pendente. Não cria Plano Preventivo artificial, ocorrência, Chamado, OS, Visita ou tarefa Auvo; não modifica o gerador legado.

Essa consulta identifica **candidatas**, não comprova elegibilidade definitiva nem substitui a fila oficial. O legado não registra todos os estados de cancelamento e decisão PCM exigidos pela story. A consulta fica atrás do gate já fechado e sem permissão de execução para clientes ou serviço até a integração e revisão. O cursor usa vencimento original e ID preparado; dados e vínculo existentes não são alterados.

## Limites e rollout

Identidade estável entre versões e exclusividade com PMOC seguem pendentes. O vínculo atual admite somente Sistemas e Componentes existentes, não Grupos Quantitativos. Não ativar a consulta ou apresentá-la como fila operacional até resolver cancelamento, decisões de vencidos, autorização, concorrência, integração com a fila oficial e o caminho de criação de Chamados/OS; validar RLS e paginação em banco descartável. Rollback seguro antes de exposição: revogar execução e remover somente a função após conferir dependências; nenhum dado é apagado.
