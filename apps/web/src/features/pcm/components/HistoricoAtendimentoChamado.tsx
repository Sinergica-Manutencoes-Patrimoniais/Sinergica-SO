// HistoricoAtendimentoChamado.tsx — E01-S89: exibe os snapshots de conversa (WhatsApp/Atendimento)
// anexados a um Chamado. Leitura via `ChamadosGateway.listarHistoricoAtendimento` (Conformist).
import { useCallback, useEffect, useState } from "react";
import { listarHistoricoAtendimento } from "../application/chamados";
import type { ChamadosGateway } from "../application/chamados-gateway";
import type { HistoricoAtendimentoChamado as Snapshot } from "../domain/chamados";

function dataHoraBr(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}

export function HistoricoAtendimentoChamado({
  gateway,
  chamadoId,
}: {
  gateway: ChamadosGateway;
  chamadoId: string;
}) {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null | "carregando">("carregando");

  const carregar = useCallback(async () => {
    setSnapshots("carregando");
    try {
      setSnapshots(await listarHistoricoAtendimento(gateway, chamadoId));
    } catch {
      setSnapshots(null);
    }
  }, [gateway, chamadoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (snapshots === "carregando") {
    return <p className="text-sm text-ink-3">Carregando histórico de atendimento…</p>;
  }
  if (snapshots === null) {
    return <p className="text-xs text-ink-3">Não foi possível carregar o histórico.</p>;
  }
  if (snapshots.length === 0) {
    return <p className="text-xs text-ink-3">Nenhum histórico de conversa anexado ainda.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-line-soft">
      {snapshots.map((snap) => (
        <li key={snap.id} className="py-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink-2">
              Últimos {snap.janelaDias} dia{snap.janelaDias > 1 ? "s" : ""} · {snap.totalMensagens}{" "}
              mensage{snap.totalMensagens > 1 ? "ns" : "m"}
            </span>
            <span className="shrink-0 tabular-nums text-ink-3">{dataHoraBr(snap.createdAt)}</span>
          </div>
          <div className="mt-1.5 flex flex-col gap-1 rounded-[6px] bg-line-soft/50 p-2">
            {snap.mensagens.map((msg) => (
              <p key={msg.id} className="text-ink-3">
                <span className="font-semibold text-ink-2">{msg.remetenteTipo}:</span>{" "}
                {msg.conteudo ?? `[${msg.tipoConteudo}]`}
              </p>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
