---
name: "docs-adr-1140-orquestracao-t24-fence-md"
description: "Documento Sinérgica SO: ADR-1140 — Orquestração isolada de envio T−24"
alwaysApply: false
---

# ADR-1140 — Orquestração isolada de envio T−24

Status: proposta local; não integrada, não executada e não homologada.

Preparar uma orquestração com dependências injetadas para os fluxos proprietários de Visita/OS. A persistência deve conceder uma tentativa com fencing e validar novamente a revisão e a janela antes da rede. Para criação, a busca prévia só permite POST quando a ausência é completa e comprovada pelo contrato; múltiplos candidatos ou busca incompleta permanecem em reconciliação. Atualização usa somente o ID já vinculado. Antes de cada efeito a intenção é marcada como iniciada; falha ou resposta ambígua passa a incerta, sem novo POST automático. Sucesso depende de leitura posterior dos campos críticos.

O código preparado não fornece implementação de persistência ou fornecedor, não agenda jobs e não é chamado por endpoint. Uma confirmação de fence não elimina sozinha a corrida entre última checagem e chamada externa: mudanças/cancelamento após o início exigem reconciliação, e respostas tardias só podem ser aplicadas pelo dono transacional da OS. É obrigatório integrar e migrar todos os caminhos legados, comprovar identidade/busca/PATCH/GET e campos do Auvo, tratar concorrência e expiração, realizar testes e revisão adversarial antes de habilitar. Nenhum envio real é autorizado nesta etapa.
