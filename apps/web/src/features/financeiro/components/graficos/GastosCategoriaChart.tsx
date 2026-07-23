import type { GastoCategoriaAgregado } from "../../domain/dashboard";
import { centavosParaReais } from "../../domain/dinheiro";
import { EstadoVazio } from "./FluxoMensalChart";

// Sequencial: 1 hue (laranja da marca), claro→escuro por rank. 9º+ item dobra em "Outras".
const TONS = ["#FFE0C2", "#FFC58A", "#FF9F4D", "#F97D1C", "#D9640A", "#B14F05"];
const MAX_ITENS = 6;

/** Barras horizontais de gasto por categoria — magnitude (sequencial), rótulo direto (nome + %),
 * sem legenda (rótulo já identifica cada barra). */
export function GastosCategoriaChart({ itens }: { itens: GastoCategoriaAgregado[] }) {
  if (itens.length === 0) {
    return <EstadoVazio texto="Sem saídas registradas no período." />;
  }

  const principais = itens.slice(0, MAX_ITENS);
  const resto = itens.slice(MAX_ITENS);
  const totalResto = resto.reduce((soma, i) => soma + i.totalCentavos, 0);
  const percentualResto = resto.reduce((soma, i) => soma + i.percentual, 0);
  const linhas =
    resto.length > 0
      ? [
          ...principais,
          {
            categoriaId: "outras",
            nome: "Outras",
            totalCentavos: totalResto,
            percentual: percentualResto,
          },
        ]
      : principais;

  const maior = Math.max(...linhas.map((l) => l.totalCentavos), 1);

  return (
    <div className="flex flex-col gap-2.5">
      {linhas.map((linha, i) => (
        <div key={linha.categoriaId}>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="font-medium text-ink-2">{linha.nome}</span>
            <span className="text-ink-3">
              R$ {centavosParaReais(linha.totalCentavos)} · {linha.percentual.toFixed(0)}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-line-soft">
            <div
              className="h-2.5 rounded-full"
              style={{
                width: `${Math.max((linha.totalCentavos / maior) * 100, 2)}%`,
                backgroundColor: TONS[Math.min(i, TONS.length - 1)],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
