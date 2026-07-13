import { Card, Kpi, PageHeader } from "./MockUi";
import {
  CONTAS,
  FLUXO_MESES,
  GASTO_CATEGORIAS,
  LANCAMENTOS,
  PAGAR,
  RECEBIVEIS,
  brl,
} from "./mock-data";

export function DashboardMock() {
  const posicao = CONTAS.reduce((s, c) => s + c.saldo, 0);
  const entradasMes = LANCAMENTOS.filter(
    (l) => l.tipo === "entrada" && l.status === "realizado",
  ).reduce((s, l) => s + l.valor, 0);
  const saidasMes = LANCAMENTOS.filter(
    (l) => l.tipo === "saida" && l.status === "realizado",
  ).reduce((s, l) => s + l.valor, 0);
  const receber30 = RECEBIVEIS.reduce((s, r) => s + r.valor, 0);
  const pagar30 = PAGAR.reduce((s, p) => s + p.valor, 0);
  const resultado = entradasMes - saidasMes;

  return (
    <div className="page-stack">
      <PageHeader
        title="Dashboard Financeiro"
        subtitle="Posição de caixa, fluxo do mês e projeção — visão de dono."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi eyebrow="Posição de caixa" value={brl(posicao)} sub="3 contas ativas" />
        <Kpi eyebrow="Entradas do mês" value={brl(entradasMes)} tone="good" />
        <Kpi eyebrow="Saídas do mês" value={brl(saidasMes)} />
        <Kpi
          eyebrow="Resultado do mês"
          value={brl(resultado)}
          tone={resultado >= 0 ? "good" : "critical"}
        />
        <Kpi
          eyebrow="A receber (30d)"
          value={brl(receber30)}
          sub={`${RECEBIVEIS.length} recebíveis`}
        />
        <Kpi eyebrow="A pagar (30d)" value={brl(pagar30)} sub={`${PAGAR.length} contas`} />
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Fluxo de caixa — últimos 6 meses">
          <FluxoChart />
        </Card>
        <Card title="Gasto por categoria — mês corrente">
          <CategoriaBars />
        </Card>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Previsto × realizado — mês corrente">
          <PrevistoRealizado />
        </Card>
        <Card title="Projeção de caixa">
          <ProjecaoStrip posicao={posicao} />
          <p className="mt-2 text-[11px] text-ink-3">
            Posição atual + previstos de entrada − previstos de saída na janela.
          </p>
        </Card>
      </div>
    </div>
  );
}

function FluxoChart() {
  const max = Math.max(...FLUXO_MESES.map((d) => Math.max(d.entrada, d.saida)));
  return (
    <div>
      <div className="flex h-36 items-end gap-3 pt-2">
        {FLUXO_MESES.map((d) => (
          <div key={d.m} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div className="flex w-full flex-1 items-end justify-center gap-1">
              <div
                className="w-3 rounded-t-[3px] bg-[#1E8E45]"
                style={{ height: `${Math.round((d.entrada / max) * 100)}%` }}
                title={`Entradas ${brl(d.entrada)}`}
              />
              <div
                className="w-3 rounded-t-[3px] bg-navy"
                style={{ height: `${Math.round((d.saida / max) * 100)}%` }}
                title={`Saídas ${brl(d.saida)}`}
              />
            </div>
            <span className="text-[10px] font-semibold text-ink-3">{d.m}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-[11px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px] bg-[#1E8E45]" /> Entradas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px] bg-navy" /> Saídas
        </span>
      </div>
    </div>
  );
}

function CategoriaBars() {
  const max = Math.max(...GASTO_CATEGORIAS.map((c) => c.valor));
  const total = GASTO_CATEGORIAS.reduce((s, c) => s + c.valor, 0);
  return (
    <div className="flex flex-col gap-2.5">
      {GASTO_CATEGORIAS.map((c) => (
        <div key={c.nome} className="grid grid-cols-[100px_1fr_44px] items-center gap-2.5 text-xs">
          <span className="truncate font-medium text-ink-2">{c.nome}</span>
          <div className="h-2 overflow-hidden rounded-full bg-line-soft">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.round((c.valor / max) * 100)}%`, background: c.cor }}
            />
          </div>
          <span className="text-right tabular-nums text-ink-3">
            {Math.round((c.valor / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function PrevistoRealizado() {
  const itens = [
    { label: "Entradas", meta: 6300, real: 4200, cor: "#1E8E45" },
    { label: "Saídas", meta: 25450, real: 18400 + 3200 + 680 + 2120, cor: "var(--color-navy)" },
  ];
  const max = Math.max(...itens.map((i) => Math.max(i.meta, i.real)));
  return (
    <div className="flex flex-col gap-4">
      {itens.map((i) => (
        <div key={i.label} className="grid grid-cols-[70px_1fr_150px] items-center gap-3">
          <span className="text-xs font-semibold text-ink-2">{i.label}</span>
          <div className="relative h-3.5 overflow-hidden rounded-full bg-line-soft">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${Math.round((i.real / max) * 100)}%`, background: i.cor }}
            />
            <div
              className="absolute inset-y-[-3px] w-0.5 bg-ink/50"
              style={{ left: `${Math.round((i.meta / max) * 100)}%` }}
            />
          </div>
          <span className="text-right text-[11px] tabular-nums text-ink-3">
            {brl(i.real)} / {brl(i.meta)}
          </span>
        </div>
      ))}
      <p className="text-[11px] text-ink-3">Traço = valor previsto do mês · barra = já realizado</p>
    </div>
  );
}

function ProjecaoStrip({ posicao }: { posicao: number }) {
  const pontos = [
    { d: "+30d", v: posicao + 6300 - 25450 },
    { d: "+60d", v: posicao + 12100 - 49800 },
    { d: "+90d", v: posicao + 18400 - 74200 },
  ];
  return (
    <div className="flex gap-2.5">
      {pontos.map((p) => (
        <div key={p.d} className="flex-1 rounded-[8px] bg-line-soft px-3 py-2.5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">{p.d}</p>
          <p
            className={`mt-1 text-sm font-bold tabular-nums ${p.v < 0 ? "text-[#C5362B]" : "text-ink"}`}
          >
            {brl(p.v)}
          </p>
        </div>
      ))}
    </div>
  );
}
