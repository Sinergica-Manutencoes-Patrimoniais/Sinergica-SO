import { AlertTriangle, Gauge, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { listarAgingRecebiveis } from "../application/contratos";
import { obterFluxoMensal, obterResumoCaixa } from "../application/dashboard";
import type { ClienteOpcao } from "../application/financeiro-gateway";
import { listarClientesOpcoes } from "../application/lancamentos";
import { obterRentabilidadeClienteMes } from "../application/rentabilidade";
import { agruparInadimplenciaPorCliente, percentualCarteiraEmAtraso } from "../domain/aging";
import type { RecebivelAging } from "../domain/aging";
import {
  amostraPequena,
  calcularBreakEvenCentavos,
  calcularBurnMedioCentavos,
  calcularDespesasMediasCentavos,
  calcularMargemContribuicao,
  calcularRunwayMeses,
  calcularTicketMedioCentavos,
} from "../domain/cockpit";
import type { PontoFluxoMensal, ResumoCaixa } from "../domain/dashboard";
import { centavosParaReais } from "../domain/dinheiro";
import { ranquearPorMargem, temAlertaMargemNegativa } from "../domain/rentabilidade";
import type { RentabilidadeMes } from "../domain/rentabilidade";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

const MESES_JANELA = 6;
const RUNWAY_CRITICO_MESES = 3;
const RUNWAY_ATENCAO_MESES = 6;

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | {
      fase: "pronto";
      resumo: ResumoCaixa;
      fluxo: PontoFluxoMensal[];
      rentabilidade: RentabilidadeMes[];
      recebiveis: RecebivelAging[];
      clientes: ClienteOpcao[];
    };

function mesAtualIso(): string {
  return `${new Date().toISOString().slice(0, 7)}-01`;
}

export function CockpitFinanceiroPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });

  const temLeitura = podeAcessar("financeiro", "leitura");
  const ehSuperadmin = user?.papel === "superadmin";

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [resumo, fluxo, rentabilidade, recebiveis, clientes] = await Promise.all([
        obterResumoCaixa(supabaseFinanceiroAdapter),
        obterFluxoMensal(supabaseFinanceiroAdapter, MESES_JANELA),
        obterRentabilidadeClienteMes(supabaseFinanceiroAdapter, MESES_JANELA),
        listarAgingRecebiveis(supabaseFinanceiroAdapter),
        listarClientesOpcoes(supabaseFinanceiroAdapter),
      ]);
      setEstado({ fase: "pronto", resumo, fluxo, rentabilidade, recebiveis, clientes });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar o cockpit.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura && ehSuperadmin) carregar();
  }, [permissoesCarregando, temLeitura, ehSuperadmin, carregar]);

  if (permissoesCarregando || estado.fase === "carregando")
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;

  // AC-5: só gestão (superadmin) — nem o gate de módulo financeiro basta aqui.
  if (!temLeitura || !ehSuperadmin) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">
          O cockpit financeiro é exclusivo do dono (superadmin).
        </p>
      </div>
    );
  }
  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button
          type="button"
          onClick={carregar}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-orange hover:text-orange-deep"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const { resumo, fluxo, rentabilidade, recebiveis, clientes } = estado;
  const clientePorId = new Map(clientes.map((c) => [c.id, c.nome]));

  const fluxoFechado = fluxo.slice(0, -1); // último ponto é o mês corrente, sempre incompleto
  const amostraPeq = amostraPequena(fluxoFechado.length);
  const burnMedio = calcularBurnMedioCentavos(fluxoFechado);
  const runwayMeses = calcularRunwayMeses(resumo.posicaoCaixaCentavos, burnMedio);
  const margemContribuicao = calcularMargemContribuicao(fluxoFechado);
  const despesasMedias = calcularDespesasMediasCentavos(fluxoFechado);
  const breakEven =
    margemContribuicao !== null
      ? calcularBreakEvenCentavos(despesasMedias, margemContribuicao)
      : null;

  const mesCorrente = mesAtualIso();
  const porCliente = new Map<string, RentabilidadeMes[]>();
  for (const r of rentabilidade) {
    const lista = porCliente.get(r.clienteId) ?? [];
    lista.push(r);
    porCliente.set(r.clienteId, lista);
  }
  const mesMaisRecenteFechado = [...new Set(rentabilidade.map((r) => r.mes))]
    .filter((m) => m < mesCorrente)
    .sort()
    .at(-1);
  const rentabilidadeMesRecente = mesMaisRecenteFechado
    ? rentabilidade.filter((r) => r.mes === mesMaisRecenteFechado)
    : [];
  const ranking = ranquearPorMargem(rentabilidadeMesRecente);
  const clientesComAlerta = [...porCliente.entries()].filter(([, meses]) =>
    temAlertaMargemNegativa(meses, mesCorrente),
  );

  const receitaMesRecente = rentabilidadeMesRecente.reduce((s, r) => s + r.receitaCentavos, 0);
  const ticketMedio = calcularTicketMedioCentavos(
    receitaMesRecente,
    rentabilidadeMesRecente.length,
  );

  const percentualAtraso = percentualCarteiraEmAtraso(recebiveis);
  const inadimplencia = agruparInadimplenciaPorCliente(recebiveis);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-ink-3" />
          <h3 className="text-base font-semibold text-ink">Cockpit financeiro</h3>
        </div>
        <p className="mt-0.5 text-sm text-ink-3">
          Saúde financeira — visão executiva, exclusiva do dono.
        </p>
        {amostraPeq && (
          <div className="mt-3 flex items-center gap-2 rounded-[6px] border border-[#FFE1A8] bg-[#FFF6E5] px-3 py-2 text-sm text-[#9A6B00]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Amostra pequena ({fluxoFechado.length}{" "}
            {fluxoFechado.length === 1 ? "mês fechado" : "meses fechados"}) — runway/break-even
            ainda pouco confiáveis.
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          label="Runway"
          valor={runwayMeses === null ? "Saudável" : `${runwayMeses.toFixed(1)} meses`}
          tom={
            runwayMeses === null
              ? "positivo"
              : runwayMeses < RUNWAY_CRITICO_MESES
                ? "negativo"
                : runwayMeses < RUNWAY_ATENCAO_MESES
                  ? "atencao"
                  : "positivo"
          }
          detalhe={
            runwayMeses === null
              ? "Sem burn no período — caixa não esgota no ritmo atual"
              : "Quanto tempo o caixa dura no ritmo atual"
          }
        />
        <Indicador
          label="Ponto de equilíbrio"
          valor={breakEven === null ? "Não atingível" : `R$ ${centavosParaReais(breakEven)}`}
          tom={breakEven === null ? "negativo" : "neutro"}
          detalhe={
            breakEven === null
              ? "Margem histórica ≤ 0 — período não fechou no positivo"
              : "Faturamento mensal necessário pra empatar"
          }
        />
        <Indicador
          label="Ticket médio"
          valor={`R$ ${centavosParaReais(ticketMedio)}`}
          tom="neutro"
          detalhe={
            mesMaisRecenteFechado
              ? `Receita ÷ clientes ativos (${mesMaisRecenteFechado.slice(0, 7)})`
              : "Sem mês fechado com dados ainda"
          }
        />
        <Indicador
          label="Carteira em atraso"
          valor={`${percentualAtraso.toFixed(0)}%`}
          tom={percentualAtraso > 20 ? "negativo" : percentualAtraso > 10 ? "atencao" : "positivo"}
          detalhe={`${inadimplencia.length} cliente(s) inadimplente(s)`}
        />
      </div>

      <section className="rounded-[8px] border border-line bg-card p-4">
        <h3 className="text-sm font-semibold text-ink">
          Ranking de margem por cliente{" "}
          {mesMaisRecenteFechado
            ? `— ${mesMaisRecenteFechado.slice(5, 7)}/${mesMaisRecenteFechado.slice(0, 4)}`
            : ""}
        </h3>
        {ranking.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">Sem dados de rentabilidade no período.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2 text-right">Margem</th>
                  <th className="px-3 py-2 text-right">Alerta</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => {
                  const alerta = clientesComAlerta.some(([clienteId]) => clienteId === r.clienteId);
                  return (
                    <tr key={r.clienteId} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 text-ink-2">
                        {clientePorId.get(r.clienteId) ?? "Cliente"}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${r.margemCentavos >= 0 ? "text-[#1E8E45]" : "text-[#A23B25]"}`}
                      >
                        {r.margemCentavos >= 0 ? (
                          <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="mr-1 inline h-3.5 w-3.5" />
                        )}
                        R$ {centavosParaReais(Math.abs(r.margemCentavos))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {alerta && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#A23B25]">
                            <AlertTriangle className="h-3.5 w-3.5" />2 meses negativo — revisar
                            contrato
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[8px] border border-line bg-card p-4">
        <h3 className="text-sm font-semibold text-ink">
          Tendência de resultado (últimos {MESES_JANELA} meses)
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-3 py-2">Mês</th>
                <th className="px-3 py-2 text-right">Entradas</th>
                <th className="px-3 py-2 text-right">Saídas</th>
                <th className="px-3 py-2 text-right">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {fluxo.map((p) => (
                <tr key={p.mes} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 text-ink-2">{`${p.mes.slice(5, 7)}/${p.mes.slice(0, 4)}`}</td>
                  <td className="px-3 py-2 text-right text-[#1E8E45]">
                    R$ {centavosParaReais(p.entradasCentavos)}
                  </td>
                  <td className="px-3 py-2 text-right text-[#A23B25]">
                    R$ {centavosParaReais(p.saidasCentavos)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${p.resultadoCentavos >= 0 ? "text-[#1E8E45]" : "text-[#A23B25]"}`}
                  >
                    R$ {centavosParaReais(Math.abs(p.resultadoCentavos))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Indicador({
  label,
  valor,
  detalhe,
  tom,
}: {
  label: string;
  valor: string;
  detalhe: string;
  tom: "positivo" | "negativo" | "atencao" | "neutro";
}) {
  const cores: Record<typeof tom, string> = {
    positivo: "text-[#1E8E45]",
    negativo: "text-[#A23B25]",
    atencao: "text-[#9A6B00]",
    neutro: "text-ink",
  };
  return (
    <div className="rounded-[8px] border border-line bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${cores[tom]}`}>{valor}</p>
      <p className="mt-1 text-[11px] text-ink-3">{detalhe}</p>
    </div>
  );
}
