---
name: plan
description: Detalhe técnico de E01-S190 — menu, rotas, consolidação de Assessment e PMOC. Puxe ao implementar.
alwaysApply: false
---

# Plan — E01-S190 · Onda Zero, navegação consolidada

## Estado real do menu hoje

Fonte: `apps/web/src/app/HomePage.tsx` (1309 linhas; a navegação do PCM está em grupos literais) e
`apps/web/src/app/modulos.ts` (módulos de topo).

Grupos atuais do PCM e o destino de cada entrada:

| Grupo atual | Entrada | Destino aprovado |
|---|---|---|
| OPERAÇÃO | Dashboard, Chamados | **Trabalho** (ficam) |
| OPERAÇÃO | Inspeções | **Trabalho** — passa a conter o tipo "Diagnóstico Inicial do Cliente" |
| OPERAÇÃO | **Assessment** | **sai do menu** — vira tipo de Inspeção |
| OPERAÇÃO | **PMOC** | **sai do menu** — vira modalidade do Plano de Manutenção, com visão filtrada |
| OPERAÇÃO | Preventivas | **Trabalho** (fica; é fila operacional) |
| OPERAÇÃO | **Agenda do Técnico** | **absorvida** por "Planejamento e Visitas" |
| OPERAÇÃO | Ferramentas por Técnico | **Gestão** — unificada com Ferramentas em "Equipes e Recursos" |
| OPERAÇÃO | Relatório | **Relatórios** (central única) |
| CADASTROS | Clientes | **Clientes e Estrutura** (entrada pela Visão 360) |
| CADASTROS | **Componentes**, **Sistemas** | **saem do menu principal** — alcançáveis pela jornada da estrutura |
| CADASTROS | Ferramentas | **Gestão** — "Equipes e Recursos" |
| CONFIGURAÇÕES | Tipos de Tarefa, Grupos de Clientes, Marcações, Tipos de Inspeção, Categorias Equip., Segmentos, Palavras-chave | **Administração** (só perfil autorizado) |
| CONFIGURAÇÕES | Equipes, Funcionários | **Gestão** — "Equipes e Recursos" |
| CONFIGURAÇÕES | Grupos de Usuário | **Administração** |
| RELATÓRIOS | Relatório do Dia, do Cliente, Laudo SPDA, Apontamento de Horas | **Relatórios** (central única, visões por finalidade) |

Resultado: três níveis — **Trabalho · Gestão · Administração** —, com as áreas que a spec nomeia
(Clientes e Estrutura, Planejamento e Visitas, Central de Pendências, Relatórios) dentro de Trabalho.

## Restrição dura (decisão 2 do Fabrício, 17/11)

A unificação é **de menu e jornada**. `pcm.clientes`, `pcm.areas`, Locais, Sistemas,
`pcm.equipamentos` (Componente na UI), Equipamentos e Grupos quantitativos **continuam entidades
separadas**. Nenhuma migration desta story funde tabela, cria tipo genérico ou altera FK de
estrutura. Se o código exigir isso para o menu funcionar, o desenho está errado — pare e registre
`SPEC_DEVIATION`.

Auvo por tipo: Sistema e equipamento controlado podem ter vínculo; Componente e Grupo quantitativo
**permanecem só no SSO**. Esta story **não altera** a política de sync; só não pode contrariá-la na
navegação.

## Arquitetura

```
apps/web/src/app/
  navegacao-sso.ts          (novo, puro)  árvore Trabalho/Gestão/Administração + capacidade exigida
  navegacao-sso.test.ts     (novo)
  rotas-legadas.ts          (novo, puro)  mapa rota antiga -> rota nova (AC-3)
  rotas-legadas.test.ts     (novo)
  HomePage.tsx              (altera)      consome a árvore em vez dos grupos literais
  modulos.ts                (altera)      rótulos das áreas

apps/web/src/features/pcm/
  interfaces/estrutura/PesquisaGlobalEstrutura.tsx  (novo)  AC-9
  domain/tipo-inspecao.ts   (altera)      acrescenta 'diagnostico_inicial_cliente'
```

### `navegacao-sso.ts` — assinaturas

```ts
export type Nivel = 'trabalho' | 'gestao' | 'administracao'
export interface EntradaNav {
  readonly id: string
  readonly label: string
  readonly nivel: Nivel
  readonly view: string
  readonly capacidade?: string       // quando ausente, basta a permissão do módulo
  readonly absorveu?: readonly string[]  // ids antigos que esta entrada passou a conter
}
export const NAVEGACAO_SSO: readonly EntradaNav[]
export function navegacaoVisivel(
  entradas: readonly EntradaNav[],
  podeAcessar: (modulo: string, nivel: 'leitura'|'escrita') => boolean,
  capacidades: ReadonlySet<string>,
): readonly EntradaNav[]
```

