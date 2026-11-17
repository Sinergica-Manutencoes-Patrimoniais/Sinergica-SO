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

**Nenhum registro é recriado.** O caminho é de classificação, não de migração de conteúdo:

- Assessment: migration **aditiva** registra o tipo de Inspeção `diagnostico_inicial_cliente` no
  catálogo `pcm.tipos_inspecao` e classifica os Assessments existentes (`0137`, `0958`, `1162`–`1166`)
  como Inspeção desse tipo, **preservando id, histórico e evidências**.
- PMOC: ganha `modalidade='pmoc'` no Plano de Manutenção, com **visão filtrada**. O schema PMOC
  (`0023_E01-S03_pmoc_core.sql` e descendentes) **não é apagado nem reescrito**; documento PMOC já
  emitido não é reescrito (edge case da spec).

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

- Navegação: reverter `navegacao-sso.ts` restaura o menu antigo (dado puro, sem efeito em banco).
- Classificação de Assessment/PMOC: migration de reverso declarada no cabeçalho, como manda
  `db/README.md` — remove a classificação sem tocar nos registros.

## Riscos

- `HomePage.tsx` tem 1309 linhas e concentra a navegação inteira: extrair a árvore **antes** de
  mexer em rótulo, senão o diff fica ilegível.
- Perfil que só tinha acesso ao módulo antigo (edge case da spec) precisa aparecer no inventário
  antes/depois, ou a regressão passa despercebida.
- Pesquisa global que não identifica o tipo do resultado viola AC-9 **e** a restrição dura — é o
  caminho mais fácil para acidentalmente "achatar" as entidades na percepção do usuário.
