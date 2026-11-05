---
name: 0028-identidade-alias-e-levantamentos-aprovados
description: Cópia do documento de origem do programa SSO.
alwaysApply: false
source: workspace original Sinérgica SO
---

# ADR-0028 — Identidade estável, aliases e levantamentos aprovados

**Status:** Proposta técnica especificada. **Data:** 2026-10-26.

## Decisão

Preservar pcm.equipamentos e UI Componentes/Sistemas. Natureza técnica equipamento/componente continua atributo; Grupo Quantitativo é registro por Local, quantidade e categoria, sem TAG individual por unidade. Reusar parent_item_id com validação de mesmo Cliente e detecção de ciclos no servidor. Locais físicos e composição funcional são dimensões distintas; Sistemas distribuídos reúnem membros de vários Locais sem duplicar árvore.

UUID é identidade imutável. Código público pode mudar apenas em rascunho nunca usado. Aprovação, sync, etiqueta ou referência OS travam edição comum. Correção administrativa reserva novo código e alias do anterior atomicamente, mesmo espaço de unicidade para códigos atuais/aliases, pesquisa resolve ambos ao mesmo UUID. Alias não é reciclagem de código nem novo ativo. Manter etiquetas antigas resolvendo ativo e auditar emissão/substituição.

Levantamento é staging separado da estrutura oficial com versão, origem (planilha, Auvo, futuro Campo), linhas/evidências, possíveis matches e decisões PCM. Prévia não escreve cadastro oficial nem dispara Auvo. Aprovação exige autorização e controle de versão otimista; duplicatas concorrentes são detectadas. Linha rejeitada/pendente bloqueia seus dependentes, não implica perda das linhas já aprovadas. Reversão lógica por lote só atua onde não há dependência operacional posterior, que exige reconciliação.

## Alternativas e consequências

Rejeitados: renomear tabela de Componentes, gravar importação diretamente em cadastros, inventar dados a partir de prosa Auvo e copiar código ao mover Local. Política por categoria decide quais Componentes precisam de Equipment Auvo, preservando vínculos externos existentes e sem exclusão automática. Contrato de recepção preparado agora; aplicativo completo Copiloto, offline e coleta dedicada são etapa própria fora da entrega atual.
