import type { OrdemServicoOperacional, StatusOrdemServico } from "../domain/ordens-servico";
import { PRIORIDADE_LABEL, STATUS_OS, prioridadeColor } from "../domain/ordens-servico";

/** E01-S38 — AC-4/AC-5: uma coluna por status, card muda de coluna via seletor de status (em vez
 * de drag-and-drop — mesmo resultado, menor risco/esforço; reaproveita `alterarStatus` já
 * existente na página). */
export function OsKanbanView({
  ordens,
  temEscrita,
  salvando,
  onAlterarStatus,
  onSelecionar,
}: {
  ordens: OrdemServicoOperacional[];
  temEscrita: boolean;
  salvando: boolean;
  onAlterarStatus: (id: string, status: StatusOrdemServico) => void;
  onSelecionar: (id: string) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STATUS_OS.map((coluna) => {
        const ordensDaColuna = ordens.filter((ordem) => ordem.status === coluna.value);
        return (
          <div
            key={coluna.value}
            className="flex w-72 shrink-0 flex-col rounded-[8px] border border-line bg-paper"
          >
            <div className="flex items-center justify-between border-b border-line-soft px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                {coluna.label}
              </p>
              <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                {ordensDaColuna.length}
              </span>
            </div>
            <div className="flex max-h-[600px] flex-col gap-2 overflow-y-auto p-2">
              {ordensDaColuna.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-ink-3">Vazio</p>
              ) : (
                ordensDaColuna.map((ordem) => (
                  <div
                    key={ordem.id}
                    className="rounded-[6px] border border-line bg-card p-3 hover:border-ink-3"
                  >
                    <button
                      type="button"
                      onClick={() => onSelecionar(ordem.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-brand tabular-nums text-ink-3">
                          {ordem.numero}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${prioridadeColor(ordem.prioridade)}`}
                        >
                          {PRIORIDADE_LABEL[ordem.prioridade] ?? ordem.prioridade}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-ink">{ordem.titulo}</p>
                      <p className="mt-1 text-xs text-ink-3">{ordem.clienteNome}</p>
                      {ordem.tecnicoNome && (
                        <p className="mt-1 text-[11px] text-ink-3">Técnico: {ordem.tecnicoNome}</p>
                      )}
                    </button>
                    {temEscrita && (
                      <select
                        className="input mt-2 h-7 w-full text-xs"
                        value={ordem.status}
                        disabled={salvando}
                        onChange={(event) =>
                          onAlterarStatus(ordem.id, event.target.value as StatusOrdemServico)
                        }
                      >
                        {STATUS_OS.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
