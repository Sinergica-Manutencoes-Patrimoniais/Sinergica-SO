---
name: "docs-adr-0102-despesas-oficiais-visita-md"
description: "Documento Sinérgica SO: ADR-0102 — Despesa oficial por Visita e vínculos protegidos"
alwaysApply: false
---

# ADR-0102 — Despesa oficial por Visita e vínculos protegidos

## Estado

Proposta de implementação local, não homologada. Nenhuma migration de E01-S180 foi criada ou aplicada. E01-S171, E01-S170 e fluxo de comprovantes exigem validação integrada antes da operação.

## Contexto

`pcm.despesas` é espelho legado do Auvo e exige identidade externa; não é o registro oficial de despesa por Visita. O novo agregado deve preservar espelho e códigos históricos, distinguir previsão de realizado e evitar que rateio multiplique valores ou cobrança. O cliente não comprova vínculo com Visita/OS, autorização, integridade de comprovante ou efetivação financeira.

## Desenho proposto

Criar agregado aditivo `pcm.despesas_visita` com UUID próprio, Visita e Cliente derivados do vínculo existente, categoria, data, descrição, previstos e realizados em centavos, estado, revisão e autoria. Um realizado `0` é efetivo e diferente de ausência. Previsão e realizado permanecem eixos separados; relatório de despesa não soma os dois e só considera realizado como gasto ocorrido. Cancelamento mantém histórico e exclui registro cancelado das apurações. Não converter automaticamente o espelho Auvo nem criar cópia por texto ou ausência de mapeamento.

Criar comandos transacionais que validem requestId, revisão, Cliente derivado e capacidade atual. Escopo de permissão de despesas e módulos elegíveis precisa ser integrado ao catálogo configurável de E01-S170 sem conceder acesso por escrita genérica ou por papel técnico. Capacidade específica e migração de concessões exigem revisão antes de ativar o fluxo; nenhuma concessão é presumida. Escrita, resultado idempotente e evento append-only na mesma transação. Retry idêntico retorna resultado anterior somente após conferir acesso atual; payload divergente e revisão obsoleta falham sem alteração.

Rateio é opcional e, quando presente, usa OS distintas com vínculo ativo e mesmo Cliente/Visita, bloqueadas ou revalidadas na transação. A soma em centavos deve ser exata em relação ao realizado, ou ao previsto enquanto não houver realizado. Uma alteração posterior de valores deve revalidar o rateio existente atomicamente ou ser rejeitada; não armazenar rateio parcial ou deixar parcelas órfãs após mudança concorrente da Visita/OS. Não criar Chamado, OS, cobrança ou lançamento financeiro ao registrar ou ratear.

Cancelamento exige motivo e só é permitido após comprovar ausência de efetivação financeira por contrato transacional com a origem oficial; se essa integração não existir, a ação que possa afetar despesa efetivada permanece bloqueada. Estorno é fluxo financeiro separado, não exclusão de histórico. Eventos candidatos a faturamento pertencem à E01-S182 e não equivalem a cobrança.

Comprovante é objeto privado identificado por referência opaca, nunca caminho arbitrário ou URL aceita como autorização. `comprovantes` no DTO local é uma proposta de identificadores, não prova de que exista staging seguro. O servidor deverá validar que cada objeto existe, pertence ao mesmo Cliente e está autorizado para a despesa, sem expor custos ou caminhos; downloads exigem autorização atual. Aproveitar o padrão das ADR-0086–0088, mas não reutilizar a rota de lançamentos sem contrato de propriedade e escopo para este agregado. Emissão e remediação de URLs antigas, anexos em voo e janela de revogação seguem gates próprios.

## Validação antes da implementação e liberação

- Escrever testes pgTAP de tabelas/RLS FORCE, Cliente cruzado, permissão concedida/revogada e acesso direto negado; testar integração com autenticação e Storage privado reais em ambiente isolado.
- Demonstrar criação, realização, retry idêntico, requestId conflitante, duas sessões e revisão obsoleta; comprovar rollback completo de despesa, rateios, vínculo de comprovante e auditoria.
- Demonstrar rateio ausente/exato/parcial/excessivo, zero realizado, mudança simultânea de valor e vínculo de OS, reconciliação com aquisição e ausência de dupla soma.
- Testar cancelamento não efetivado, recusa de efetivado e estorno por contrato financeiro real; não simular ausência de vínculo financeiro como prova de ausência de efetivação.
- Inventariar migração legada, limites de lista, índices, privacidade de custos e plano de rollout/rollback. Revisão adversarial, CI com db-tests e homologação financeira precedem PASS.

O contrato compartilhado e o cálculo local não executam operação, não verificam escopo e não autorizam gravação. Usar somente como fundação até existir contrato servidor e seus testes.
