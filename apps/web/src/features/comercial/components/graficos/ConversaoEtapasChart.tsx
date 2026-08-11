/** Funil de conversão por etapa (E03-S08, AC-2). Barras pareadas entraram/avançaram — mesmo padrão
 * de `FluxoMensalChart` (E04-S03): 1 eixo, baseline em 0, sem biblioteca de gráfico. */
import { useState } from "react";
import type { ConversaoEtapa } from "../../application/dashboard-gateway";
import { taxaConversao } from "../../domain/metricas-comercial";

const COR_ENTRARAM = "#2563A8";
const COR_AVANCARAM = "#1E8E45";

export function ConversaoEtapasChart({ etapas }: { etapas: ConversaoEtapa[] }) {
  const [hover, setHover] = useState<string | null>(null);

  if (etapas.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-3">Nenhuma etapa configurada.</p>;
  }

  const maiorValor = Math.max(1, ...etapas.flatMap((e) => [e.entraram, e.avancaram]));
  const largura = 720;
  const altura = 220;
  const margemInferior = 36;
  const alturaUtil = altura - margemInferior;
  const larguraGrupo = largura / etapas.length;
  const larguraBarra = Math.min(18, larguraGrupo / 3);

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-ink-3">
        <Legenda cor={COR_ENTRARAM} label="Entraram" />
        <Legenda cor={COR_AVANCARAM} label="Avançaram" />
      </div>
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        role="img"
        aria-label="Conversão por etapa do funil"
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
        {etapas.map((etapa) => {
          const x = etapas.indexOf(etapa) * larguraGrupo + larguraGrupo / 2;
          const alturaEnt = (etapa.entraram / maiorValor) * (alturaUtil - 8);
          const alturaAv = (etapa.avancaram / maiorValor) * (alturaUtil - 8);
          const taxa = taxaConversao(etapa.entraram, etapa.avancaram);
          return (
            <g
              key={etapa.etapaId}
              onMouseEnter={() => setHover(etapa.etapaId)}
              onMouseLeave={() => setHover(null)}
            >
              <rect
                x={x - larguraBarra - 1}
                y={alturaUtil - alturaEnt}
                width={larguraBarra}
                height={Math.max(alturaEnt, 1)}
                rx={4}
                fill={COR_ENTRARAM}
                opacity={hover && hover !== etapa.etapaId ? 0.35 : 1}
              />
              <rect
                x={x + 3}
                y={alturaUtil - alturaAv}
                width={larguraBarra}
                height={Math.max(alturaAv, 1)}
                rx={4}
                fill={COR_AVANCARAM}
                opacity={hover && hover !== etapa.etapaId ? 0.35 : 1}
              />
              <text x={x} y={altura - 20} textAnchor="middle" className="fill-ink-3" fontSize={10}>
                {etapa.etapaNome}
              </text>
              <text x={x} y={altura - 8} textAnchor="middle" className="fill-ink-2" fontSize={9}>
                {taxa === null ? "—" : `${(taxa * 100).toFixed(0)}%`}
              </text>
            </g>
          );
        })}
      </svg>
      {hover && (
        <p className="mt-1 text-xs text-ink-2">
          {(() => {
            const etapa = etapas.find((e) => e.etapaId === hover);
            if (!etapa) return null;
            return `${etapa.etapaNome}: ${etapa.entraram} entraram, ${etapa.avancaram} avançaram`;
          })()}
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
