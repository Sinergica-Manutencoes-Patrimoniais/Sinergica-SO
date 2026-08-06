---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Relatório do cliente (HTML + PDF + Portal do Cliente)

> **Fonte da verdade.** Origem: Lucas (2026-08-04, item 6). "Crie relatórios sobre cliente, pro
> Fabricio usar em apresentações pro cliente sobre o trabalho realizado pela Sinérgica; seja
> criativo e se posicione como o cliente gostaria de receber; crie a opção de gerar o HTML e
> exportar pra PDF; traga opção de cronograma com o planejamento futuro, e relatório do passado."
> Decisão travada: **visualização interna + gerar HTML + exportar PDF + disponível no Portal do
> Cliente (E09).**

## Contexto de código
- Dado por cliente: OS executadas + evidências/fotos (webhook Auvo E01-S15, `auvoTaskId` deep-link),
  inspeções/assessments (E01-S90), PMOC (visitas/laudos, E01-S03-S08), backlog, apontamento.
- Cronograma futuro: PMOC (preventivas agendadas, `pmoc_schedule`) + Agenda do Técnico (E01-S104/S112)
  + OS planejadas.
- Portal do Cliente (E09): já existe (`features/area-cliente/`, `PortalShell`, portal por condomínio
  E09-S02, central de documentos E09-S06). É onde o relatório fica disponível pro síndico.
- Geração PDF: `pdf-lib` (laudo PMOC E01-S05). HTML: render próprio (tela) reaproveitável pro PDF.

## Resumo
Uma ferramenta interna onde o Fabricio escolhe **cliente + período** e gera um **relatório de
apresentação**: o **passado** (trabalho realizado pela Sinérgica — OS executadas, evidências, fotos,
inspeções, PMOC) e o **futuro** (cronograma planejado). Visualiza em HTML na tela, exporta PDF, e
**publica no Portal do Cliente** pro síndico acessar. Posicionamento voltado ao cliente (valor
entregue), não jargão operacional interno.

## Seções propostas (criativo — voltado ao cliente)
- **Capa:** cliente, período, logo Sinérgica, "Relatório de Atividades".
- **Resumo executivo:** nº de atendimentos, preventivas realizadas, tempo de resposta, destaques.
- **Trabalho realizado (passado):** OS executadas com data, o que foi feito, evidências/fotos, link
  quando aplicável; inspeções/PMOC do período.
- **Conformidade:** PMOC/laudos em dia, pendências resolvidas.
- **Cronograma futuro:** próximas preventivas/visitas planejadas (datas), o que está previsto.
- **Fechamento:** contato/responsável Sinérgica.

## Critérios de aceite

### AC-1: Gerar relatório por cliente + período
- **Dado** a ferramenta de Relatório do Cliente (uso interno, gate escrita/gestão)
- **Quando** o Fabricio escolhe cliente e período
- **Então** vê o relatório renderizado em HTML na tela, com passado e futuro do recorte.

### AC-2: Trabalho realizado com evidências
- **Dado** OS executadas no período com evidência no Auvo
- **Quando** o relatório monta a seção "trabalho realizado"
- **Então** lista o que foi feito, com data e evidência (foto/link) quando houver — linguagem voltada
  ao cliente, não status interno cru.

### AC-3: Cronograma futuro
- **Dado** preventivas/visitas/OS planejadas à frente
- **Quando** o relatório monta a seção "cronograma"
- **Então** mostra o planejamento futuro (datas + o que está previsto) do cliente.

### AC-4: Exportar PDF
- **Dado** um relatório gerado
- **Quando** o Fabricio clica "Exportar PDF"
- **Então** baixa um PDF de apresentação (mesmo conteúdo, formatado com identidade Sinérgica).

### AC-5: Publicar no Portal do Cliente
- **Dado** um relatório gerado
- **Quando** o Fabricio publica
- **Então** o relatório fica disponível pro síndico daquele cliente no Portal (E09), sem que o
  interno assuma a identidade do cliente; o síndico vê/baixa o dele, nunca de outro cliente (RLS).

### AC-6: Só o cliente certo
- **Dado** relatórios publicados de vários clientes
- **Quando** um síndico acessa o portal
- **Então** vê **apenas** os relatórios do seu condomínio (isolamento por RLS, padrão E09).

## Casos de borda e erros
- Período sem trabalho: seção "passado" mostra "sem atividades no período", sem PDF enganoso.
- Cliente sem cronograma futuro: seção "futuro" mostra "sem preventivas agendadas".
- Foto/evidência ausente: item aparece sem a imagem, sem quebrar layout.
- Publicação: versão publicada é imutável (retrato do período); nova geração = nova versão.

## Fora de escopo
- Edição livre do texto do relatório pelo Fabricio (é gerado do dado; ajuste fino é story futura).
- Envio automático por e-mail/WhatsApp (só publicar no portal + PDF pra ele mandar manualmente).
- Branding configurável por cliente (usa identidade Sinérgica padrão).

## Rastreabilidade
- Código (interno): nova `pages/RelatorioClientePage.tsx` (grupo RELATÓRIOS / Gestão),
  `domain/relatorio-cliente.ts` (montagem pura), `application/*`, adapters (OS/evidências/PMOC/agenda),
  render HTML reaproveitado pro PDF (`pdf-lib`).
- Portal (E09): superfície nova em `features/area-cliente/` pra listar/baixar o relatório publicado;
  tabela de relatórios publicados por cliente (RLS FORCE, isolamento por condomínio — padrão E09).
- Reusa: E01-S15 (evidências Auvo), E01-S03-S08 (PMOC/cronograma), E01-S104/S112 (agenda), E01-S05
  (`pdf-lib`), E09-S02/S06 (portal/documentos).
- ADRs relacionados: — (se a publicação criar um novo modelo de "documento do portal", avaliar ADR).
