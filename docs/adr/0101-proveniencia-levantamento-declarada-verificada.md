---
name: "docs-adr-0101-proveniencia-levantamento-declarada-verificada-md"
description: "Documento Sinérgica SO: ADR-0101 — Proveniência declarada e verificada de levantamentos"
alwaysApply: false
---

# ADR-0101 — Proveniência declarada e verificada de levantamentos

## Estado

Proposta de segurança para E01-S178; não autoriza implantação nem altera decisões operacionais aprovadas. Complementa as ADRs 0028 e 0093. A migração local 0315 não está liberada para implantação: aceita origem informada pela sessão PCM, sem comprovar que o lote veio do sistema nomeado.

## Contexto

Uma pessoa pode preencher manualmente `origem=auvo`, `campo` ou `planilha` e uma chave arbitrária. Esses valores são declarações; não são prova de evento Auvo, arquivo recebido ou aplicativo de Campo. A role autenticada poderia invocar a RPC diretamente, independentemente da tela. Apresentá-los como fonte comprovada permitiria confundir a trilha de coleta e os critérios de deduplicação.

## Proposta

- Registrar separadamente **meio de recepção** (`manual`, arquivo validado ou integração autenticada), **origem declarada** opcional e **proveniência verificada**, com autor, instante e referência correlacionável. Uma declaração nunca equivale a verificação.
- Entrada manual exige autorização PCM atual e persiste como manual, mesmo quando o operador declara ter consultado Auvo ou uma planilha. A declaração não cria ou modifica cadastro oficial.
- Origem verificada exige adaptador específico com autenticação e validação da fonte, contrato provado, referência externa estável, Cliente resolvido no servidor e deduplicação transacional. Um formulário autenticado não se torna evento Auvo pelo conteúdo digitado. Cada canal de integração e acesso a evidências precisa de desenho e revisão próprios.
- Identidade de origem e retry devem considerar meio e fonte comprovada, sem permitir que declaração manual reserve identidade externa legítima. Uma reentrega comprovada mantém identidade única; divergência exige reconciliação, nunca sobregravação silenciosa.
- Leitura e interface devem diferenciar explicitamente declaração de comprovação. Durante a transição, registros antigos sem prova são rotulados como não verificados, sem presumir, editar ou apagar seu histórico. Nenhuma equivalência é inferida de chave, nome ou texto.

## Compatibilidade e rollout

Usar migração aditiva posterior com estado não verificado por padrão e fronteiras de comando distintas. Inventariar leituras/escritas e registros antes de qualquer classificação ou restrição; não reclassificar automaticamente como comprovados. Até a solução e revisão estarem prontas, não implantar nem conceder execução operacional da RPC de recepção 0315 e manter o formulário manual desconectado. Desativar consumidores é reversível e preserva registros, códigos e auditoria. Entrada Auvo real depende ainda da liberação operacional do Fabrício.

## Provas antes de habilitar

Testar chamada direta por PCM tentando simular fonte autenticada; reentregas simultâneas, conflito de identidade e cruzamento de Cliente; eventos reais apenas em ambiente de teste autorizado; falha parcial e retry; arquivos, respostas e fotos sem acesso cruzado; revogação atual; migração de dados antigos sem falsificar origem; e preservação dos cadastros oficiais. Executar pgTAP permitido/negado, prova de concorrência real, revisão adversarial e CI com db-tests. Os testes sintéticos existentes não comprovam origem nem autorizam homologação.
