/** Distribuição de motivos de perda (E03-S08, AC-4) — barras horizontais, 1 série (uma cor), rótulo
 * direto do valor (poucas categorias, cabe sem poluir). Mesma disciplina de `FluxoMensalChart`. */
import type { WinLossLinha } from "../../application/dashboard-gateway";

const COR_PERDA = "#A23B25";

export function MotivosPerdaChart({ linhas }: { linhas: WinLossLinha[] }) {
  const perdidas = linhas
    .filter((l) => l.categoria === "perdida")
    .sort((a, b) => b.quantidade - a.quantidade);

  if (perdidas.length === 0) {
    return <p className="py-8 text-center text-body text-ink-3">Nenhuma perda no período.</p>;
  }

  const maior = Math.max(1, ...perdidas.map((l) => l.quantidade));
  const alturaLinha = 28;
  const altura = perdidas.length * alturaLinha;
  const largura = 520;
  const larguraRotulo = 160;
  const larguraBarraMax = largura - larguraRotulo - 32;

  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      role="img"
      aria-label="Distribuição de motivos de perda"
      width="100%"
      height={altura}
    >
      {perdidas.map((linha, i) => {
        const y = i * alturaLinha;
        const larguraBarra = (linha.quantidade / maior) * larguraBarraMax;
        return (
          <g key={linha.motivoNome ?? "sem-motivo"}>
            <text
              x={larguraRotulo - 8}
              y={y + alturaLinha / 2 + 4}
              textAnchor="end"
              className="fill-ink-2"
              fontSize={11}
            >
              {linha.motivoNome ?? "Sem motivo"}
            </text>
            <rect
              x={larguraRotulo}
              y={y + 6}
              width={Math.max(larguraBarra, 2)}
              height={alturaLinha - 12}
              rx={4}
              fill={COR_PERDA}
            />
            <text
              x={larguraRotulo + larguraBarra + 6}
              y={y + alturaLinha / 2 + 4}
              className="fill-ink"
              fontSize={11}
              fontWeight={600}
            >
              {linha.quantidade}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
