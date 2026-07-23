import { RefreshCw, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import { listarCategorias } from "../application/categorias";
import { obterProjecaoCaixa } from "../application/contas-pagar";
import { listarAgingRecebiveis } from "../application/contratos";
import { obterFluxoMensal, obterGastosCategoria, obterResumoCaixa } from "../application/dashboard";
import { FluxoMensalChart } from "../components/graficos/FluxoMensalChart";
import { GastosCategoriaChart } from "../components/graficos/GastosCategoriaChart";
import { PrevistoRealizadoCard } from "../components/graficos/PrevistoRealizadoCard";
import { percentualCarteiraEmAtraso } from "../domain/aging";
import type { CategoriaItem } from "../domain/categoria";
import { agregarGastosPorRaiz } from "../domain/dashboard";
import type { GastoCategoria, PontoFluxoMensal, ResumoCaixa } from "../domain/dashboard";
import { centavosParaReais } from "../domain/dinheiro";
import { primeiroPontoNegativo } from "../domain/projecao-caixa";
import type { PontoProjecaoCaixa } from "../domain/projecao-caixa";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | {
      fase: "pronto";
      resumo: ResumoCaixa;
      fluxo: PontoFluxoMensal[];
      gastos: GastoCategoria[];
      categorias: CategoriaItem[];
      percentualInadimplencia: number;
      projecao: PontoProjecaoCaixa[];
    };

function inicioMesAtualIso(): string {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
}

function fimMesAtualIso(): string {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export function FinanceiroDashboardPage() {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const temLeitura = podeAcessar("financeiro", "leitura");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [resumo, fluxo, gastos, categorias, aging, projecao] = await Promise.all([
        obterResumoCaixa(supabaseFinanceiroAdapter),
        obterFluxoMensal(supabaseFinanceiroAdapter, 12),
        obterGastosCategoria(supabaseFinanceiroAdapter, inicioMesAtualIso(), fimMesAtualIso()),
        listarCategorias(supabaseFinanceiroAdapter),
        listarAgingRecebiveis(supabaseFinanceiroAdapter),
        obterProjecaoCaixa(supabaseFinanceiroAdapter, 90),
      ]);
      setEstado({
        fase: "pronto",
        resumo,
        fluxo,
        gastos,
        categorias,
        percentualInadimplencia: percentualCarteiraEmAtraso(aging),
        projecao,
      });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar o dashboard.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  if (permissoesCarregando || estado.fase === "carregando")
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">
          Você não tem permissão de leitura no módulo Financeiro.
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

  const { resumo, fluxo, gastos, categorias, percentualInadimplencia, projecao } = estado;
  const pontoNegativo = primeiroPontoNegativo(projecao);
  const gastosAgregados = agregarGastosPorRaiz(gastos, categorias);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">Dashboard Financeiro</h3>
            <p className="mt-0.5 text-sm text-ink-3">Posição de caixa e resultado do mês.</p>
          </div>
          <button
            type="button"
            onClick={carregar}
            className="text-ink-3 hover:text-ink"
            title="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <Kpi label="Posição de caixa" valorCentavos={resumo.posicaoCaixaCentavos} destaque />
        <Kpi label="Entradas do mês" valorCentavos={resumo.entradasMesCentavos} tom="positivo" />
        <Kpi label="Saídas do mês" valorCentavos={resumo.saidasMesCentavos} tom="negativo" />
        <Kpi
          label="Resultado do mês"
          valorCentavos={resumo.resultadoMesCentavos}
          tom={resumo.resultadoMesCentavos >= 0 ? "positivo" : "negativo"}
        />
        <Kpi label="A receber (30d)" valorCentavos={resumo.aReceber30dCentavos} tom="positivo" />
        <Kpi label="A pagar (30d)" valorCentavos={resumo.aPagar30dCentavos} tom="negativo" />
        <div className="rounded-[8px] border border-line bg-card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            Inadimplência
          </p>
          <p
            className={`mt-1 text-lg font-semibold ${percentualInadimplencia > 10 ? "text-[#A23B25]" : "text-ink"}`}
          >
            {percentualInadimplencia.toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-[8px] border border-line bg-card p-4">
          <h4 className="mb-3 text-sm font-semibold text-ink">Fluxo mensal (12 meses)</h4>
          <FluxoMensalChart pontos={fluxo} />
        </div>
        <div className="rounded-[8px] border border-line bg-card p-4">
          <h4 className="mb-3 text-sm font-semibold text-ink">
            Gasto por categoria — mês corrente
          </h4>
          <GastosCategoriaChart itens={gastosAgregados} />
        </div>
      </div>

      <div className="rounded-[8px] border border-line bg-card p-4">
        <h4 className="mb-3 text-sm font-semibold text-ink">Previsto × realizado — mês corrente</h4>
        <PrevistoRealizadoCard
          entradaPrevista={resumo.entradasPrevistasMesCentavos}
          entradaRealizada={resumo.entradasMesCentavos}
          saidaPrevista={resumo.saidasPrevistasMesCentavos}
          saidaRealizada={resumo.saidasMesCentavos}
        />
      </div>

      <div className="rounded-[8px] border border-line bg-card p-4">
        <h4 className="mb-3 text-sm font-semibold text-ink">Projeção de caixa</h4>
        {pontoNegativo && (
          <p className="mb-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm font-semibold text-[#A23B25]">
            Saldo projetado fica negativo em{" "}
            {new Date(pontoNegativo.dataLimite).toLocaleDateString("pt-BR")} (+
            {pontoNegativo.diasHorizonte}d)
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {projecao.map((p) => (
            <div key={p.diasHorizonte} className="rounded-[8px] border border-line p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                +{p.diasHorizonte}d
              </p>
              <p
                className={`mt-1 text-sm font-semibold ${p.saldoProjetadoCentavos < 0 ? "text-[#A23B25]" : "text-ink"}`}
              >
                R$ {centavosParaReais(p.saldoProjetadoCentavos)}
              </p>
              <p className="mt-0.5 text-[10px] text-ink-3">
                {new Date(p.dataLimite).toLocaleDateString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  valorCentavos,
  tom,
  destaque,
}: { label: string; valorCentavos: number; tom?: "positivo" | "negativo"; destaque?: boolean }) {
  const cor = destaque ? "text-ink" : tom === "positivo" ? "text-[#1E8E45]" : "text-[#A23B25]";
  return (
    <div className="rounded-[8px] border border-line bg-card p-3">
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
        {destaque && <Wallet className="h-3 w-3" />}
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${cor}`}>
        R$ {centavosParaReais(Math.abs(valorCentavos))}
      </p>
    </div>
  );
}
