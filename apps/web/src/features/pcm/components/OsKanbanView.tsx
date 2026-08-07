import { Tooltip } from "@sinergica/ui";
import { ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { type DragEvent, useState } from "react";
import type { PmocPreventivaResumo } from "../application/pmoc-gateway";
import {
  type ColunaKanbanId,
  type ColunaKanbanPreferencia,
  labelColunaKanban,
} from "../domain/kanban-colunas";
import type { OrdemServicoOperacional, StatusOrdemServico } from "../domain/ordens-servico";
import {
  PRIORIDADE_LABEL,
  deveAlterarStatusPorDrop,
  prioridadeColor,
  resumoTooltipOrdem,
  rotuloNumeroOrdem,
} from "../domain/ordens-servico";
import { TIPO_MANUTENCAO_LABEL } from "../domain/pmoc";

const DRAG_MIME = "application/x-sinergica-os-id";

function formatarDataPreventiva(dataIso: string): string {
  return new Date(`${dataIso}T00:00:00`).toLocaleDateString("pt-BR");
}

/** E01-S117 AC-6: "Orientação" da tarefa Auvo pra exibir no card (o que a droplist de status
 * deixou de ocupar). Truncada — só o que couber. `detalhes` é jsonb livre, então lê defensivo. */
function orientacaoDoCard(detalhes: Record<string, unknown> | null): string | null {
  const bruto = detalhes?.orientacao;
  if (typeof bruto !== "string") return null;
  const texto = bruto.trim();
  return texto.length > 0 ? texto : null;
}

/** E01-S38 — uma coluna por status; E01-S61 adiciona arrastar-e-soltar (HTML5 DnD nativo, sem
 * biblioteca nova) reaproveitando o mesmo `onAlterarStatus` do seletor — o `<select>` continua
 * disponível como alternativa acessível (teclado, leitor de tela, mobile sem drag por toque).
 * E01-S84 adiciona colunas customizáveis (ordem/visibilidade, `colunas`) e a coluna virtual
 * "Preventiva" (`preventivas`, sem drag — não são OS de verdade até "Criar OS"). */
export function OsKanbanView({
  ordens,
  temEscrita,
  salvando,
  onAlterarStatus,
  onSelecionar,
  selecionados,
  onToggleSelecionado,
  colunas,
  onMoverColuna,
  onAlternarVisibilidadeColuna,
  preventivas,
}: {
  ordens: OrdemServicoOperacional[];
  temEscrita: boolean;
  salvando: boolean;
  onAlterarStatus: (id: string, status: StatusOrdemServico) => void;
  onSelecionar: (id: string) => void;
  selecionados?: Set<string>;
  onToggleSelecionado?: (id: string) => void;
  colunas: ColunaKanbanPreferencia[];
  onMoverColuna: (id: ColunaKanbanId, direcao: "cima" | "baixo") => void;
  onAlternarVisibilidadeColuna: (id: ColunaKanbanId) => void;
  preventivas: PmocPreventivaResumo[];
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

  const colunasOcultas = colunas.filter((coluna) => !coluna.visivel);

  return (
    <div className="flex flex-col gap-2">
      {colunasOcultas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
          <span className="font-semibold">Colunas ocultas:</span>
          {colunasOcultas.map((coluna) => (
            <button
              key={coluna.id}
              type="button"
              onClick={() => onAlternarVisibilidadeColuna(coluna.id)}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-0.5 font-semibold text-ink-2 hover:bg-line-soft"
            >
              <Eye className="h-3 w-3" />
              {labelColunaKanban(coluna.id)}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {colunas
          .filter((coluna) => coluna.visivel)
          .map((coluna, indice, visiveis) => {
            if (coluna.id === "preventiva") {
              return (
                <div
                  key="preventiva"
                  className="flex w-72 shrink-0 flex-col rounded-lg border border-line bg-paper"
                >
                  <ColunaHeader
                    label="Preventiva"
                    total={preventivas.length}
                    podeSubir={indice > 0}
                    podeDescer={indice < visiveis.length - 1}
                    onSubir={() => onMoverColuna("preventiva", "cima")}
                    onDescer={() => onMoverColuna("preventiva", "baixo")}
                    onOcultar={() => onAlternarVisibilidadeColuna("preventiva")}
                  />
                  <div className="flex max-h-[600px] flex-col gap-2 overflow-y-auto p-2">
                    {preventivas.length === 0 ? (
                      <p className="px-2 py-4 text-center text-xs text-ink-3">
                        Nenhuma preventiva planejada
                      </p>
                    ) : (
                      preventivas.map((preventiva) => (
                        <div
                          key={preventiva.id}
                          className="rounded-md border border-line bg-card p-3"
                        >
                          <span className="rounded-full bg-info-soft px-2 py-0.5 text-micro font-semibold text-info">
                            {TIPO_MANUTENCAO_LABEL[preventiva.maintenanceType]}
                          </span>
                          <p className="mt-1.5 text-sm font-semibold text-ink">
                            {preventiva.imovelNome}
                          </p>
                          <p className="mt-1 text-xs text-ink-3">{preventiva.clienteNome}</p>
                          <p className="mt-1 text-micro text-ink-3">
                            {formatarDataPreventiva(preventiva.scheduledDate)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            }

            const ordensDaColuna = ordens.filter((ordem) => ordem.status === coluna.id);
            return (
              <div
                key={coluna.id}
                onDragOver={(event) => {
                  if (!temEscrita) return;
                  event.preventDefault();
                  if (colunaAlvo !== coluna.id) setColunaAlvo(coluna.id as StatusOrdemServico);
                }}
                onDragLeave={() => setColunaAlvo((atual) => (atual === coluna.id ? null : atual))}
                onDrop={(event) =>
                  temEscrita && onDropNaColuna(coluna.id as StatusOrdemServico, event)
                }
                className={`flex w-72 shrink-0 flex-col rounded-lg border bg-paper transition-colors ${
                  colunaAlvo === coluna.id ? "border-orange bg-orange-soft/40" : "border-line"
                }`}
              >
                <ColunaHeader
                  label={labelColunaKanban(coluna.id)}
                  total={ordensDaColuna.length}
                  podeSubir={indice > 0}
                  podeDescer={indice < visiveis.length - 1}
                  onSubir={() => onMoverColuna(coluna.id, "cima")}
                  onDescer={() => onMoverColuna(coluna.id, "baixo")}
                  onOcultar={() => onAlternarVisibilidadeColuna(coluna.id)}
                />
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
                        className={`rounded-md border border-line bg-card p-3 hover:border-ink-3 ${
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
                                {rotuloNumeroOrdem(ordem)}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-micro font-semibold ${prioridadeColor(ordem.prioridade)}`}
                              >
                                {PRIORIDADE_LABEL[ordem.prioridade] ?? ordem.prioridade}
                              </span>
                            </div>
                            <p className="mt-1.5 text-sm font-semibold text-ink">{ordem.titulo}</p>
                            <p className="mt-1 text-xs text-ink-3">{ordem.clienteNome}</p>
                            {ordem.tecnicoNome && (
                              <p className="mt-1 text-micro text-ink-3">
                                Técnico: {ordem.tecnicoNome}
                              </p>
                            )}
                            {/* E01-S117 AC-6: Orientação do Auvo no lugar da droplist de status. */}
                            {orientacaoDoCard(ordem.detalhes) && (
                              <p className="mt-1.5 line-clamp-2 text-micro leading-snug text-ink-2">
                                <span className="font-semibold text-ink-3">Orientação: </span>
                                {orientacaoDoCard(ordem.detalhes)}
                              </p>
                            )}
                            {/* E01-S117 AC-3: rastro do item no Auvo. */}
                            {ordem.auvoTaskId !== null && (
                              <p className="mt-1 text-micro font-brand tabular-nums text-ink-3">
                                Auvo #{ordem.auvoTaskId}
                              </p>
                            )}
                          </button>
                        </Tooltip>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function ColunaHeader({
  label,
  total,
  podeSubir,
  podeDescer,
  onSubir,
  onDescer,
  onOcultar,
}: {
  label: string;
  total: number;
  podeSubir: boolean;
  podeDescer: boolean;
  onSubir: () => void;
  onDescer: () => void;
  onOcultar: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-1 border-b border-line-soft px-2 py-1.5">
      <div className="flex items-center gap-1 min-w-0">
        <button
          type="button"
          onClick={onSubir}
          disabled={!podeSubir}
          aria-label={`Mover coluna ${label} para a esquerda`}
          className="rounded-sm p-0.5 text-ink-3 hover:bg-line-soft hover:text-ink disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDescer}
          disabled={!podeDescer}
          aria-label={`Mover coluna ${label} para a direita`}
          className="rounded-sm p-0.5 text-ink-3 hover:bg-line-soft hover:text-ink disabled:opacity-30"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <p className="truncate text-xs font-semibold uppercase tracking-wider text-ink-3">
          {label}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="rounded-full bg-line-soft px-2 py-0.5 text-micro font-semibold text-ink-2">
          {total}
        </span>
        <button
          type="button"
          onClick={onOcultar}
          aria-label={`Ocultar coluna ${label}`}
          className="rounded-sm p-0.5 text-ink-3 hover:bg-line-soft hover:text-ink"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
