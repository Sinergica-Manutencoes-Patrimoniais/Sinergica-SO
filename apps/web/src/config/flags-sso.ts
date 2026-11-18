// Registro único de flags VITE_SSO_* — E00-S28.
//
// POR QUE ESTE ARQUIVO EXISTE
// Medição de 2026-11-17 (docs/Apontamentos/alcance-no-front-2026-11-17.md): 737 flags lidas
// direto de `import.meta.env` em 434 arquivos, 694 delas nunca declaradas em nenhum arquivo de
// ambiente versionado. Resultado: regra de negócio fechada em produção (Chamado 1:N, migration
// 1842) sem nenhum botão alcançável — `import.meta.env.X` indefinido e `return null` silencioso
// são indistinguíveis de "não foi feito".
//
// REGRA: `flagLigada` é o ÚNICO ponto autorizado a tocar `import.meta.env.VITE_SSO_*`. Nenhum
// outro arquivo deve ler a variável direto — é o que `scripts/check-flags-declaradas.mjs` cobra.
//
// POR QUE O DADO VIVE EM `flags-sso.data.json`, LIDO COMO `?raw` E NÃO POR `resolveJsonModule`
// 737 entradas como array literal `.ts`, ou importadas por `resolveJsonModule` (que faz o TS
// inferir um tipo-tupla literal de 737 posições para o import), deixaram o Biome
// intermitentemente lento/pesado nesta máquina ao processar o arquivo — sem reprodução
// determinística isolada depois de investigado (bisecção apontou para pressão de memória do
// processo, não para um padrão de código específico). Ler via `?raw` (`declare module '*?raw'` em
// `vite/client`, já nos `types` do `tsconfig.json`) evita o problema pela raiz mais plausível: o
// TS enxerga uma `string` comum, nunca infere o tipo-tupla de 737 posições, e `JSON.parse` widening
// o resultado para `FlagSso[]` plano. Se o sintoma voltar (`biome check` relatando OOM), comece
// bissectando aqui antes de desconfiar do conteúdo deste arquivo.
//
// `jornada` e `gate` desta geração inicial (task 1 de E00-S28) foram inferidos pelo caminho do
// primeiro arquivo que lia cada flag — é ponto de partida, não verdade final. `gate` só é
// preenchido quando há correspondência confirmada com uma tabela `*_gate` do banco; os dois
// primeiros (`VITE_SSO_CRIAR_OS_CHAMADO_ENABLED`, `VITE_SSO_CONVERSAO_INTEGRAL_ENABLED`) foram
// confirmados manualmente contra `0324_E01-S167_fundacao_revisao_chamado.sql` e
// `1037_E01-S167_mediar_criacao_os_chamado.sql`. Cada lote da migração (tasks 8–13) deve revisar
// e corrigir `jornada`/`gate`/`descricao` das flags do seu diretório — não é obrigação cobrir as
// 737 de uma vez.
import dadosRegistroCru from "./flags-sso.data.json?raw";

export type JornadaSso =
  | "chamado-1n"
  | "backlog"
  | "visita"
  | "materiais"
  | "faturaveis"
  | "estrutura"
  | "portal"
  | "integracao-auvo"
  | "administracao"
  | "outra";

export interface FlagSso {
  /** Nome exato da variável de build, sempre `VITE_SSO_*`. */
  readonly nome: `VITE_SSO_${string}`;
  /** Valor assumido quando a variável não veio do build. Toda flag nasce `false` nesta story —
   * ela não liga nada, só documenta o que já existia ligado ou desligado no ambiente real. */
  readonly padrao: boolean;
  /** Jornada de negócio que a flag controla — usada pelo diagnóstico de E01-S188 e pelo
   * inventário desta story (AC-8). */
  readonly jornada: JornadaSso;
  /** Gate de banco correspondente (`schema.tabela_gate`), quando existe e já foi confirmado. */
  readonly gate?: string;
  /** Uma linha em PT-BR, legível por quem não leu o código. */
  readonly descricao: string;
}

export const FLAGS_SSO: readonly FlagSso[] = JSON.parse(dadosRegistroCru) as readonly FlagSso[];

// Única passagem sobre `FLAGS_SSO` do arquivo inteiro — monta o índice por nome de uma vez; as
// funções abaixo iteram `INDICE_POR_NOME` (já pequeno, indexado) em vez de encadear `.filter`/
// `.map` direto sobre o array de 737 posições de novo a cada chamada.
const INDICE_POR_NOME = new Map(FLAGS_SSO.map((flag) => [flag.nome, flag]));

/** Único ponto autorizado a ler `import.meta.env.VITE_SSO_*`. Qualquer outro lugar do front que
 * precise saber se uma jornada está ativada passa por aqui — nunca por `import.meta.env` direto. */
export function flagLigada(nome: FlagSso["nome"]): boolean {
  const flag = INDICE_POR_NOME.get(nome);
  const valor = (import.meta.env as Record<string, string | undefined>)[nome];
  if (valor === "true") return true;
  if (valor === "false") return false;
  return flag?.padrao ?? false;
}

export function flagsDaJornada(jornada: JornadaSso): readonly FlagSso[] {
  const resultado: FlagSso[] = [];
  for (const flag of INDICE_POR_NOME.values()) if (flag.jornada === jornada) resultado.push(flag);
  return resultado;
}

/** Dadas as flags efetivamente lidas no código-fonte (saída do scanner estático), devolve as que
 * não estão neste registro — é a condição 1 do gate de CI (AC-1). */
export function flagsNaoDeclaradas(lidasNoCodigo: readonly string[]): readonly string[] {
  const resultado: string[] = [];
  for (const nome of lidasNoCodigo)
    if (!INDICE_POR_NOME.has(nome as FlagSso["nome"])) resultado.push(nome);
  return resultado;
}

/** Entradas do registro que nenhum arquivo lê — é a condição 2 do gate de CI (AC-2), declaração
 * morta também é ruído. */
export function flagsOrfas(lidasNoCodigo: readonly string[]): readonly FlagSso[] {
  const lidas = new Set(lidasNoCodigo);
  const resultado: FlagSso[] = [];
  for (const flag of INDICE_POR_NOME.values()) if (!lidas.has(flag.nome)) resultado.push(flag);
  return resultado;
}
