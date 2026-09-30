---
name: E01-S154-componente-sistema-unico
description: UI renomeia Equipamento→Componente (código mantém equipamento), esconde tipo/pai legados e Componente passa a pertencer a no máximo 1 Sistema.
alwaysApply: true
---

# Spec — E01-S154 Componente (renomear) + Sistema 1:N

> **Status:** aprovado · **Tier:** pequeno · Iniciativa: Cadastro de ativos v2
> Design compartilhado: [`../E01-S155-posicao-flexivel-ativos/design.md`](../E01-S155-posicao-flexivel-ativos/design.md) (D1, D2) · ADR-0022

## Resumo
A UI passa a chamar de **Componente** o que hoje chama de Equipamento (linha de `pcm.equipamentos`),
deixa de mostrar o nível "componente filho de equipamento", e um Componente passa a poder estar em
**no máximo um** Sistema.

## Contexto para quem implementa
- "Equipamento" é o nome da entidade no **Auvo**. No SO, o mesmo registro vira **Componente**.
  Sistema continua Sistema. Os dois sobem ao Auvo como Equipment (isso não muda).
- **Não renomeie código**: tabela `pcm.equipamentos`, tipo `EquipamentoItem`, arquivos
  `*equipamento*`, rota/view `"equipamentos"` e descriptor ficam como estão (design.md, D1). Só
  muda **texto visível ao usuário** e o glossário.
- Continuam dizendo "Equipamento" (outro conceito, **não mexer**):
  - PMOC / Inventário (`PmocPage.tsx`, `pmoc*.ts`, `pcm.pcm_equipment`);
  - laudos (`NovoLaudoSpdaModal.tsx`, `inspecoes-laudos.ts`);
  - dados vindos do Auvo em tempo real: `DetalhesTarefaAuvo.tsx`, `contexto-tarefa-auvo.ts`,
    `PainelEquipamentos.tsx` (cache `equipamentos_cache`), textos do Dashboard PCM que falam de
    "equipamento Auvo";
  - o card "Equipamentos Auvo" do Resumo da 360 (`VisaoClientePage.tsx` ~L1325).

## Critérios de aceite

### AC-1: UI diz "Componente"
- **Dado** um usuário com acesso ao PCM
- **Quando** abre a nav de Cadastros, a tela de listagem, o modal de criar/editar, o Board, o
  drawer de detalhe, a aba Ativos da 360, a composição de Sistema ou o campo "Alvo" da Nova OS
- **Então** todo texto que se refere a uma linha de `pcm.equipamentos` diz "Componente(s)" /
  "componente(s)", com concordância de gênero (masculino, igual a "equipamento"):
  - nav: "Equipamentos" → **"Componentes"** (`app/HomePage.tsx` ~L360; o `view: "equipamentos"`
    não muda);
  - modal: títulos "Novo componente" / "Editar componente", e erro "Não foi possível salvar
    componente.";
  - Nova OS: rótulo "Equipamento (Alvo)" → **"Componente (Alvo)"**, opção vazia "Sem componente";
  - mensagens de domínio/aplicação: "Equipamento é obrigatório." → "Componente é obrigatório.";
  - `PainelEquipamentos.tsx` ganha título **"Equipamentos no Auvo (somente leitura)"**, para não
    ser confundido com os Componentes do SO.
- **E** nenhum texto das exceções listadas em "Contexto" muda.

### AC-2: Tipo e "pai" saem da UI, dado legado preservado
- **Dado** o modal de Componente (`EquipamentoModal.tsx`)
- **Quando** o usuário cria ou edita
- **Então** os campos "Tipo" (Equipamento/Componente) e "Equipamento pai" **não aparecem**
- **E** ao **criar**, o payload manda `tipo: "equipamento"` e `parentItemId: null`
- **E** ao **editar** um registro legado com `tipo='componente'` e/ou `parent_item_id` preenchido,
  esses valores são **reenviados sem alteração** (nada é apagado).
