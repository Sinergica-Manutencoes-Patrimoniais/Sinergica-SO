// AC-3 (backlog em aberto, já ordenado pelo servidor — NÃO reordena aqui) e AC-5 (estado vazio).
// Badge de prioridade REAPROVEITA classificarPrioridade(score_pcm) de priorizacao-backlog.ts —
// não duplica a lógica de faixas GUT (E01-S01).
import { Tooltip } from "../../../components/ui/Tooltip";
import type { OrdemServicoResumo } from "../application/cliente-360-gateway";
import {
  type PrioridadeBacklog,
  SCORE_GUT_MAX,
  SCORE_GUT_MIN,
  classificarPrioridade,
} from "../domain/priorizacao-backlog";

const PRIO_MAP: Record<PrioridadeBacklog, { label: string; dot: string }> = {
  critica: { label: "Crítica", dot: "bg-[#E23B2E]" },
  alta: { label: "Alta", dot: "bg-[#EF7E25]" },
  media: { label: "Média", dot: "bg-[#F7A600]" },
  baixa: { label: "Baixa", dot: "bg-[#C2C7D2]" },
};

// score_pcm é GENERATED (coalesce → sempre 1..125), mas guardamos a faixa para não deixar um dado
// inesperado derrubar a UI: fora do intervalo cai em "baixa" em vez de lançar RangeError.
function faixaSegura(score: number): PrioridadeBacklog {
  if (!Number.isInteger(score) || score < SCORE_GUT_MIN || score > SCORE_GUT_MAX) return "baixa";
  return classificarPrioridade(score);
}

export function PainelBacklog({
  ordens,
  onSelecionar,
}: {
  ordens: OrdemServicoResumo[];
  onSelecionar?: (id: string) => void;
}) {
  return (
    <div className="bg-card rounded-[10px] border border-line">
      <div className="px-5 py-4 border-b border-line-soft">
        <h3 className="text-sm font-semibold text-ink">Backlog (OS em aberto)</h3>
        <p className="text-xs text-ink-3 mt-0.5">Priorizadas por score GUT</p>
      </div>

      {ordens.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-ink-3">Nenhuma OS em aberto</div>
      ) : (
        <div className="divide-y divide-line-soft">
          {ordens.map((os) => {
            const prio = PRIO_MAP[faixaSegura(os.scorePcm)];
            return (
              <Tooltip key={os.id} content={os.descricao ?? null}>
                <button
                  type="button"
                  onClick={onSelecionar ? () => onSelecionar(os.id) : undefined}
                  disabled={!onSelecionar}
                  className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-line-soft disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="text-xs font-brand tabular-nums text-ink-3 w-16 shrink-0">
                    {os.numero}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{os.titulo}</p>
                    <p className="text-xs text-ink-3 truncate capitalize">
                      {os.categoria}
                      {os.tecnicoNome ? ` · Técnico: ${os.tecnicoNome}` : ""}
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
                    <span className="text-ink-2">{prio.label}</span>
                  </span>
                  <span className="text-xs font-bold font-brand text-ink-2 tabular-nums shrink-0 w-16 text-right">
                    {os.gravidade ?? 1}·{os.urgencia ?? 1}·{os.tendencia ?? 1}
                    <span className="block text-[10px] font-normal text-ink-3">
                      score {os.scorePcm}
                    </span>
                  </span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}
