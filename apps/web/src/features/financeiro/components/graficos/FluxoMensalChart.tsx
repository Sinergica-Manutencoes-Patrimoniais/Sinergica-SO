import { useState } from "react";
import { formatarMesCurto } from "../../domain/dashboard";
import type { PontoFluxoMensal } from "../../domain/dashboard";
import { centavosParaReais } from "../../domain/dinheiro";

const COR_ENTRADA = "#1E8E45";
const COR_SAIDA = "#A23B25";

/** Barras agrupadas entrada/saída por mês — 1 eixo, baseline em 0, 12 pontos zero-preenchidos.
 * Legenda sempre visível (2 séries). Tooltip simples no hover de cada barra. */
export function FluxoMensalChart({ pontos }: { pontos: PontoFluxoMensal[] }) {
  const [hover, setHover] = useState<{ mes: string; entradas: number; saidas: number } | null>(
    null,
  );

  if (pontos.length === 0) {
    return <EstadoVazio texto="Sem movimentos no período." />;
  }

  const maiorValor = Math.max(1, ...pontos.flatMap((p) => [p.entradasCentavos, p.saidasCentavos]));
  const largura = 720;
  const altura = 200;
  const margemInferior = 24;
  const alturaUtil = altura - margemInferior;
  const larguraGrupo = largura / pontos.length;
  const larguraBarra = Math.min(18, larguraGrupo / 3);

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-ink-3">
        <Legenda cor={COR_ENTRADA} label="Entradas" />
        <Legenda cor={COR_SAIDA} label="Saídas" />
      </div>
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        role="img"
        aria-label="Fluxo mensal de entradas e saídas"
        className="w-full"
      >
        <line
          x1={0}
          y1={alturaUtil}
          x2={largura}
          y2={alturaUtil}
          stroke="currentColor"
          className="text-line"
          strokeWidth={1}
        />
        {pontos.map((ponto, i) => {
          const x = i * larguraGrupo + larguraGrupo / 2;
          const alturaEntrada = (ponto.entradasCentavos / maiorValor) * (alturaUtil - 8);
          const alturaSaida = (ponto.saidasCentavos / maiorValor) * (alturaUtil - 8);
          return (
            <g
              key={ponto.mes}
              onMouseEnter={() =>
                setHover({
                  mes: ponto.mes,
                  entradas: ponto.entradasCentavos,
                  saidas: ponto.saidasCentavos,
                })
              }
              onMouseLeave={() => setHover(null)}
            >
              <rect
                x={x - larguraBarra - 1}
                y={alturaUtil - alturaEntrada}
                width={larguraBarra}
                height={Math.max(alturaEntrada, 1)}
                rx={4}
                fill={COR_ENTRADA}
                opacity={hover && hover.mes !== ponto.mes ? 0.35 : 1}
              />
              <rect
                x={x + 3}
                y={alturaUtil - alturaSaida}
                width={larguraBarra}
                height={Math.max(alturaSaida, 1)}
                rx={4}
                fill={COR_SAIDA}
                opacity={hover && hover.mes !== ponto.mes ? 0.35 : 1}
              />
              <text x={x} y={altura - 6} textAnchor="middle" className="fill-ink-3" fontSize={10}>
                {formatarMesCurto(ponto.mes)}
              </text>
            </g>
          );
        })}
      </svg>
      {hover && (
        <p className="mt-1 text-xs text-ink-2">
          {formatarMesCurto(hover.mes)}: entradas R$ {centavosParaReais(hover.entradas)} · saídas R${" "}
          {centavosParaReais(hover.saidas)}
        </p>
      )}
    </div>
  );
}

function Legenda({ cor, label }: { cor: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cor }} />
      {label}
    </span>
  );
}

export function EstadoVazio({ texto }: { texto: string }) {
  return <p className="py-8 text-center text-sm text-ink-3">{texto}</p>;
}
