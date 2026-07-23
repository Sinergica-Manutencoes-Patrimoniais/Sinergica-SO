// HistoricoOsSistema.tsx — E01-S87 AC-2/AC-3: histórico de OS de um Sistema (vinculadas ao
// Sistema em si + aos seus Componentes, deduplicadas) — última manutenção em destaque.
import { useCallback, useEffect, useState } from "react";
import { listarHistoricoOsSistema } from "../application/sistemas";
import type { SistemasGateway } from "../application/sistemas-gateway";
import { ultimaManutencao } from "../domain/historico-ativo";
import type { OsHistoricoItem } from "../domain/historico-ativo";

function dataBr(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

export function HistoricoOsSistema({
  gateway,
  sistemaId,
}: {
  gateway: SistemasGateway;
  sistemaId: string;
}) {
  const [historico, setHistorico] = useState<OsHistoricoItem[] | null | "carregando">("carregando");

  const carregar = useCallback(async () => {
    setHistorico("carregando");
    setHistorico(await listarHistoricoOsSistema(gateway, sistemaId));
  }, [gateway, sistemaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (historico === "carregando") {
    return <p className="text-sm text-ink-3">Carregando histórico…</p>;
  }
  if (historico === null) {
    return <p className="text-xs text-ink-3">Não foi possível carregar o histórico.</p>;
  }
  if (historico.length === 0) {
    return <p className="text-xs text-ink-3">Nenhuma OS registrada para este sistema.</p>;
  }

  return (
    <div>
      <p className="mb-2 text-xs text-ink-3">
        Última manutenção:{" "}
        <strong className="text-ink-2">{dataBr(ultimaManutencao(historico))}</strong>
      </p>
      <ul className="flex flex-col divide-y divide-line-soft">
        {historico.map((os) => (
          <li key={os.osId} className="flex items-center justify-between gap-2 py-1.5 text-xs">
            <span className="font-brand tabular-nums text-ink-3">{os.numero}</span>
            <span className="min-w-0 flex-1 truncate text-ink-2">
              {[os.categoria, os.status].filter(Boolean).join(" · ") || "—"}
            </span>
            <span className="shrink-0 tabular-nums text-ink-3">{dataBr(os.data)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
