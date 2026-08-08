// E00-S14 AC-3/AC-9 — resolve um token de cor semântico (`--color-{nome}`) pro valor CSS
// computado. Único jeito permitido de um consumidor que precisa de valor resolvido (canvas,
// gráfico, `style={{}}`) obter cor — nunca hex literal.
export function tokenCor(nome: string): string {
  if (typeof document === "undefined") return "";
  const valor = getComputedStyle(document.documentElement).getPropertyValue(`--color-${nome}`);
  return valor.trim();
}