- **E** no drawer do Board, a seção de "componentes filhos" continua aparecendo **só se** o item
  tiver filhos legados. O título vira "Subcomponentes (legado)".

### AC-3: Componente em no máximo 1 Sistema (banco)
- **Dado** um Componente já membro do Sistema A
- **Quando** alguém tenta inserir o mesmo `item_id` em `pcm.sistema_itens` para o Sistema B
- **Então** o banco rejeita com `unique_violation` (23505), pelo índice
  `uq_sistema_itens_item_unico` em `pcm.sistema_itens (item_id)`.

### AC-4: Componente em no máximo 1 Sistema (domínio + UI)
- **Dado** o Componente "Hidrante 1" membro do Sistema "Incêndio Torre B"
- **Quando** o usuário abre "Compor itens" de **outro** Sistema do mesmo cliente
- **Então** "Hidrante 1" aparece na lista **desabilitado**, com o texto auxiliar
  `em «Incêndio Torre B»`, e não pode ser marcado
- **E** se a chamada chegar ao caso de uso mesmo assim (`adicionarItem`), ele lança
  `Error("Componente já pertence ao Sistema «Incêndio Torre B». Remova de lá antes.")` **antes** do
  round-trip de insert
- **E** no Sistema do qual o Componente **já é membro**, ele aparece marcado e habilitado
  (desmarcar e salvar remove, como hoje).

### AC-5: Glossário
- **Dado** `docs/glossary.md`
- **Então** a entrada **Componente** é reescrita: "Nome de UI de uma linha de `pcm.equipamentos`
  (tipo TS `EquipamentoItem`, nome físico mantido — ADR-0022). Ativo do cliente enviado ao Auvo
  como Equipment. Pertence a no máximo 1 Sistema."
- **E** a entrada **Equipamento** passa a dizer: "Nome da entidade no **Auvo** (Equipment) —
  Componentes e Sistemas do SO viram Equipment lá. No SO, não use para ativos; use Componente.
  (Exceção: Inventário de Equipamentos do PMOC.)"
- **E** a entrada **Sistema** troca "Relação N:N com Item" por "Tem N Componentes; cada
  Componente pertence a no máximo 1 Sistema (E01-S154)."
- **E** a entrada **Item** vira sinônimo proibido: "Não usar na UI — use Componente."

## Casos de borda e erros
- Duplicata já existente em produção (mesmo `item_id` em 2 sistemas): a migration falharia. A
  **task 1** consulta antes. Se houver duplicata, **pare** e reporte a lista ao Lucas; não escolha
  sozinho qual vínculo apagar.
- Componente desativado (`deleted_at`) não aparece na composição (comportamento atual mantido).
- Remover um Componente do Sistema A e adicionar no B na **mesma** sessão: salve A primeiro. O
  seletor do B só libera depois da invalidação/recarga.

## Fora de escopo
- Renomear tabela, tipos, arquivos, rotas ou descriptor.
- Migrar `tipo='componente'`/`parent_item_id` legados.
- Qualquer mudança no Auvo (vínculo Sistema↔Componente não vai pro Auvo).
- Posição, categoria, identificador (outras stories).

## Rastreabilidade
- Product/Design: `../E01-S155-posicao-flexivel-ativos/{product,design}.md` · ADR-0022
- Código tocado: `app/HomePage.tsx`, `features/pcm/{pages/EquipamentosPage,components/EquipamentoModal,components/DrawerDetalheAtivo,components/BoardAtivos,components/PainelItensDoCliente,components/PainelEquipamentos,components/NovaOrdemServicoModal,components/ComposicaoSistema,components/SeletorItensComFiltro,pages/SistemasPage}.tsx`, `features/pcm/{domain/sistemas,domain/composicao-sistema,application/sistemas,application/sistemas-gateway,application/equipamentos,domain/equipamentos,infrastructure/supabase-sistemas-adapter}.ts`
