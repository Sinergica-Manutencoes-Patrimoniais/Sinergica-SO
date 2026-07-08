import { AlertTriangle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import { obterPainelAtendimento } from "../application/obter-painel-atendimento";
import type {
  HeatmapCelula,
  PainelAtendimento,
  PeriodoDashboard,
  WidgetsAtendimento,
} from "../domain/dashboard-atendimento";
import { montarPainelAtendimento, montarWidgetsAtendimento } from "../domain/dashboard-atendimento";
import { supabaseDashboardAtendimentoAdapter } from "../infrastructure/supabase-dashboard-atendimento-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; painel: PainelAtendimento; widgets: WidgetsAtendimento };

const PERIODOS: { valor: PeriodoDashboard; label: string }[] = [
  { valor: "hoje", label: "Hoje" },
  { valor: "7d", label: "7 dias" },
  { valor: "30d", label: "30 dias" },
];

export function AtendimentoDashboardPage() {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [periodo, setPeriodo] = useState<PeriodoDashboard>("7d");
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });

  const temLeitura = podeAcessar("atendimento", "leitura");

  const carregar = useCallback(async (p: PeriodoDashboard) => {
    setEstado({ fase: "carregando" });
    try {
      const snapshot = await obterPainelAtendimento(supabaseDashboardAtendimentoAdapter, p);
      setEstado({
        fase: "pronto",
        painel: montarPainelAtendimento(snapshot),
        widgets: montarWidgetsAtendimento(snapshot),
      });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar o dashboard.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) void carregar(periodo);
  }, [permissoesCarregando, temLeitura, periodo, carregar]);

  if (permissoesCarregando || estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando dashboard…</div>;
  }

  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">
          Você não tem permissão de leitura no módulo Atendimento.
        </p>
      </div>
    );
  }

  if (estado.fase === "erro") {
    return (
      <div className="rounded-[10px] border border-line bg-card p-8 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Dashboard indisponível</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button
          type="button"
          onClick={() => carregar(periodo)}
          className="mt-4 inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const { painel, widgets } = estado;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Atendimento</h2>
          <p className="text-sm text-ink-3">
            Visão operacional — fila, tempo de resposta, tendência, canais, IA e equipe.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-[6px] border border-line p-0.5">
            {PERIODOS.map((p) => (
              <button
                key={p.valor}
                type="button"
                onClick={() => setPeriodo(p.valor)}
                className={`rounded-[4px] px-3 py-1.5 text-sm font-semibold ${
                  periodo === p.valor ? "bg-navy text-white" : "text-ink-2 hover:bg-line-soft"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => carregar(periodo)}
            className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </div>

      <KpiStrip painel={painel} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QueueHealthCard aging={painel.aging} />
        <AiHealthCard painel={painel} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChannelMixCard mixCanal={painel.mixCanal} />
        <CsatCard csat={painel.csat} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <VolumeTrendCard volumeDiario={widgets.volumeDiario} />
        <SlaDeliveryCard
          slaDentroMetaPct={widgets.slaDentroMetaPct}
          frtMedioLabel={painel.frtMedioLabel}
        />
      </div>

      <HourlyHeatmapCard heatmap={widgets.heatmapHora} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankingCard
          titulo="Throughput"
          subtitulo="Mensagens enviadas por atendente no período"
          itens={widgets.throughput.map((t) => ({ label: t.nome, total: t.enviadas }))}
          vazio="Sem envios manuais no período."
        />
        <RankingCard
          titulo="Carga por atendente"
          subtitulo="Conversas abertas atribuídas agora"
          itens={widgets.cargaAtendente.map((c) => ({ label: c.nome, total: c.abertas }))}
          vazio="Nenhuma conversa atribuída agora."
        />
      </div>
    </div>
  );
}

function KpiStrip({ painel }: { painel: PainelAtendimento }) {
  const deltaLabel =
    painel.abertasHojeDeltaPct === null
      ? "sem base de ontem"
      : `${painel.abertasHojeDeltaPct > 0 ? "+" : ""}${painel.abertasHojeDeltaPct}% vs ontem`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi
        label="Fila sem atendente"
        valor={painel.filaSemAtendente}
        alerta={painel.filaSemAtendente >= 5}
        sub="aguardando distribuição"
      />
      <Kpi label="Conversas abertas" valor={painel.conversasAbertas} sub="trabalho vivo no time" />
      <Kpi label="Não lidas" valor={painel.naoLidas} sub="cliente aguardando" />
      <Kpi
        label="Mais antiga na fila"
        valor={painel.maisAntigaNaFilaLabel}
        alerta={painel.maisAntigaNaFilaLabel !== "—" && painel.maisAntigaNaFilaLabel.includes("h")}
        sub="sem resposta há mais tempo"
      />
      <Kpi
        label="1ª resposta (média)"
        valor={painel.frtMedioLabel}
        sub="meta 5 min"
        alerta={parseMinutos(painel.frtMedioLabel) > 5}
      />
      <Kpi label="Abertas hoje" valor={painel.abertasHoje} sub={deltaLabel} />
    </div>
  );
}

function parseMinutos(label: string): number {
  const horas = label.match(/(\d+)h/);
  const minutos = label.match(/(\d+)m/);
  return (horas ? Number(horas[1]) * 60 : 0) + (minutos ? Number(minutos[1]) : 0);
}

function Kpi({
  label,
  valor,
  sub,
  alerta,
}: { label: string; valor: string | number; sub: string; alerta?: boolean }) {
  return (
    <div
      className={`rounded-[6px] border p-4 ${alerta ? "border-[#F0C6B8] bg-[#FDF1EE]" : "border-line bg-card"}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        {alerta && <AlertTriangle className="h-3 w-3 text-[#C5362B]" />}
        {label}
      </div>
      <p
        className={`font-brand mt-1.5 text-2xl font-bold leading-none tabular-nums ${alerta ? "text-[#C5362B]" : "text-ink"}`}
      >
        {valor}
      </p>
      <p className="mt-1 text-[11px] text-ink-3">{sub}</p>
    </div>
  );
}

function QueueHealthCard({ aging }: { aging: PainelAtendimento["aging"] }) {
  const max = Math.max(...aging.map((a) => a.total), 1);
  const cores: Record<string, string> = {
    "0-1h": "bg-[#2E9E5B]",
    "1-4h": "bg-[#E0A62C]",
    "4-24h": "bg-[#E07A2C]",
    "+24h": "bg-[#C5362B]",
  };
  return (
    <section className="rounded-[10px] border border-line bg-card p-5">
      <h3 className="text-sm font-semibold text-ink">Saúde da fila — tempo de espera</h3>
      <p className="mt-0.5 text-xs text-ink-3">
        Conversas abertas não lidas, por quanto tempo aguardam resposta.
      </p>
      <div className="mt-4 space-y-2.5">
        {aging.map((a) => (
          <div key={a.faixa} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs font-medium text-ink-2">{a.faixa}</span>
            <div className="h-2.5 flex-1 rounded-full bg-line-soft">
              <div
                className={`h-2.5 rounded-full ${cores[a.faixa]}`}
                style={{ width: `${Math.max((a.total / max) * 100, a.total > 0 ? 4 : 0)}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-xs font-semibold text-ink">
              {a.total}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AiHealthCard({ painel }: { painel: PainelAtendimento }) {
  const total = painel.autonomiaZe + painel.autonomiaHumano;
  const iaPct = painel.autonomiaPct ?? 0;
  return (
    <section className="rounded-[10px] border border-line bg-card p-5">
      <h3 className="text-sm font-semibold text-ink">IA — autonomia e escalonamento</h3>
      <p className="mt-0.5 text-xs text-ink-3">
        Modo das conversas abertas e quanto passa para humano.
      </p>
      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-line-soft">
          <div className="h-full bg-navy" style={{ width: `${iaPct}%` }} />
          <div className="h-full bg-orange" style={{ width: `${100 - iaPct}%` }} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-navy" /> IA conduzindo {painel.autonomiaZe} (
          {iaPct}%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange" /> Humano {painel.autonomiaHumano} (
          {total > 0 ? 100 - iaPct : 0}%)
        </span>
      </div>
      <div className="mt-4 space-y-1.5 border-t border-line-soft pt-3 text-xs text-ink-2">
        <p>
          Escalou para humano{" "}
          <span className="font-semibold text-ink">{painel.escalonadoPct ?? "—"}%</span>{" "}
          <span className="text-ink-3">
            ({painel.escalonadoTotal} conversa{painel.escalonadoTotal === 1 ? "" : "s"})
          </span>
        </p>
        <p>
          Resolvido pela IA (deflexão){" "}
          <span className="font-semibold text-ink">{painel.deflexaoPct ?? "—"}%</span>
        </p>
      </div>
    </section>
  );
}

function ChannelMixCard({ mixCanal }: { mixCanal: PainelAtendimento["mixCanal"] }) {
  const max = Math.max(...mixCanal.map((m) => m.total), 1);
  return (
    <section className="rounded-[10px] border border-line bg-card p-5">
      <h3 className="text-sm font-semibold text-ink">Mix de canal</h3>
      <p className="mt-0.5 text-xs text-ink-3">De onde vem a demanda no período.</p>
      {mixCanal.length === 0 ? (
        <p className="mt-6 text-center text-sm text-ink-3">Sem conversas no período.</p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {mixCanal.map((m) => (
            <div key={m.label} className="flex items-center gap-3">
              <span className="w-20 shrink-0 truncate text-xs font-medium capitalize text-ink-2">
                {m.label}
              </span>
              <div className="h-2.5 flex-1 rounded-full bg-line-soft">
                <div
                  className="h-2.5 rounded-full bg-navy"
                  style={{ width: `${(m.total / max) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-xs font-semibold text-ink">
                {m.total}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CsatCard({ csat }: { csat: PainelAtendimento["csat"] }) {
  return (
    <section className="rounded-[10px] border border-line bg-card p-5">
      <h3 className="text-sm font-semibold text-ink">Satisfação (CSAT)</h3>
      <p className="mt-0.5 text-xs text-ink-3">
        Notas de pesquisas ligadas ao atendimento no período.
      </p>
      <div className="mt-6 text-center text-sm text-ink-3">
        {csat.respostas === 0
          ? "Sem respostas ainda — liga quando pesquisas pós-atendimento existirem."
          : `${csat.media?.toFixed(1) ?? "—"} de média · ${csat.respostas} respostas`}
      </div>
    </section>
  );
}

function VolumeTrendCard({ volumeDiario }: { volumeDiario: WidgetsAtendimento["volumeDiario"] }) {
  const max = Math.max(...volumeDiario.flatMap((v) => [v.entrada, v.saida]), 1);
  return (
    <section className="rounded-[10px] border border-line bg-card p-5">
      <h3 className="text-sm font-semibold text-ink">Volume por dia</h3>
      <p className="mt-0.5 text-xs text-ink-3">Mensagens recebidas vs enviadas no período.</p>
      {volumeDiario.length === 0 ? (
        <p className="mt-6 text-center text-sm text-ink-3">Sem mensagens no período.</p>
      ) : (
        <div className="mt-4 flex h-32 items-end gap-2">
          {volumeDiario.map((v) => (
            <div
              key={v.dia}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${formatarDiaCurto(v.dia)} — ${v.entrada} recebidas, ${v.saida} enviadas`}
            >
              <div className="flex h-24 w-full items-end gap-0.5">
                <div
                  className="flex-1 rounded-t-[2px] bg-orange"
                  style={{ height: `${(v.entrada / max) * 100}%` }}
                />
                <div
                  className="flex-1 rounded-t-[2px] bg-navy"
                  style={{ height: `${(v.saida / max) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-ink-3">{formatarDiaCurto(v.dia)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-4 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange" /> Recebidas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-navy" /> Enviadas
        </span>
      </div>
    </section>
  );
}

function formatarDiaCurto(diaIso: string): string {
  const data = new Date(diaIso);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(data);
}

function SlaDeliveryCard({
  slaDentroMetaPct,
  frtMedioLabel,
}: { slaDentroMetaPct: number | null; frtMedioLabel: string }) {
  const pct = slaDentroMetaPct ?? 0;
  const cor = pct >= 90 ? "text-[#1E8E45]" : pct >= 70 ? "text-[#B26A00]" : "text-[#C5362B]";
  const corBarra = pct >= 90 ? "bg-[#1E8E45]" : pct >= 70 ? "bg-[#B26A00]" : "bg-[#C5362B]";
  return (
    <section className="rounded-[10px] border border-line bg-card p-5">
      <h3 className="text-sm font-semibold text-ink">SLA & entrega</h3>
      <p className="mt-0.5 text-xs text-ink-3">1ª resposta dentro da meta de 5 minutos.</p>
      <p className={`font-brand mt-3 text-3xl font-bold ${cor}`}>
        {slaDentroMetaPct === null ? "—" : `${slaDentroMetaPct}%`}
      </p>
      <div className="mt-2 h-2 rounded-full bg-line-soft">
        <div className={`h-2 rounded-full ${corBarra}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-xs text-ink-3">
        Tempo médio de 1ª resposta:{" "}
        <span className="font-semibold text-ink-2">{frtMedioLabel}</span>
      </p>
    </section>
  );
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HORAS_DIA = Array.from({ length: 24 }, (_, hora) => hora);

function HourlyHeatmapCard({ heatmap }: { heatmap: HeatmapCelula[] }) {
  const max = Math.max(...heatmap.map((h) => h.total), 1);
  const porCelula = new Map(heatmap.map((h) => [`${h.diaSemana}-${h.hora}`, h.total]));
  return (
    <section className="rounded-[10px] border border-line bg-card p-5">
      <h3 className="text-sm font-semibold text-ink">Pico por hora</h3>
      <p className="mt-0.5 text-xs text-ink-3">Mensagens recebidas por dia da semana e hora.</p>
      <div className="mt-4 overflow-x-auto">
        <div
          className="inline-grid gap-[3px]"
          style={{ gridTemplateColumns: "32px repeat(24, 1fr)" }}
        >
          <div />
          {HORAS_DIA.map((hora) => (
            <div key={hora} className="text-center text-[9px] text-ink-3">
              {hora % 6 === 0 ? hora : ""}
            </div>
          ))}
          {DIAS_SEMANA.map((dia, dow) => (
            <div key={dia} className="contents">
              <div className="pr-1 text-right text-[10px] text-ink-3">{dia}</div>
              {HORAS_DIA.map((hora) => {
                const total = porCelula.get(`${dow}-${hora}`) ?? 0;
                const alpha = total === 0 ? 0.08 : 0.2 + 0.8 * (total / max);
                return (
                  <div
                    key={hora}
                    title={`${dia} ${hora}h — ${total}`}
                    className="h-3.5 w-3.5 rounded-[2px]"
                    style={{ backgroundColor: `rgba(30, 58, 138, ${alpha})` }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RankingCard({
  titulo,
  subtitulo,
  itens,
  vazio,
}: {
  titulo: string;
  subtitulo: string;
  itens: { label: string; total: number }[];
  vazio: string;
}) {
  const max = Math.max(...itens.map((i) => i.total), 1);
  return (
    <section className="rounded-[10px] border border-line bg-card p-5">
      <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
      <p className="mt-0.5 text-xs text-ink-3">{subtitulo}</p>
      {itens.length === 0 ? (
        <p className="mt-6 text-center text-sm text-ink-3">{vazio}</p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {itens.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs font-medium text-ink-2">
                {item.label}
              </span>
              <div className="h-2.5 flex-1 rounded-full bg-line-soft">
                <div
                  className="h-2.5 rounded-full bg-navy"
                  style={{ width: `${(item.total / max) * 100}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-semibold text-ink">
                {item.total}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
