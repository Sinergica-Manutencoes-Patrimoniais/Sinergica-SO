# Plano de Manutenção do Fabrício

Material de negócio e continuidade preservado em 24/10/2026. A análise foi feita entre
15 e 16/10/2026. O próximo trabalho é preparar as especificações executáveis do módulo.
Não houve implementação do novo fluxo nesta iniciativa.

## Ordem de leitura

1. [Decisões consolidadas e pendências](decisoes-consolidadas.md).
2. [Respostas originais do Fabrício](fontes/respostas-fabricio-2026-10-16.txt).
3. [Especificação funcional v2 original](fontes/especificacao-fabricio-v2.docx).
4. [Plano Rimini original](fontes/plano-rimini-2026-final.xlsx) e
   [plano I Home original](fontes/plano-i-home-2026.xlsx).
5. [Prompt de continuação](continuar.md).

Os quatro arquivos de origem foram copiados sem alterar seus conteúdos; somente os nomes
dos arquivos foram normalizados. Não dependem dos caminhos locais de anexos do Codex.
Os hashes em [SHA256SUMS](fontes/SHA256SUMS) foram comparados com os quatro originais.

## Autoridade das decisões

- Lucas determinou que a ideia operacional do Fabrício prevalece e que os nomes
  **Componentes e Sistemas** devem permanecer no SO.
- As respostas consolidadas de 16/10 complementam e substituem os trechos anteriores
  incompatíveis, especialmente feriados, validação e encerramento.
- Na especificação Word, a seção 14 prevalece sobre propostas e exemplos anteriores.
- As planilhas são referências operacionais e massa de homologação. Não substituem as
  regras aprovadas nem comprovam execução de serviços.
- Sugestões do assistente só se tornam requisitos quando aceitas. As pendências expressas
  continuam abertas; não adotar silenciosamente a primeira alternativa apresentada no chat.

## Estado técnico da análise

A comparação de código usou a árvore equivalente à main no commit
`22aca3918224bc45175e80c6ec88b957fdb604aa` (PR #70). A referência remota foi atualizada e
confirmada novamente durante o handoff. Revalidar o código antes do desenho definitivo.

O levantamento geral anterior do produto foi preservado em
[docs/entregas/2026-10-14](../../entregas/2026-10-14/README.md).

## Limites desta entrega

Este diretório contém fontes de negócio, análise e pendências. Não há aqui uma nova
`spec.md`, `plan.md`, `tasks.md`, ADR aprovada, migration, código do módulo ou homologação
concluída. A base existente de Preventivas é `specs/E01-S53-preventivo-service-orders/`.
As novas stories precisam seguir `CLAUDE.md`, a constituição e o fluxo Spec Kit.
