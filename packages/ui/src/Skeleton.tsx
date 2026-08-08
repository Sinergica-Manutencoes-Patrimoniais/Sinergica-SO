// E00-S17 AC-1 — forma do conteúdo real, nunca spinner centralizado. `prefers-reduced-motion`
// tira o shimmer e deixa só o bloco estático (respeitado via `.skeleton` em index.css).
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-md bg-line-soft ${className}`} aria-hidden="true" />;
}
