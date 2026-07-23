import { FileBarChart, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import { obterDreMensal } from "../application/dre";
import { centavosParaReais } from "../domain/dinheiro";
import { agregarDre } from "../domain/dre";
import type { DreMensal } from "../domain/dre";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; dres: DreMensal[] };

const MESES_JANELA = 6;

function ultimosMesesIso(qtd: number): string[] {
  const hoje = new Date();
  return Array.from({ length: qtd }, (_, i) => {
    const data = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - (qtd - 1 - i), 1));
    return data.toISOString().slice(0, 10);
  });
}

function formatarMes(iso: string): string {
  const [ano, mes] = iso.split("-");
  return `${mes}/${ano}`;
}

export function DrePage() {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });

  const temLeitura = podeAcessar("financeiro", "leitura");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const linhas = await obterDreMensal(supabaseFinanceiroAdapter, MESES_JANELA);
      setEstado({ fase: "pronto", dres: agregarDre(linhas, ultimosMesesIso(MESES_JANELA)) });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar o DRE.",
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

  const { dres } = estado;
  const gruposUnicos = [
    ...new Set(dres.flatMap((d) => d.despesasPorGrupo.map((g) => g.nome))),
  ].sort();

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex items-center gap-2">
          <FileBarChart className="h-4 w-4 text-ink-3" />
          <h3 className="text-base font-semibold text-ink">DRE gerencial</h3>
        </div>
        <p className="mt-0.5 text-sm text-ink-3">
          Resultado por regime de competência (não é caixa — pode divergir do dashboard, que é por
          data de pagamento).
        </p>
      </section>

      <div className="overflow-x-auto rounded-[8px] border border-line bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-3">
            <tr>
              <th className="px-3 py-2">Linha</th>
              {dres.map((d) => (
                <th key={d.mes} className="px-3 py-2 text-right">
                  {formatarMes(d.mes)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <td className="px-3 py-2 font-semibold text-[#1E8E45]">Receita</td>
              {dres.map((d) => (
                <td key={d.mes} className="px-3 py-2 text-right text-ink-2">
                  R$ {centavosParaReais(d.receitaCentavos)}
                </td>
              ))}
            </tr>
            {gruposUnicos.map((grupo) => (
              <tr key={grupo} className="border-b border-line">
                <td className="px-3 py-2 text-ink-3">{grupo}</td>
                {dres.map((d) => {
                  const item = d.despesasPorGrupo.find((g) => g.nome === grupo);
                  return (
                    <td key={d.mes} className="px-3 py-2 text-right text-ink-2">
                      {item ? `R$ ${centavosParaReais(item.valorCentavos)}` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-b border-line">
              <td className="px-3 py-2 font-semibold text-[#A23B25]">Despesas (total)</td>
              {dres.map((d) => (
                <td key={d.mes} className="px-3 py-2 text-right font-semibold text-ink-2">
                  R$ {centavosParaReais(d.despesasTotalCentavos)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-2 font-semibold text-ink">Resultado líquido</td>
              {dres.map((d) => (
                <td
                  key={d.mes}
                  className={`px-3 py-2 text-right text-base font-semibold ${d.resultadoCentavos >= 0 ? "text-[#1E8E45]" : "text-[#A23B25]"}`}
                >
                  R$ {centavosParaReais(Math.abs(d.resultadoCentavos))}
                  {d.resultadoCentavos < 0 ? " (neg.)" : ""}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
