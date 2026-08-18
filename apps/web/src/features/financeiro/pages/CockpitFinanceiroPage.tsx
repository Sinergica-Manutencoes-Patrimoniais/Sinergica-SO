import { Button, DataTable } from "@sinergica/ui";
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
    return <div className="p-8 text-center text-body text-ink-3">Carregando…</div>;

  // AC-5: só gestão (superadmin) — nem o gate de módulo financeiro basta aqui.
  if (!temLeitura || !ehSuperadmin) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-body text-ink-3">
          O cockpit financeiro é exclusivo do dono (superadmin).
        </p>
      </div>
    );
  }
  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-body text-ink-3">{estado.mensagem}</p>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={carregar}
          className="mt-4"
        >
          Tentar novamente
        </Button>
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
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-ink-3" />
          <h3 className="text-heading font-semibold text-ink">Cockpit financeiro</h3>
        </div>
        <p className="mt-0.5 text-body text-ink-3">
          Saúde financeira — visão executiva, exclusiva do dono.
        </p>
        {amostraPeq && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-warning-soft bg-warning-soft px-3 py-2 text-body text-warning">
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

      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-body font-semibold text-ink">
          Ranking de margem por cliente{" "}
          {mesMaisRecenteFechado
            ? `— ${mesMaisRecenteFechado.slice(5, 7)}/${mesMaisRecenteFechado.slice(0, 4)}`
            : ""}
        </h3>
        <div className="mt-3">
          <DataTable
            colunas={[
              {
                chave: "cliente",
                cabecalho: "Cliente",
                render: (r: RentabilidadeMes) => clientePorId.get(r.clienteId) ?? "Cliente",
              },
              {
                chave: "margem",
                cabecalho: "Margem",
                numerica: true,
                render: (r: RentabilidadeMes) => (
                  <span
                    className={`font-semibold ${r.margemCentavos >= 0 ? "text-success" : "text-danger"}`}
                  >
                    {r.margemCentavos >= 0 ? (
                      <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="mr-1 inline h-3.5 w-3.5" />
                    )}
                    R$ {centavosParaReais(Math.abs(r.margemCentavos))}
                  </span>
                ),
              },
              {
                chave: "alerta",
                cabecalho: "Alerta",
                numerica: true,
                render: (r: RentabilidadeMes) => {
                  const alerta = clientesComAlerta.some(([clienteId]) => clienteId === r.clienteId);
                  return alerta ? (
                    <span className="inline-flex items-center gap-1 text-caption font-semibold text-danger">
                      <AlertTriangle className="h-3.5 w-3.5" />2 meses negativo — revisar contrato
                    </span>
                  ) : null;
                },
              },
            ]}
            itens={ranking}
            chaveLinha={(r) => r.clienteId}
            vazio={<>Sem dados de rentabilidade no período.</>}
          />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-body font-semibold text-ink">
          Tendência de resultado (últimos {MESES_JANELA} meses)
        </h3>
        <div className="mt-3">
          <DataTable
            colunas={[
              {
                chave: "mes",
                cabecalho: "Mês",
                render: (p: PontoFluxoMensal) => `${p.mes.slice(5, 7)}/${p.mes.slice(0, 4)}`,
              },
              {
                chave: "entradas",
                cabecalho: "Entradas",
                numerica: true,
                render: (p: PontoFluxoMensal) => (
                  <span className="text-success">R$ {centavosParaReais(p.entradasCentavos)}</span>
                ),
              },
              {
                chave: "saidas",
                cabecalho: "Saídas",
                numerica: true,
                render: (p: PontoFluxoMensal) => (
                  <span className="text-danger">R$ {centavosParaReais(p.saidasCentavos)}</span>
                ),
              },
              {
                chave: "resultado",
                cabecalho: "Resultado",
                numerica: true,
                render: (p: PontoFluxoMensal) => (
                  <span
                    className={`font-semibold ${p.resultadoCentavos >= 0 ? "text-success" : "text-danger"}`}
                  >
                    R$ {centavosParaReais(Math.abs(p.resultadoCentavos))}
                  </span>
                ),
              },
            ]}
            itens={fluxo}
            chaveLinha={(p) => p.mes}
            vazio={<>Sem dados de fluxo no período.</>}
          />
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
    positivo: "text-success",
    negativo: "text-danger",
    atencao: "text-warning",
    neutro: "text-ink",
  };
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <p className="text-caption font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <p className={`mt-1 text-title font-semibold ${cores[tom]}`}>{valor}</p>
      <p className="mt-1 text-micro text-ink-3">{detalhe}</p>
    </div>
  );
}
