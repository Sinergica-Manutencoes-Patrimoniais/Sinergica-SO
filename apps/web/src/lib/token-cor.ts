// E00-S14 AC-3/AC-9 — resolve um token de cor semântico (`--color-{nome}`) pro valor CSS
// computado. Único jeito permitido de um consumidor que precisa de valor resolvido (canvas,
// gráfico, `style={{}}`) obter cor — nunca hex literal.
export function tokenCor(nome: string): string {
  if (typeof document === "undefined") return "";
  const valor = getComputedStyle(document.documentElement).getPropertyValue(`--color-${nome}`);
  return valor.trim();
}

function luminanciaRelativa(hex: string): number {
  const limpo = hex.replace("#", "");
  const canal = (valorHex: string) => {
    const c = Number.parseInt(valorHex, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = canal(limpo.slice(0, 2));
  const g = canal(limpo.slice(2, 4));
  const b = canal(limpo.slice(4, 6));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// DEF-32 — razão de contraste WCAG 2.x entre duas cores hex (#rrggbb), fórmula de luminância
// relativa. Pura (sem DOM) pra poder testar par de tokens dos dois temas sem montar componente.
// Alvo AA: 4.5:1 texto normal, 3:1 texto grande/componentes de interface (critério usado aqui).
export function razaoContrasteWcag(corA: string, corB: string): number {
  const lA = luminanciaRelativa(corA);
  const lB = luminanciaRelativa(corB);
  const clara = Math.max(lA, lB);
  const escura = Math.min(lA, lB);
  return (clara + 0.05) / (escura + 0.05);
}
