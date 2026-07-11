import { type DragEvent, useState } from "react";
import { Tooltip } from "../../../components/ui/Tooltip";
import type { OrdemServicoOperacional, StatusOrdemServico } from "../domain/ordens-servico";
import {
  PRIORIDADE_LABEL,
  STATUS_OS,
  deveAlterarStatusPorDrop,
  prioridadeColor,
  resumoTooltipOrdem,
} from "../domain/ordens-servico";

const DRAG_MIME = "application/x-sinergica-os-id";

/** E01-S38 — uma coluna por status; E01-S61 adiciona arrastar-e-soltar (HTML5 DnD nativo, sem
 * biblioteca nova) reaproveitando o mesmo `onAlterarStatus` do seletor — o `<select>` continua
 * disponível como alternativa acessível (teclado, leitor de tela, mobile sem drag por toque). */
export function OsKanbanView({
  ordens,
  temEscrita,
  salvando,
  onAlterarStatus,
  onSelecionar,
  selecionados,
  onToggleSelecionado,
}: {
  ordens: OrdemServicoOperacional[];
  temEscrita: boolean;
  salvando: boolean;
  onAlterarStatus: (id: string, status: StatusOrdemServico) => void;
  onSelecionar: (id: string) => void;
  selecionados?: Set<string>;
  onToggleSelecionado?: (id: string) => void;
}) {
  const [colunaAlvo, setColunaAlvo] = useState<StatusOrdemServico | null>(null);

  function onDropNaColuna(destino: StatusOrdemServico, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setColunaAlvo(null);
    const id = event.dataTransfer.getData(DRAG_MIME);
    const ordem = ordens.find((item) => item.id === id);
    if (!ordem || !deveAlterarStatusPorDrop(ordem.status, destino)) return;
    onAlterarStatus(id, destino);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STATUS_OS.map((coluna) => {
        const ordensDaColuna = ordens.filter((ordem) => ordem.status === coluna.value);
        return (
          <div
            key={coluna.value}
            onDragOver={(event) => {
              if (!temEscrita) return;
              event.preventDefault();
              if (colunaAlvo !== coluna.value) setColunaAlvo(coluna.value);
            }}
            onDragLeave={() => setColunaAlvo((atual) => (atual === coluna.value ? null : atual))}
            onDrop={(event) => temEscrita && onDropNaColuna(coluna.value, event)}
            className={`flex w-72 shrink-0 flex-col rounded-[8px] border bg-paper transition-colors ${
              colunaAlvo === coluna.value ? "border-orange bg-orange-soft/40" : "border-line"
            }`}
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
                    draggable={temEscrita && !salvando}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(DRAG_MIME, ordem.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    className={`rounded-[6px] border border-line bg-card p-3 hover:border-ink-3 ${
                      temEscrita && !salvando ? "cursor-grab active:cursor-grabbing" : ""
                    }`}
                  >
                    {temEscrita && onToggleSelecionado && (
                      <input
                        type="checkbox"
                        checked={selecionados?.has(ordem.id) ?? false}
                        onChange={() => onToggleSelecionado(ordem.id)}
                        aria-label={`Selecionar ${ordem.numero}`}
                        className="mb-1.5 h-4 w-4 accent-orange"
                      />
                    )}
                    <Tooltip content={resumoTooltipOrdem(ordem)}>
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
                          <p className="mt-1 text-[11px] text-ink-3">
                            Técnico: {ordem.tecnicoNome}
                          </p>
                        )}
                      </button>
                    </Tooltip>
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
