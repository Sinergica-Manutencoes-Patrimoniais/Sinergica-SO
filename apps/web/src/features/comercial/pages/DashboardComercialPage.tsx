/** Dashboard comercial (E03-S08). Responde "o funil está funcionando?" — tudo agregado server-side
 * (RPCs, migration 0196), nunca calculado no browser a partir da tabela inteira (AC-1). */

import { Card, EmptyState } from "@sinergica/ui";
import { useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import type { PeriodoDashboard } from "../application/dashboard-gateway";
import {
  useCicloVenda,
  useConversaoEtapas,
  useDescontoMedio,
  useOrigemLeads,
  useTicketMedio,
  useWinLoss,
} from "../application/dashboard-queries";
import { ConversaoEtapasChart } from "../components/graficos/ConversaoEtapasChart";
import { MotivosPerdaChart } from "../components/graficos/MotivosPerdaChart";
import {
  amostraPequena,
  proporcaoPertoDoPiso,
  rotuloFonteTicket,
} from "../domain/metricas-comercial";
import { supabaseDashboardAdapter } from "../infrastructure/supabase-dashboard-adapter";

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function diasAtrasIso(dias: number): string {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatarValor(centavos: number | null): string {
  if (centavos === null) return "—";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarPct(fracao: number | null): string {
  if (fracao === null) return "—";
  return `${(fracao * 100).toFixed(1)}%`;
}

/** AC-8: bloco que degrada honesto — `null` vira aviso explícito, nunca um número fingido. */
function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink">{titulo}</h3>
        {children}
      </div>
    </Card>
  );
}

function SemDados() {
  return <p className="text-sm text-ink-3">Sem dados ainda no período.</p>;
}

export function DashboardComercialPage() {
  const { podeAcessar } = usePermissoes();
  const temLeitura = podeAcessar("comercial", "leitura");

  const [periodo, setPeriodo] = useState<PeriodoDashboard>({
    inicio: diasAtrasIso(90),
    fim: hojeIso(),
  });

  const conversaoQuery = useConversaoEtapas(supabaseDashboardAdapter, periodo, temLeitura);
  const cicloQuery = useCicloVenda(supabaseDashboardAdapter, periodo, temLeitura);
  const winLossQuery = useWinLoss(supabaseDashboardAdapter, periodo, temLeitura);
  const ticketQuery = useTicketMedio(supabaseDashboardAdapter, periodo, temLeitura);
  const descontoQuery = useDescontoMedio(supabaseDashboardAdapter, periodo, temLeitura);
  const origemQuery = useOrigemLeads(supabaseDashboardAdapter, periodo, temLeitura);

  if (!temLeitura) {
    return (
      <EmptyState titulo="Sem acesso ao Comercial">
        Seu usuário não tem permissão no módulo Comercial.
      </EmptyState>
    );
  }

  const ganhas = (winLossQuery.data ?? []).find((l) => l.categoria === "ganha")?.quantidade ?? 0;
  const perdidasLinhas = (winLossQuery.data ?? []).filter((l) => l.categoria === "perdida");
  const totalPerdidas = perdidasLinhas.reduce((soma, l) => soma + l.quantidade, 0);
  const totalFechadas = ganhas + totalPerdidas;
  const taxaGanho = totalFechadas > 0 ? ganhas / totalFechadas : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Dashboard comercial</h2>
          <p className="text-sm text-ink-3">
            O funil está funcionando? Conversão, ciclo, win/loss.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs text-ink-2">
            Início
            <input
              type="date"
              className="input mt-1 block"
              value={periodo.inicio}
              onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))}
            />
          </label>
          <label className="text-xs text-ink-2">
            Fim
            <input
              type="date"
              className="input mt-1 block"
              value={periodo.fim}
              onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))}
            />
          </label>
        </div>
      </div>

      {/* AC-2: conversão por etapa */}
      <Bloco titulo="Conversão por etapa">
        {conversaoQuery.isPending ? (
          <p className="text-sm text-ink-2">Carregando…</p>
        ) : (
          <ConversaoEtapasChart etapas={conversaoQuery.data ?? []} />
        )}
      </Bloco>

      <div className="grid gap-4 md:grid-cols-2">
        {/* AC-3: ciclo de venda */}
        <Bloco titulo="Ciclo de venda (mediana)">
          {cicloQuery.isPending ? (
            <p className="text-sm text-ink-2">Carregando…</p>
          ) : cicloQuery.data && cicloQuery.data.medianaDias !== null ? (
            <>
              <p className="text-2xl font-semibold tabular-nums text-ink">
                {Math.round(cicloQuery.data.medianaDias)} dias
              </p>
              <p className="text-xs text-ink-3">
                {cicloQuery.data.quantidade} oportunidade(s) fechada(s)
              </p>
              {amostraPequena(cicloQuery.data.quantidade) && (
                <p className="mt-1 text-xs text-orange">
                  Amostra pequena — poucos dados no período.
                </p>
              )}
            </>
          ) : (
            <SemDados />
          )}
        </Bloco>

        {/* AC-4: win/loss */}
        <Bloco titulo="Win / loss">
          {winLossQuery.isPending ? (
            <p className="text-sm text-ink-2">Carregando…</p>
          ) : totalFechadas === 0 ? (
            <SemDados />
          ) : (
            <>
              <p className="text-2xl font-semibold tabular-nums text-ink">
                {formatarPct(taxaGanho)}
              </p>
              <p className="text-xs text-ink-3">
                {ganhas} ganha(s) · {totalPerdidas} perdida(s) de {totalFechadas} fechada(s)
              </p>
              {amostraPequena(totalFechadas) && (
                <p className="mt-1 text-xs text-orange">
                  Amostra pequena — poucos dados no período.
                </p>
              )}
            </>
          )}
        </Bloco>
      </div>

      {/* Distribuição de motivos de perda — só faz sentido com perdas no período. */}
      {totalPerdidas > 0 && (
        <Bloco titulo="Distribuição de motivos de perda">
          <MotivosPerdaChart linhas={winLossQuery.data ?? []} />
        </Bloco>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* AC-5/AC-8: ticket médio */}
        <Bloco titulo="Ticket médio">
          {ticketQuery.isPending ? (
            <p className="text-sm text-ink-2">Carregando…</p>
          ) : ticketQuery.data && ticketQuery.data.ticketMedioCentavos !== null ? (
            <>
              <p className="text-2xl font-semibold tabular-nums text-ink">
                {formatarValor(ticketQuery.data.ticketMedioCentavos)}
              </p>
              <p className="text-xs text-ink-3">
                {ticketQuery.data.quantidade} oportunidade(s) ganha(s) — fontes:{" "}
                {ticketQuery.data.fonteContrato > 0 &&
                  `${ticketQuery.data.fonteContrato} ${rotuloFonteTicket("contrato")}`}
                {ticketQuery.data.fonteContrato > 0 && ticketQuery.data.fonteProposta > 0 && ", "}
                {ticketQuery.data.fonteProposta > 0 &&
                  `${ticketQuery.data.fonteProposta} ${rotuloFonteTicket("proposta")}`}
                {(ticketQuery.data.fonteContrato > 0 || ticketQuery.data.fonteProposta > 0) &&
                  ticketQuery.data.fonteEstimado > 0 &&
                  ", "}
                {ticketQuery.data.fonteEstimado > 0 &&
                  `${ticketQuery.data.fonteEstimado} ${rotuloFonteTicket("estimado")}`}
              </p>
              {amostraPequena(ticketQuery.data.quantidade) && (
                <p className="mt-1 text-xs text-orange">
                  Amostra pequena — poucos dados no período.
                </p>
              )}
            </>
          ) : (
            // AC-8: sem oportunidade ganha com valor conhecido no período — nunca "R$ 0,00".
            <SemDados />
          )}
        </Bloco>

        {/* AC-6/AC-8: desconto médio × piso */}
        <Bloco titulo="Desconto médio × piso">
          {descontoQuery.isPending ? (
            <p className="text-sm text-ink-2">Carregando…</p>
          ) : descontoQuery.data && descontoQuery.data.descontoMedioPct !== null ? (
            <>
              <p className="text-2xl font-semibold tabular-nums text-ink">
                {formatarPct(descontoQuery.data.descontoMedioPct)}
              </p>
              <p className="text-xs text-ink-3">
                {descontoQuery.data.quantidade} proposta(s) enviada(s) ·{" "}
                {formatarPct(
                  proporcaoPertoDoPiso(
                    descontoQuery.data.quantidade,
                    descontoQuery.data.pertoDoPiso,
                  ),
                )}{" "}
                a menos de 5% do piso
              </p>
              {amostraPequena(descontoQuery.data.quantidade) && (
                <p className="mt-1 text-xs text-orange">
                  Amostra pequena — poucos dados no período.
                </p>
              )}
            </>
          ) : (
            // AC-8: sem proposta enviada no período (ou S04 nunca usada) — nunca "0%" fingindo dado real.
            <SemDados />
          )}
        </Bloco>
      </div>

      {/* AC-7: origem do lead */}
      <Bloco titulo="Origem do lead">
        {origemQuery.isPending ? (
          <p className="text-sm text-ink-2">Carregando…</p>
        ) : (origemQuery.data ?? []).length === 0 ? (
          <SemDados />
        ) : (
          <ul className="space-y-1">
            {[...(origemQuery.data ?? [])]
              .sort((a, b) => b.total - a.total)
              .map((linha) => (
                <li
                  key={linha.origem}
                  className="flex items-center justify-between border-b border-line-soft py-1.5 text-sm last:border-0"
                >
                  <span className="text-ink">{linha.origem}</span>
                  <span className="text-ink-2">
                    {linha.total} total ·{" "}
                    {formatarPct(linha.total > 0 ? linha.ganhas / linha.total : null)} conversão
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Bloco>
    </div>
  );
}
