// AC-4 (histórico de OS concluídas/canceladas, status refletindo a sincronização do Auvo) e
// AC-5 (estado vazio). Read-only — sem nenhuma ação de mutação.
import type { OrdemServicoResumo } from "../application/cliente-360-gateway";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  finalizado: { label: "Finalizado", cls: "bg-[#E7F6EC] text-[#1E8E45]" },
  cancelado: { label: "Cancelado", cls: "bg-[#FBEAEA] text-[#C5362B]" },
};

export function PainelHistorico({ ordens }: { ordens: OrdemServicoResumo[] }) {
  return (
    <div className="bg-card rounded-[10px] border border-line">
      <div className="px-5 py-4 border-b border-line-soft">
        <h3 className="text-sm font-semibold text-ink">Histórico de OS</h3>
        <p className="text-xs text-ink-3 mt-0.5">
          Concluídas e canceladas — status do campo (Auvo)
        </p>
      </div>

      {ordens.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-ink-3">Nenhum histórico ainda</div>
      ) : (
        <div className="divide-y divide-line-soft">
          {ordens.map((os) => {
            const status = STATUS_LABEL[os.status] ?? {
              label: os.status,
              cls: "bg-[#EFF1F4] text-[#5A6175]",
            };
            return (
              <div key={os.id} className="px-5 py-3.5 flex items-center gap-3">
                <span className="text-xs font-brand tabular-nums text-ink-3 w-16 shrink-0">
                  {os.numero}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{os.titulo}</p>
                  <p className="text-xs text-ink-3 truncate capitalize">{os.categoria}</p>
                </div>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${status.cls}`}
                >
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
