# Research: Cliente 360 como cockpit operacional

## 1. Escopo e evidências na interface atual

As capturas e o código apontam o mesmo problema: o Cliente 360 agrega informações, mas não preserva o fluxo operacional. Há quinze abas numa faixa horizontal, listas sem filtros suficientes e detalhes que exigem sair do contexto. A área global de OS já possui lista, timeline, calendário e painel rico; o Cliente 360 deve compor essas capacidades, não criar uma segunda implementação.

### Evidências encontradas

- `CampoIdentificador.tsx` calcula sugestões e permite editar siglas ausentes, mas não oferece uma ação explícita que aplique todas e recalcule o Identificador.
- `PainelItensDoCliente.tsx` só busca por nome/identificador apesar de já receber categoria, área, local e relações com sistemas.
- `PainelSistemasCliente.tsx` já recebe composição e localização, mas não filtra.
- `PainelFerramentasCliente.tsx` separa ativas/históricas, porém não permite busca, categoria, situação ou período.
- `PreventivasWorkspace.tsx` concentra calendário, planos e histórico, mas não comunica três modos operacionais consistentes nem usa uma superfície única de detalhe.
- `ordens-servico.ts` já implementa `ehOsRegistroVisita`, incluindo normalização de caixa, acento e espaços. A visão global usa a regra; a composição do Cliente 360 consome backlog/histórico sem aplicá-la.
- `OrdensServicoPage.tsx` e `ChamadoPainel.tsx` já possuem o conteúdo que deve ser reutilizado no drawer contextual.
- `VisaoClientePage.tsx` usa `overflow-x-auto` para quinze abas; no viewport capturado, “Ferramentas” já aparece truncada.

## 2. Decisões

### D-01 — Uma iniciativa, cinco fatias entregáveis

**Decision**: Tratar os pedidos como E01-S163, “Cliente 360 como cockpit operacional”, dividida em cinco user stories independentes.

**Rationale**: Todos dependem do mesmo contexto de cliente, navegação e padrão de detalhe. Separar por correção visual produziria inconsistência; uma única entrega indivisível seria grande demais. As fatias permitem Terra entregar por prioridade.

**Alternatives rejected**:

- Uma story para cada pedido: duplicaria decisões de drawer, query key, autorização e navegação.
- Reescrever o Cliente 360 inteiro: alto risco e pouca capacidade de entrega incremental.

### D-02 — Drawer contextual compartilhado

**Decision**: Extrair o detalhe de OS/Chamado da página global para componente compartilhado e apresentá-lo como drawer no Cliente 360.

**Rationale**: Drawer mantém a lista visível, favorece triagem repetitiva e preserva foco. Compartilhamento evita divergência de regra e ação.

**Alternatives rejected**:

- Navegar para a página global: perde cliente, aba, filtros e rolagem.
- Duplicar o painel no Cliente 360: cria duas fontes de verdade.
- Modal central grande: bloqueia comparação e ocupa mal telas operacionais.

### D-03 — Lista primeiro; calendário e timeline complementares

**Decision**: Preventivas abre em Lista no primeiro uso; a preferência seguinte é lembrada localmente. Todas as visões usam o mesmo conjunto e o mesmo detalhe.

**Rationale**: Lista otimiza triagem e acesso, calendário responde “quando” e timeline explica sequência/histórico. Nenhuma visão atende as três tarefas sozinha.

### D-04 — Histórico preventivo imutável

**Decision**: Metadados do plano podem ser editados. Alvo, primeira data e intervalo só mudam enquanto não há ocorrência materializada. Depois disso, o fluxo seguro é pausar e criar/duplicar um novo plano.

**Rationale**: Recorrência gera obrigações e evidências. Recalcular ocorrências antigas compromete auditoria, indicadores e rastreabilidade com Auvo/OS.

**Alternative rejected**: Atualizar o plano e todas as ocorrências — tecnicamente simples, operacionalmente incorreto.

### D-05 — Apontamento de visita não é OS

**Decision**: Aplicar a função de domínio existente antes de compor backlog, histórico, KPIs e timeline de manutenção do Cliente 360. Não apagar nem alterar a origem.

**Rationale**: O defeito é vazamento de projeção. A regra já está consolidada e testada na área global; outro filtro literal na UI voltaria a divergir.

### D-06 — Filtros por pergunta operacional

**Decision**: Usar os campos já disponíveis e relações carregadas por cliente:

| Aba | Filtros |
|---|---|
| Estrutura | nome/caminho, tipo de nó, área/raiz, com/sem ativos |
| Componentes | nome/identificador, categoria, área/local, sistema/sem sistema, ativo, sync Auvo |
| Sistemas | nome/identificador, categoria, área/local, com/sem componentes |
| Ferramentas | nome, categoria, alocação ativa/devolvida, período de alocação |

Filtros diferentes combinam com AND; escolhas dentro do mesmo filtro combinam com OR. A árvore preserva ancestrais dos resultados.

### D-07 — Sem migration especulativa

**Decision**: Filtrar em memória após consultas escopadas por cliente, usando `useMemo`, e medir com até 1.000 itens. Consultas já têm índices nos principais FKs (`cliente_id`, categoria, área, local e situação).

**Rationale**: A escala é por cliente e os dados já são carregados para renderização. Índice composto/trigram só ajuda se a busca migrar para servidor e o plano de execução demonstrar gargalo.

**Escalation rule**: Se o orçamento de desempenho falhar, não incluir DDL nesta story. Abrir ADR + migration + RLS/query tests como trabalho arquitetural separado.

### D-08 — Aplicar siglas é preview, salvar é persistência

**Decision**: “Aplicar recomendações” copia sugestões editáveis para o cálculo e preenche a prévia. A persistência continua vinculada ao botão Salvar.

**Rationale**: Torna a automação visível e reversível, evita side effect ao abrir o modal e mantém possibilidade de correção humana.

### D-09 — Navegação agrupada, sem novo roteamento

**Decision**: Agrupar abas em Operação, Ativos e Gestão/Relacionamento, com overflow “Mais” em viewport limitado. Preservar o modelo de estado atual, sem reescrever rotas.

**Rationale**: Resolve descoberta e truncamento com baixo risco. Deep linking amplo é problema separado.

## 3. Segurança e isolamento

- `clienteId` participa de todas as query keys e chamadas de leitura.
- Trocar cliente fecha drawers e limpa seleção/filtros incompatíveis.
- Filtros são apenas apresentação; não substituem RLS nem escopo da consulta.
- Ações compartilham os mesmos use cases/políticas da página global.
- Telemetria usa ids técnicos e nome do evento, sem descrições, fotos, CPF/CNPJ ou texto livre.

## 4. Observabilidade

Eventos mínimos: `cliente360_drawer_opened`, `cliente360_filter_changed`, `preventiva_view_changed`, `identificador_recommendations_applied` e resultado das mutações. Falhas Auvo devem manter leitura local disponível e expor retry contextual.

## 5. Perguntas resolvidas por premissa segura

- **Onde ocultar apontamentos?** Em todas as projeções de manutenção, não nos registros de jornada.
- **Qual visão preventiva inicial?** Lista; preferência posterior local.
- **Pode editar recorrência antiga?** Não; pausar e criar novo plano.
- **Filtro de técnico em Ferramentas?** Não nesta aba: a alocação por cliente não possui técnico no modelo consultado. Não inventar junção.
- **Índices novos?** Somente após benchmark e ADR próprios.
