---
name: product-cadastro-ativos-v2
description: PRD da iniciativa "Cadastro de ativos v2" (E01-S154..S161) — Componente/Sistema, posição flexível, categoria, siglas+identificador, descrição Auvo, cadastro na 360, árvore e importação Excel.
alwaysApply: false
---

# Product — Cadastro de ativos do cliente v2 (E01-S154 a E01-S161)

> **Tier:** arquitetural · **Status:** aprovado pelo PO (Lucas, 2026-09-29) · **Dono:** Lucas
> Este documento cobre as 8 stories da iniciativa. Cada story tem seu `spec.md` + `tasks.md`.
> Design técnico compartilhado: [`design.md`](./design.md). ADR: [ADR-0022](../../docs/adr/0022-identificador-ativo-siglas-imutavel.md).

## Problema
A Sinérgica faz manutenção predial. Para planejar preventiva, cumprir obrigação legal (AVCB/PCI,
PMOC, SPDA, elevadores) e mandar o técnico ao lugar certo, ela precisa de um **inventário de ativos
por cliente** que seja padronizado. Lucas desenhou o modelo alvo (diagrama "Cliente: Guainumbí",
2026-09-29) e comparamos com o sistema:

1. O SO chama de **Equipamento** o que, no modelo da Sinérgica, é **Componente**. "Equipamento" é o
   nome da entidade no **Auvo** — usar a mesma palavra para duas coisas confunde.
2. Um Componente pode estar em **vários** Sistemas (N:N). No modelo, pertence a **no máximo um**.
3. Componente só pode ser pendurado num **Local**; Sistema só numa **Área**. No modelo, os dois
   podem ficar em **qualquer nível** (Cliente, Área ou Local), e só o cliente é obrigatório.
4. **Categoria** é texto livre no Componente e no Sistema. Não há padrão.
5. O **Identificador** que vai para o Auvo é livre ou gerado pelo Auvo (ex.: `5979161820767703`).
   O técnico não consegue ler nada nele.
6. A **descrição** no Auvo é só o nome do item, sem o caminho.
7. Na Visão 360 do cliente só dá para cadastrar a Estrutura. Sistemas e Componentes são criados em
   outra tela.
8. Não existe uma visão em **árvore** do cliente como a do diagrama.
9. Não há forma de cadastrar a estrutura **em lote** (condomínio grande = centenas de itens).

## Para quem
- **Fabrício e a equipe de escritório (supervisor):** cadastram e mantêm a estrutura de cada
  condomínio.
- **Técnico de campo (via Auvo):** lê identificador, descrição e localização no app do Auvo e
  pelo QR Code.
- **Síndico (Portal, depois):** consome a mesma estrutura, em leitura.

## Resultado esperado / métrica de sucesso
- Todo Componente/Sistema **criado pelo SO** nasce com identificador no padrão
  `GUA-TOA-A02-SHA-ELE-QDC-01`. Baseline 0% → alvo 100%.
- Todo Componente/Sistema criado pelo SO tem **categoria do catálogo**. Baseline 0% → alvo 100%.
- Cadastro de um condomínio de ~200 itens em **uma sessão**, via Excel. Hoje: item a item.

## Goals
- Renomear Equipamento → **Componente** no SO. O Auvo continua chamando de Equipment.
- Componente em **no máximo 1** Sistema.
- Componente e Sistema posicionáveis em Cliente, Área ou Local. Cliente obrigatório.
- Categoria vinda de catálogo, espelhado com o Auvo, com criação pelo SO.
- Sigla de 3 caracteres por nível e identificador gerado **só na criação pelo SO**, depois **fixo**.
- Descrição no Auvo com o nome completo (caminho).
- Cadastro completo na Visão 360: Estrutura, Sistemas, Componentes e Ferramentas alocadas.
- Aba **Árvore** na Visão 360.
- Importação/exportação da estrutura via **Excel** com simulação (dry-run).

## Non-goals
- Não renomear tabelas, tipos TypeScript ou arquivos (`pcm.equipamentos`, `EquipamentoItem`...).
  A mudança é de linguagem na UI e no glossário. Ver design.md, D1.
- Não gerar novo identificador para itens que **já existem** (hoje ~2000) nem para itens criados
  **no Auvo**.
- Não fazer a higienização das categorias atuais do Auvo. Lucas fará uma limpeza geral depois.
- Não sincronizar com o Auvo o vínculo Sistema→Componente. No Auvo, os dois são Equipment soltos.
- Não fazer o diagrama em caixas (organograma). A árvore v1 é uma lista recolhível.
- Ferramentas continuam patrimônio da Sinérgica: a 360 só **aloca e devolve**. O cadastro da
  ferramenta segue na tela Ferramentas.

## Riscos / premissas
- **Premissa:** a API do Auvo aceita o `identifier` enviado no POST/PATCH de `/equipments`. O push
  já envia esse campo hoje, mas não há prova registrada de que o Auvo respeita o valor. A E01-S157
  tem uma task de verificação com um cliente de teste.
- **Risco:** mudar o identificador de um item muda o QR Code já impresso. Mitigação: identificador
  fixo, e alteração manual só depois de uma confirmação explícita (E01-S157).
- **Risco:** escrita no Auvo é real (`writeEnabled:true` para equipamentos, sistemas e categorias).
  Nenhuma migration desta iniciativa pode disparar PATCH em massa. Ver design.md, "Regra de ouro".
