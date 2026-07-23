import { AlertTriangle, RefreshCw, Target } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { listarCategorias } from "../application/categorias";
import { obterOrcamentoRealizado, salvarOrcamentoAnual } from "../application/dre";
import type { CategoriaItem } from "../domain/categoria";
import { centavosParaReais, reaisParaCentavos } from "../domain/dinheiro";
import { calcularDesvio } from "../domain/dre";
import type { OrcamentoRealizadoLinha } from "../domain/dre";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; linhas: OrcamentoRealizadoLinha[]; categorias: CategoriaItem[] };

function anoAtual(): number {
  return new Date().getUTCFullYear();
}

export function OrcamentoPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [ano, setAno] = useState(anoAtual());
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("");
  const [valorMensal, setValorMensal] = useState("");
  const [salvando, setSalvando] = useState(false);

  const temLeitura = podeAcessar("financeiro", "leitura");
  const temEscrita = podeAcessar("financeiro", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [linhas, categorias] = await Promise.all([
        obterOrcamentoRealizado(supabaseFinanceiroAdapter, ano),
        listarCategorias(supabaseFinanceiroAdapter),
      ]);
      setEstado({ fase: "pronto", linhas, categorias });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar orçamento.",
      });
    }
  }, [ano]);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar() {
    if (!user || !categoriaSelecionada) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      await salvarOrcamentoAnual(
        supabaseFinanceiroAdapter,
        categoriaSelecionada,
        ano,
        reaisParaCentavos(valorMensal),
        user.id,
      );
      setValorMensal("");
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível salvar o orçamento.");
    } finally {
      setSalvando(false);
    }
  }

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

  const { linhas, categorias } = estado;

  const porCategoria = new Map<string, OrcamentoRealizadoLinha[]>();
  for (const l of linhas) {
    const lista = porCategoria.get(l.categoriaId) ?? [];
    lista.push(l);
    porCategoria.set(l.categoriaId, lista);
  }

  const resumoAnual = [...porCategoria.entries()].map(([categoriaId, linhasCategoria]) => {
    const nome = linhasCategoria[0]?.categoriaNome ?? "Categoria";
    const orcado = linhasCategoria.reduce((s, l) => s + l.orcadoCentavos, 0);
    const realizado = linhasCategoria.reduce((s, l) => s + l.realizadoCentavos, 0);
    const temOrcamento = linhasCategoria.some((l) => l.temOrcamento);
    return calcularDesvio(categoriaId, nome, orcado, realizado, temOrcamento);
  });

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-ink-3" />
            <h3 className="text-base font-semibold text-ink">Orçamento — {ano}</h3>
          </div>
          <label className="block">
            <input
              type="number"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="input w-28"
            />
          </label>
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {temEscrita && (
        <section className="rounded-[8px] border border-line bg-card p-4">
          <h3 className="text-sm font-semibold text-ink">Definir meta mensal</h3>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-3">Categoria</span>
              <select
                value={categoriaSelecionada}
                onChange={(e) => setCategoriaSelecionada(e.target.value)}
                className="input w-64"
              >
                <option value="">Selecione...</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-3">Valor mensal (R$)</span>
              <input
                value={valorMensal}
                onChange={(e) => setValorMensal(e.target.value)}
                className="input w-40"
                placeholder="0,00"
              />
            </label>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || !categoriaSelecionada}
              className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Aplicar aos 12 meses"}
            </button>
          </div>
        </section>
      )}

      {resumoAnual.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <Target className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhum orçamento ou lançamento neste ano ainda.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[8px] border border-line bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2 text-right">Orçado (ano)</th>
                <th className="px-3 py-2 text-right">Realizado (ano)</th>
                <th className="px-3 py-2 text-right">Desvio</th>
              </tr>
            </thead>
            <tbody>
              {resumoAnual.map((d) => (
                <tr key={d.categoriaId} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 text-ink-2">{d.categoriaNome}</td>
                  <td className="px-3 py-2 text-right text-ink-2">
                    {d.temOrcamento ? `R$ ${centavosParaReais(d.orcadoCentavos)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-2">
                    R$ {centavosParaReais(d.realizadoCentavos)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {d.temOrcamento ? (
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${d.estourou ? "text-[#A23B25]" : "text-[#1E8E45]"}`}
                      >
                        {d.estourou && <AlertTriangle className="h-3.5 w-3.5" />}
                        {d.desvioPercentual !== null
                          ? `${d.desvioPercentual >= 0 ? "+" : ""}${d.desvioPercentual.toFixed(1)}%`
                          : "—"}
                      </span>
                    ) : (
                      <span className="text-ink-3">sem meta</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
