---
name: plan
description: Detalhe técnico de E00-S28 — registro de flags, gate de CI, estado de indisponibilidade. Puxe ao implementar.
alwaysApply: false
---

# Plan — E00-S28 · Ativação visível no front

## Estado medido (ponto de partida, não suposição)

| Medida | Valor | Comando que reproduz |
|---|---|---|
| Flags `VITE_SSO_*` lidas no código | 737 | `grep -rhoE "VITE_SSO_[A-Z0-9_]+" apps/web/src \| sort -u \| wc -l` |
| Arquivos que leem alguma flag | 434 | varredura de `apps/web/src` |
| Declaradas em `.env.example`/`netlify.toml`/`.env.local` | 43 | `grep -cE "^VITE_SSO_" .env.example` |
| Usadas e nunca declaradas | **694** | diferença |
| `return null` silencioso atrás de flag | 227 | varredura por contexto de 120 chars |

`netlify.toml` **não declara nenhuma flag** — elas são setadas na UI do Netlify. Por isso a fonte de
verdade versionada não pode ser o `netlify.toml`: tem que ser um **registro no código**.

## Decisão de arquitetura

Hoje cada componente lê `import.meta.env.VITE_SSO_X` direto. Isso é o que torna o conjunto
invisível: não há lugar onde a lista exista.

A story troca isso por **um registro único e tipado**, e proíbe a leitura direta fora dele.

```
apps/web/src/config/
  flags-sso.ts          (novo)  registro: nome, padrão, jornada, gate correspondente, dono
  flags-sso.test.ts     (novo)
  env.ts                (estende) valida o registro na inicialização, fail-fast como já faz

packages/ui/src/
  RecursoNaoAtivado.tsx (novo)  estado "disponível, não ativado"
  RecursoNaoAtivado.test.tsx

scripts/
  check-flags-declaradas.mjs       (novo)  gate de CI
  check-flags-declaradas.test.mjs  (novo)
  codemod-flags-registro.mjs       (novo)  migra leitura direta -> registro, em lotes
```

### `config/flags-sso.ts` — assinaturas

```ts
export type JornadaSso = 'chamado-1n' | 'backlog' | 'visita' | 'materiais' | 'faturaveis'
  | 'estrutura' | 'portal' | 'integracao-auvo' | 'administracao' | 'outra'

export interface FlagSso {
  readonly nome: `VITE_SSO_${string}`
  readonly padrao: boolean              // valor quando a variável não vem do build
  readonly jornada: JornadaSso
  readonly gate?: string                // ex.: 'pcm.chamado_os_gate' — par no servidor, quando existe
  readonly descricao: string            // uma linha, em PT-BR, legível por quem não leu o código
}

export const FLAGS_SSO: readonly FlagSso[]
export function flagLigada(nome: FlagSso['nome']): boolean
export function flagsDaJornada(jornada: JornadaSso): readonly FlagSso[]
export function flagsNaoDeclaradas(lidasNoCodigo: readonly string[]): readonly string[]
```

Regra: `flagLigada` é o **único** lugar que toca `import.meta.env`. Padrão de toda flag migrada
nesta story é `false` — a story **não liga nada**.

### `packages/ui/RecursoNaoAtivado.tsx` — contrato

```ts
export interface RecursoNaoAtivadoProps {
  recurso: string                        // nome humano: "Criar OS neste Chamado"
  faltando?: readonly string[]           // ['VITE_SSO_CRIAR_OS_CHAMADO_ENABLED', 'pcm.chamado_os_gate']
  podeAdministrar: boolean               // decide o nível de detalhe
}
```

Comportamento:

- `podeAdministrar === true` → nomeia o recurso **e** o que falta, com link para o runbook de ativação.
- `podeAdministrar === false` → só "Este recurso existe e ainda não está ativado para a sua operação".
  **Nunca** nome de flag, gate ou tabela — AC-6.
- Em nenhum caso renderiza `null`.

### `scripts/check-flags-declaradas.mjs` — o gate

Falha o CI quando:

1. existe `VITE_SSO_*` lida em `apps/web/src` e ausente de `FLAGS_SSO` → **AC-1**;
2. existe entrada em `FLAGS_SSO` que nenhum arquivo lê → órfã, **AC-2**;
3. existe `import.meta.env.VITE_SSO_` **fora** de `config/flags-sso.ts` → fuga do registro;
4. existe construção dinâmica (`import.meta.env[\`VITE_SSO_${x}\`]`) → caminho de fuga, recusado
   (edge case da spec).

Saída: lista `flag → arquivo:linha`, código de saída 1. Plugue no laço já existente de
`.github/workflows/ci.yml:104` (`for c in tokens-cor primitivas ... div-clicavel`), acrescentando
`flags-declaradas` à lista — mesmo padrão dos nove gates de design que já rodam ali.

### Erros do servidor na borda — AC-7

Hoje `42501` (sem grant) e `55000` (gate fechado) chegam como erro genérico. O adapter passa a
traduzir:

| Código | Significado | O que a tela mostra |
|---|---|---|
| `42501` | falta `grant execute` / RLS negou | "Você não tem permissão para esta ação" |
| `55000` | gate de banco fechado | `RecursoNaoAtivado` com o gate em `faltando` (só a administrador) |
| demais | erro real | mensagem de erro atual |

Centralizar em `apps/web/src/lib/http/problem.ts` (já existe) para não repetir em 434 arquivos.

## Migração em lotes — como não virar um PR de 434 arquivos

Ordem por domínio, um PR por lote, cada um fechando com o gate ligado para aquele diretório
(`check-flags-declaradas.mjs --dir`):

1. `features/pcm/interfaces/chamados-os/` — é o caso do Lucas, serve de referência;
2. resto de `features/pcm/`;
3. `features/area-cliente/` (atenção ao AC-6: portal não pode vazar nome interno);
4. `features/financeiro/` + `features/comercial/`;
5. `features/atendimento/` + `features/config/`;
6. `app/` e o que sobrar; só então o gate liga para o repositório inteiro.

## Procedimento de abertura e de retorno — AC-F4

Esta story **não cria gate de banco e não abre nenhum**. O gate que ela cria é de **CI**:

- **Abertura:** acrescentar `flags-declaradas` ao laço do `ci.yml` **depois** do lote 6.
- **Retorno:** remover a entrada do laço. Nenhuma migration, nenhum efeito em produção.

## Caminho de navegação — AC-F1

A story não acrescenta tela nova. O que ela entrega aparece **onde a funcionalidade já deveria estar**:
no lugar exato do `return null` de hoje. Referência verificável: painel do Chamado
(`ChamadoPainel.tsx:244`) passa a mostrar `RecursoNaoAtivado` em vez de nada.

## Riscos

- **Falso positivo do gate** em flag usada só por teste: o script ignora `*.test.ts(x)` e arquivos em `mock/`.
- **Lote 3 (portal)**: vazar nome de flag para o síndico é regressão de segurança, não de UX — revisar com `@security`.
- **Ruído de review**: 434 arquivos em 6 PRs ainda é muito; cada PR precisa de diff mecânico (codemod), nunca edição manual linha a linha.
