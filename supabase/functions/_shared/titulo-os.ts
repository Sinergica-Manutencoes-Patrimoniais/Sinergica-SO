// _shared/titulo-os.ts — E01-S81. Espelho Deno de `apps/web/src/features/pcm/domain/titulo-os.ts`
// (`sanearTituloGerado`) — mesma regra, runtime diferente (convenção do repo: lógica pura pequena
// se duplica entre apps/web e supabase/functions em vez de importar entre os dois bundlers).
const TAMANHO_MAXIMO = 80;

export function sanearTituloGerado(bruto: string): string {
  const semQuebras = bruto.replace(/\s+/g, " ").trim();
  const semAspas = semQuebras.replace(/^["'“](.*)["'”]$/, "$1").trim();
  return semAspas.length > TAMANHO_MAXIMO ? `${semAspas.slice(0, TAMANHO_MAXIMO - 1).trimEnd()}…` : semAspas;
}