`navegacaoVisivel` é **pura** e é o ponto do AC-6: ocultar é consequência da permissão, nunca lista
fixa por papel. Quando `E00-S26` existir, `capacidades` passa a vir dela; até lá, conjunto vazio.

### Consolidação de dados — AC-1, AC-2

**Nenhum registro é recriado.** O caminho é de classificação, não de migração de conteúdo.

#### Inventário real das tabelas (levantado antes de escrever SQL — tasks 6/7)

**Assessment — já é uma Inspeção. Não existe tabela de Assessment.**

| Objeto | Migration | O que é |
|---|---|---|
| `pcm.inspecoes` (`id`, `client_id`, `titulo`, `status`, `codigo`, soft delete) | `0019_E01-S19` | a Inspeção |
| `pcm.inspecoes.e_assessment boolean not null default false` | `0137_E01-S90` | o marcador do assessment |
| `pcm.inspecoes.motivo_assessment` (`inicio`/`alteracao_contrato`/`anual`) | `0137_E01-S90` | motivo |
| `pcm.inspecoes.tipo_inspecao_id uuid` → `pcm.tipos_inspecao(id)` | `0091_E01-S73` (FK validada em `0092`) | **o campo de tipo que já existia e estava NULO nos assessments** |
| `pcm.tipos_inspecao` (`id`, `nome`, `norma_tecnica`, `descricao`, `ativo`, soft delete) | `0091_E01-S73` | catálogo de tipos, administrado em `TiposInspecaoPage` |
| `pcm.checklist_templates` / `pcm.checklist_template_itens` | `0091_E01-S73` | checklist por tipo |
| `pcm.inspecao_itens` (+ `destino`, `destino_responsavel`, `auvo_questao_chave`, `midias`, GUT) | `0019`, `0137`, `0150`, `0174`, `0179` | itens e evidências |
| `pcm.chamados.origem_inspecao_item_id` | `0137`/`0138` | rastro item → Chamado |
| `comercial.propostas.assessment_id` → `pcm.inspecoes(id)` + triggers `s181_*` | `0958`, `1162`–`1166` | vínculo de pré-venda, com guarda de cliente |
| questionário Auvo / `auvo_task_id` | `0165`, `0170`, `0185`–`0187` | origem dos itens |

**PMOC — NÃO é um Plano de Manutenção.**

| Objeto | Migration | O que é |
|---|---|---|
| `pcm.pmoc_properties`, `pmoc_equipment`, `pmoc_contracts`, `pmoc_schedules`, `pmoc_records`, `pmoc_microbio_analysis`, `pmoc_nonconformity_log` | `0023_E01-S03` | cadastro e execução PMOC, ancorados em `pmoc_properties.client_id`, **sem nenhuma FK para `pcm.planos_manutencao`** |
| `pcm.planos_manutencao` (`id`, `cliente_id`, `nome`, `estado`, `revisao`) | `0260_E01-S165` | o Plano |
| `pcm.plano_versoes`, `pcm.rotinas_manutencao` (`plano_id`, `rotina_logica_id`, alvo em sistema/componente/grupo) | `0261_E01-S165` | versões e rotinas |
| `pcm.rotina_origem_geracao` (`origem in ('plano','pmoc')`) | `0337_E01-S166` | **declaração explícita do PCM de que um ciclo é de origem PMOC** |
| `pcm.sso_vinculos_ciclo_pmoc` (`plano_id`, `contrato_pmoc_id`, `agendamento_id`) | `1631_E01-S166` | ponte Plano ↔ PMOC, atrás de gate fechado |

#### O que as migrations fazem

- **`1868_E01-S190_diagnostico_inicial_cliente.sql` (task 6):** `pcm.tipos_inspecao` ganha `chave`
  (índice único parcial); nasce a linha `diagnostico_inicial_cliente` / "Diagnóstico Inicial do
  Cliente"; `update` aditivo preenche `tipo_inspecao_id` **só onde `e_assessment` é verdadeiro e o
  tipo é nulo**, com um `audit.events` por linha; um trigger `before insert or update` mantém a
  equivalência nos dois sentidos daí em diante e também audita. `e_assessment` e
  `motivo_assessment` permanecem (sinônimo histórico). Índice
  `idx_inspecoes_tipo_inspecao` para o filtro por tipo na lista de Inspeções.
- **`1869_E01-S190_modalidade_pmoc_plano.sql` (task 7):** `pcm.planos_manutencao.modalidade`
  (`padrao`/`pmoc`, CHECK `not valid` + `validate` dentro de um `do $$` atômico); view filtrada
  `pcm.planos_pmoc` com `security_invoker = true`; classificação **só** dos Planos que o PCM já
  declarou PMOC (`rotina_origem_geracao.origem = 'pmoc'` ou `sso_vinculos_ciclo_pmoc`), auditada.
