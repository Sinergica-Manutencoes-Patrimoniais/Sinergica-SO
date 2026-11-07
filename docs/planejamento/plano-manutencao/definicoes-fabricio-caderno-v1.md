---
name: "docs-planejamento-plano-manutencao-definicoes-fabricio-caderno-v1-md"
description: "Documento Sinérgica SO: Definições do Fabrício após o Caderno Técnico v1"
alwaysApply: false
---

# Definições do Fabrício após o Caderno Técnico v1

Fonte: respostas do Fabrício encaminhadas por Lucas nesta conversa em 26/10/2026.
Registro consolidado das decisões, sem implementação ou homologação implícita.

## Precedência

Estas respostas encerram as quatro perguntas feitas após a análise do
`Caderno_Tecnico_Implementacao_SSO_v1.docx`, de 23/10/2026. Prevalecem sobre trechos
incompatíveis do planejamento anterior, inclusive alvo exclusivo por Plano e supressão
indiferenciada de ocorrências em feriado. Preservar nomes de UI **Componentes e Sistemas**,
cadastros, códigos existentes e nome físico `pcm.equipamentos`.

## 1. Escopo do Plano e alvo da Rotina

- Plano pode reunir vários Sistemas, Equipamentos, Componentes e Grupos Quantitativos por meio
  de várias Rotinas. A distinção funcional não autoriza renomear ou recriar cadastros existentes.
- Cada Rotina possui um alvo específico e inequívoco.
- Cada ocorrência nasce da combinação Rotina + alvo; sua identidade operacional também precisa
  distinguir o ciclo/vencimento. Não criar ocorrência genérica misturando alvos.
- Exemplo: Plano Preventivo Guainumbi contém Rotina mensal do Sistema de Extintores da Torre A,
  trimestral do QGBT e semestral do Sistema VRF.

## 2. Recorrência, tolerâncias e versões

- Mensais, trimestrais, semestrais, anuais ou legais normalmente usam modo **por calendário**.
  Atendimento semanal contratual usa modo **por Visita**. Não inferir modo só pelo rótulo da frequência.
- Por calendário: vencimento em feriado permanece pendente para PCM. Execução posterior mantém
  próximos vencimentos ancorados na data original.
- Por Visita: feriado no dia contratual elimina Visita e ocorrência correspondente, sem reposição
  automática nem contagem operacional da semana suprimida.
- Tolerância por Rotina separa dias permitidos antes e depois do vencimento; sem configuração,
  ambas são zero. Rotinas legais/normativas usam tolerância aplicável à exigência correspondente.
  Valores normativos não foram fornecidos; não inventar nem aplicar tolerância universal.
- Alterar data-base ou recorrência cria nova versão da Rotina, com vigência e histórico preservados.

## 3. Código público

- Pode ser ajustado somente enquanto cadastro é rascunho e ainda não utilizado.
- Aprovação, sincronização, etiquetagem **ou** referência em OS tornam o código imutável na operação
  normal. Retirar alteração manual comum existente nesses casos.
- Exceção exige permissão administrativa e auditoria: criar código substituto, preservar anterior
  como alias/histórico e permitir localizar ativo pelos dois códigos; registrar responsável, data
  e motivo. Preservar identidade do ativo e vínculos existentes.

## 4. Levantamentos e cadastro em campo

### Entrega atual — importação e recepção com aprovação

- Planilha padronizada suporta cadastro/atualização em massa de Áreas, Locais, Sublocais, Sistemas,
  Equipamentos, Componentes, Grupos Quantitativos, quantidades e informações conhecidas.
- Antes da estrutura oficial, conferência apresenta obrigatórios ausentes, códigos inválidos,
  possíveis duplicidades, vínculos não encontrados, hierarquia inconsistente e linhas novas,
  alteradas ou rejeitadas. PCM revisa e aprova lote; importação não grava diretamente no cadastro oficial.
- Auvo provisório: tarefa específica “Levantamento cadastral”, com questionário padronizado,
  observações e fotos, chega como levantamento pendente. Não cria cadastro definitivo nem depende
  de interpretação automática de texto corrido.
- Estrutura técnica oficial e validação permanecem no SSO; Auvo continua executor das OS.

### Etapa própria — Módulo de Campo/Copiloto Técnico

- Solução definitiva permite coleta Local por Local de estrutura, Sistemas sugeridos, ativos,
  Grupos Quantitativos, quantidades, fotos e características/observações técnicas.
- Dados chegam pendentes para PCM validar localização, classificação, vínculo funcional,
  duplicidades e códigos definitivos.
- Preparar agora estrutura de importação, recepção, conferência e aprovação; desenvolvimento
  completo do Copiloto fica para etapa própria.

## Pendências anteriores encerradas

- **P01:** caderno §13 define gestão por permissão específica de gestor atribuída individualmente.
- **P02:** planejador pode aprovar o próprio Plano se possuir essa permissão (caderno §13).
- **P03:** modos por Visita/calendário e âncora fixa definidos acima; tolerâncias explícitas por Rotina.

Não há nova pergunta de negócio bloqueadora nas quatro respostas. Provas técnicas do contrato Auvo,
recepção do levantamento, migração e proteção de custos continuam necessárias antes da implementação
ou liberação correspondente; não são decisões funcionais pendentes do Fabrício.

## Impacto nos artefatos anteriores

- E01-S165: escopo amplo do Plano, alvo da Rotina e versões de Rotina.
- E01-S166: dois modos, feriado por modo, tolerância antes/depois e preservação da âncora.
- E01-S167/S168: alinhar ao caderno completo, especialmente triagem de origem Auvo.
- E01-S169: staging e aprovação de levantamentos; separar materiais de despesas conforme caderno.
- E01-S170: remover bloqueio P01/P02 e fixar política aprovada.
- Código/aliases, Grupos Quantitativos e levantamentos ampliam programa além das seis stories;
  sua divisão será preparada na etapa de tarefas, sem presumir que já estão cobertos.
- Atualização do pacote: specs E01-S165–S186 revisadas em `programa-sso-terra.md`; ADR-0026/0027/0028 especificam desenho vigente e substituem a proposta ADR-0025. Nenhuma implementação ou homologação foi executada.
