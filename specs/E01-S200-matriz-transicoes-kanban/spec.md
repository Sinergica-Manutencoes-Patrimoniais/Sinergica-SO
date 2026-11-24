---
name: spec
description: "Matriz de movimentações permitidas da OS no Kanban — fecha o AC-7 de BL 007, que E01-S194 deixou parcial."
alwaysApply: false
---

# E01-S200 — Matriz de movimentações permitidas no Kanban

## Por que existe

`E01-S194` fechou só a transição de maior risco (entrar em "Finalizado" exige capacidade de
validação) e registrou o resto como SPEC_DEVIATION: travar todas as movimentações sem inventariar
quem as usa hoje arriscava bloquear operação legítima em produção. O Fabrício cobrou o item na
reunião de 24/11.

Regra do pacote (BL 007): **"arrastar respeita transições permitidas"**; as três primeiras colunas
são filas de entrada, as demais são etapas de tratamento.

## O inventário que precedeu a matriz (feito, 24/11)

Seis caminhos de banco escrevem `pcm.ordens_servico.status` **sem passar pela interface**:

| Migration | Caminho |
|---|---|
| `0011` | trigger de planejamento → Auvo |
| `1047` | conversão integral do Chamado |
| `1343` | confirmação do efeito T−24 |
| `1420` | processamento de origem de campo (OS criada pelo Auvo) |
| `1612` | avanço de execução vindo do campo |
| `1832` | cancelamento forçado do Chamado |

E quatro caminhos manuais na interface: arrastar no quadro, o seletor de status do cartão, o botão
do painel de detalhe e a ação em lote.

**Decisão que sai do inventário:** a matriz governa **apenas os caminhos manuais**. A automação
continua livre — o campo não pede licença ao quadro para avançar, e travar o retorno do Auvo seria
quebrar o fluxo que o próprio pacote define.

## Acceptance Criteria

- **AC-1:** o caminho aprovado é permitido inteiro: Solicitação → Planejamento → Em execução →
  Validação PCM → Finalizado.
- **AC-2:** não se finaliza pulando a Validação PCM.
- **AC-3:** o PCM pode devolver a OS para execução quando reprova o retorno.
- **AC-4:** replanejar é permitido (execução volta para Planejamento).
- **AC-5:** cancelar é permitido de qualquer etapa viva.
- **AC-6:** OS finalizada e OS cancelada não voltam pelo quadro — reabertura e reativação são
  fluxos próprios, com registro.
- **AC-7:** não se move uma OS **para** um status legado (`corretiva`, `backlog`); mas pode-se
  **tirá-la** de um, que é como um registro antigo volta ao fluxo.
- **AC-8:** toda recusa mostra o motivo em texto na tela. Arrastar e nada acontecer, sem
  explicação, é recusado no review.
- **AC-9:** a automação não é afetada: os seis caminhos de banco continuam escrevendo livremente.

## Alcance no front

- **AC-F1:** PCM → Ordens de Serviço → Kanban → arrastar um cartão entre colunas.
- **AC-F2:** `VITE_SSO_MATRIZ_TRANSICOES_ENABLED`, declarada no registro, `.env.example` e
  `netlify.toml`, com `false` explícito.
- **AC-F3:** com a flag desligada o comportamento é exatamente o de hoje — nada muda sem decisão.
- **AC-F5:** falta ligar a flag, **depois** de observar o quadro em uso real na homologação.

## Fora de escopo

- Aplicar a matriz na automação (ver inventário acima).
- Reabertura de OS finalizada e reativação de cancelada: fluxos próprios, não um arrastar.
- Enforcement no banco: a matriz manual vive na borda; levar para `fn_operacao_alterar_status_lote`
  exige confirmar antes que nenhum chamador automático passa por ela. Próxima etapa.
