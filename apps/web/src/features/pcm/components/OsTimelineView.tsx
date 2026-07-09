import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { OrdemServicoOperacional } from "../domain/ordens-servico";
import { agruparPorTecnico, formatarDiaIso } from "../domain/ordens-servico";

const HORAS_DO_DIA = 24;
const HORAS = Array.from({ length: HORAS_DO_DIA }, (_, hora) => hora);

function horaDoDado(dataIso: string, dia: Date): number | null {
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return null;
  if (formatarDiaIso(data) !== formatarDiaIso(dia)) return null;
  return data.getHours() + data.getMinutes() / 60;
}

/** E01-S38 — AC-6/AC-7: uma linha por técnico ("Sem técnico" por último), barra posicionada por
 * check-in/check-out; sem check-in, um ponto na data agendada; sem nenhum dos dois, a OS não
 * aparece aqui (segue normal nas outras visões). Dia único por vez — trilha de 24h em CSS puro,
 * sem biblioteca de gráfico. */
export function OsTimelineView({
  ordens,
  onSelecionar,
}: {
  ordens: OrdemServicoOperacional[];
  onSelecionar: (id: string) => void;
}) {
  const [dia, setDia] = useState(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return hoje;
  });

  const diaIso = formatarDiaIso(dia);

  const ordensDoDia = useMemo(
    () =>
      ordens.filter((ordem) => {
        const referencia = ordem.checkInAt ?? ordem.dataAgendada;
        if (!referencia) return false;
        const data = new Date(referencia);
        return !Number.isNaN(data.getTime()) && formatarDiaIso(data) === diaIso;
      }),
    [ordens, diaIso],
  );

  const grupos = useMemo(() => agruparPorTecnico(ordensDoDia), [ordensDoDia]);

  function mudarDia(deltaDias: number) {
    setDia((atual) => {
      const proximo = new Date(atual);
      proximo.setDate(proximo.getDate() + deltaDias);
      return proximo;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => mudarDia(-1)}
            className="rounded-[6px] border border-line p-1.5 hover:bg-line-soft"
            aria-label="Dia anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              setDia(() => {
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                return hoje;
              })
            }
            className="rounded-[6px] border border-line px-3 py-1.5 text-xs font-semibold hover:bg-line-soft"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => mudarDia(1)}
            className="rounded-[6px] border border-line p-1.5 hover:bg-line-soft"
            aria-label="Próximo dia"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm font-semibold text-ink">
          {dia.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-paper px-4 py-8 text-center text-sm text-ink-3">
          Nenhuma OS com data/check-in nesse dia.
        </div>
      ) : (
        <div className="rounded-[8px] border border-line bg-card">
          {/* Régua de horas */}
          <div className="flex border-b border-line-soft pl-40 text-[10px] text-ink-3">
            {HORAS.map((hora) => (
              <div
                key={`hora-${hora}`}
                className="flex-1 border-l border-line-soft py-1 text-center"
              >
                {hora}h
              </div>
            ))}
          </div>
          {grupos.map((grupo) => (
            <div
              key={grupo.tecnicoId ?? "sem-tecnico"}
              className="flex border-b border-line-soft last:border-b-0"
            >
              <div className="w-40 shrink-0 border-r border-line-soft px-3 py-3">
                <p className="text-sm font-semibold text-ink">{grupo.tecnicoNome}</p>
                <p className="text-[11px] text-ink-3">{grupo.ordens.length} OS</p>
              </div>
              <div className="relative flex-1 py-3" style={{ minHeight: "3rem" }}>
                {grupo.ordens.map((ordem) => {
                  const inicio = ordem.checkInAt ? horaDoDado(ordem.checkInAt, dia) : null;
                  const fim = ordem.checkOutAt ? horaDoDado(ordem.checkOutAt, dia) : null;
                  if (inicio == null) {
                    const pontoHora = ordem.dataAgendada
                      ? horaDoDado(ordem.dataAgendada, dia)
                      : null;
                    if (pontoHora == null) return null;
                    return (
                      <button
                        key={ordem.id}
                        type="button"
                        onClick={() => onSelecionar(ordem.id)}
                        title={`${ordem.numero} · ${ordem.titulo} · agendada ${pontoHora.toFixed(0)}h`}
                        className="absolute top-3 h-3 w-3 -translate-x-1/2 rounded-full bg-orange"
                        style={{ left: `${(pontoHora / HORAS_DO_DIA) * 100}%` }}
                      />
                    );
                  }
                  const larguraHoras = Math.max((fim ?? inicio + 0.5) - inicio, 0.5);
                  return (
                    <button
                      key={ordem.id}
                      type="button"
                      onClick={() => onSelecionar(ordem.id)}
                      title={`${ordem.numero} · ${ordem.titulo}`}
                      className="absolute top-2 flex h-8 items-center overflow-hidden rounded-[4px] bg-navy px-2 text-[11px] font-semibold text-white"
                      style={{
                        left: `${(inicio / HORAS_DO_DIA) * 100}%`,
                        width: `${(larguraHoras / HORAS_DO_DIA) * 100}%`,
                        minWidth: "3rem",
                      }}
                    >
                      {ordem.numero}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