- **Fora de escopo, com motivo escrito:** transformar `pcm.pmoc_contracts` existentes em
  `pcm.planos_manutencao` **não é feito** — seria criar registro, não classificar. A pergunta de
  produto está textual em **ADR-1697 §3**. Por isso PMOC **continua no menu** (tirá-lo deixaria
  imóvel, ART, inventário de AR e laudos sem porta de entrada — AC-7).

O schema PMOC (`0023_E01-S03_pmoc_core.sql` e descendentes) **não é apagado nem reescrito**;
documento PMOC já emitido não é reescrito (edge case da spec).

### Rotas antigas — AC-3

`rotas-legadas.ts` é um mapa puro `antiga → nova`, consumido pelo roteador. Teste de tabela cobre
**todas** as views citadas no inventário acima. Rota antiga responde com redirecionamento; **nunca**
com erro.

## Alcance no front — AC-F1 a AC-F5

Esta story **é** navegação, então o alcance é o produto, não um anexo:

- **Caminho nomeado:** Trabalho → Clientes e Estrutura → (Visão 360 do cliente) → Áreas → Locais →
  Sistemas → Equipamentos → Componentes/Grupos. Pesquisa global no topo da mesma área.
- **Flags:** a story não introduz flag nova. Se um lote precisar de uma, entra em `FLAGS_SSO`
  (`E00-S28`) no mesmo PR, padrão `false`.
- **Gates:** nenhum gate de banco novo; a migration de classificação é aditiva e não tem gate.
- **Regressão de alcance (AC-7):** o inventário antes/depois é artefato obrigatório do PR —
  `scripts/inventariar-navegacao.mjs` imprime ações alcançáveis por perfil, e o diff vai no corpo do PR.

## Procedimento de retorno

- Navegação: desligar `VITE_SSO_ASSESSMENT_COMO_INSPECAO_ENABLED` (ou
  `VITE_SSO_NAVEGACAO_POR_FUNCAO_ENABLED`) restaura o menu antigo — dado puro, sem efeito em banco.
- Classificação de Assessment/PMOC: reverso exato declarado no cabeçalho de cada migration, lido
  de `audit.events` (nunca "tudo que tem o tipo X"). **A ordem importa:** em `1868` o trigger cai
  ANTES do `update`, senão a regra repõe a classificação na mesma transação — provado pelo teste
  29 do pgTAP. Nenhum registro é apagado em nenhum passo do reverso.

## Riscos

- `HomePage.tsx` tem 1309 linhas e concentra a navegação inteira: extrair a árvore **antes** de
  mexer em rótulo, senão o diff fica ilegível.
- Perfil que só tinha acesso ao módulo antigo (edge case da spec) precisa aparecer no inventário
  antes/depois, ou a regressão passa despercebida.
- Pesquisa global que não identifica o tipo do resultado viola AC-9 **e** a restrição dura — é o
  caminho mais fácil para acidentalmente "achatar" as entidades na percepção do usuário.

## Continuação 25/11 — tasks 11/12 (owner Codex)

Pesquisa e navegação em `interfaces/estrutura/PesquisaGlobalEstrutura.tsx`, dentro da aba Estrutura
na Visão 360. Gateway de leitura em `application/pesquisa-estrutura-gateway.ts`; adapter reúne
Áreas, Locais, Sistemas, Equipamentos/Componentes, vínculos e Grupos sem alterar schema ou entidades.
TanStack Query por usuário/Cliente/fonte, sem reaproveitar dado de outra identidade, cancelamento
e reconferência de sessão; fontes parciais e paginação explicitadas. Domínio puro constrói caminhos,
filtra nome/código/TAG e mantém localização distinta de pertencimento funcional. Detalhes reutilizam
as telas de Sistema, Ativo e Composição do Local; Grupo mantém identidade e histórico próprios.
Não retirar entradas legadas antes de provar alcance. Nenhuma flag ou gate novo.

### Consulta definitiva (ADR-1701)
A composição no navegador foi substituída na implementação por uma RPC paginada única,
`pcm.sso_pesquisar_estrutura` (migration 1893). Isso permite pesquisa em todo o Cliente e código
atual de Grupo sem N+1. Contrato em `application/pesquisa-estrutura-gateway.ts`; adapter valida
Zod, sessão antes/depois e cancelamento; hook em `application/pesquisa-estrutura-queries.ts`.
Cursor tipo:id, limite 50 na UI/100 no servidor; contexto tipado por entidade. Leitura requer
cadastro.ler ou cadastro.gerir no Cliente e PCM relido ao vivo. Nenhum gate ou flag novo.
