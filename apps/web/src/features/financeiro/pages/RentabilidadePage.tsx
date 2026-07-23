import { AlertTriangle, ChevronDown, ChevronRight, PieChart, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import type { ClienteOpcao } from "../application/financeiro-gateway";
import type { CustoOsItem } from "../application/financeiro-gateway";
import { listarClientesOpcoes } from "../application/lancamentos";
import {
  obterCustoOsPorClienteMes,
  obterRentabilidadeClienteMes,
} from "../application/rentabilidade";
import { centavosParaReais } from "../domain/dinheiro";
import { cobertura, temAlertaMargemNegativa } from "../domain/rentabilidade";
import type { RentabilidadeMes } from "../domain/rentabilidade";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; itens: RentabilidadeMes[]; clientes: ClienteOpcao[] };

interface ClienteAgregado {
  clienteId: string;
  meses: RentabilidadeMes[];
  receitaTotal: number;
  custoTotal: number;
  margemTotal: number;
  horasTotais: number;
  horasValoradas: number;
  temAlerta: boolean;
}

function agregarPorCliente(itens: RentabilidadeMes[]): ClienteAgregado[] {
  const mesCorrente = `${new Date().toISOString().slice(0, 8)}01`;
  const porCliente = new Map<string, RentabilidadeMes[]>();
  for (const item of itens) {
    const lista = porCliente.get(item.clienteId) ?? [];
    lista.push(item);
    porCliente.set(item.clienteId, lista);
  }
  const agregados: ClienteAgregado[] = [];
  for (const [clienteId, meses] of porCliente) {
    const receitaTotal = meses.reduce((s, m) => s + m.receitaCentavos, 0);
    const custoTotal = meses.reduce((s, m) => s + m.custoMoCentavos + m.custoDespesasCentavos, 0);
    agregados.push({
      clienteId,
      meses: meses.sort((a, b) => b.mes.localeCompare(a.mes)),
      receitaTotal,
      custoTotal,
      margemTotal: receitaTotal - custoTotal,
      horasTotais: meses.reduce((s, m) => s + m.horasTotais, 0),
      horasValoradas: meses.reduce((s, m) => s + m.horasValoradas, 0),
      temAlerta: temAlertaMargemNegativa(meses, mesCorrente),
    });
  }
  return agregados.sort((a, b) => b.margemTotal - a.margemTotal);
}

export function RentabilidadePage() {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [expandido, setExpandido] = useState<string | null>(null);

  const temLeitura = podeAcessar("financeiro", "leitura");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [itens, clientes] = await Promise.all([
        obterRentabilidadeClienteMes(supabaseFinanceiroAdapter, 12),
        listarClientesOpcoes(supabaseFinanceiroAdapter),
      ]);
      setEstado({ fase: "pronto", itens, clientes });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar rentabilidade.",
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

  const { itens, clientes } = estado;
  const clientePorId = new Map(clientes.map((c) => [c.id, c.nome]));
  const agregados = agregarPorCliente(itens);
  const semDespesasSincronizadas = itens.every((i) => i.custoDespesasCentavos === 0);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <h3 className="text-base font-semibold text-ink">Rentabilidade por cliente</h3>
        <p className="mt-0.5 text-sm text-ink-3">
          Receita − custo real (horas + despesas), últimos 12 meses.
        </p>
        {semDespesasSincronizadas && (
          <p className="mt-3 flex items-center gap-1.5 rounded-[6px] border border-line bg-line-soft px-3 py-2 text-xs text-ink-3">
            <AlertTriangle className="h-3.5 w-3.5" />
            Despesas de campo ainda sem sincronização do Auvo — custo considera só horas por
            enquanto.
          </p>
        )}
      </section>

      {agregados.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <PieChart className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Sem dados de rentabilidade no período.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {agregados.map((a) => {
            const cob = cobertura({ horasTotais: a.horasTotais, horasValoradas: a.horasValoradas });
            return (
              <div key={a.clienteId} className="rounded-[8px] border border-line bg-card">
                <button
                  type="button"
                  onClick={() => setExpandido(expandido === a.clienteId ? null : a.clienteId)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {expandido === a.clienteId ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-ink-3" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
                    )}
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
                        {clientePorId.get(a.clienteId) ?? "Cliente"}
                        {a.temAlerta && (
                          <span title="Margem negativa em 2 meses consecutivos — revisar contrato">
                            <AlertTriangle className="h-3.5 w-3.5 text-[#A23B25]" />
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink-3">
                        Receita R$ {centavosParaReais(a.receitaTotal)} · Custo R${" "}
                        {centavosParaReais(a.custoTotal)} · Cobertura {cob.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${a.margemTotal >= 0 ? "text-[#1E8E45]" : "text-[#A23B25]"}`}
                  >
                    R$ {centavosParaReais(a.margemTotal)}
                  </span>
                </button>
                {expandido === a.clienteId && <DetalheMensal cliente={a} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetalheMensal({ cliente }: { cliente: ClienteAgregado }) {
  const [mesExpandido, setMesExpandido] = useState<string | null>(null);
  const [osDoMes, setOsDoMes] = useState<CustoOsItem[]>([]);

  async function expandirMes(mes: string) {
    if (mesExpandido === mes) {
      setMesExpandido(null);
      return;
    }
    setMesExpandido(mes);
    const os = await obterCustoOsPorClienteMes(supabaseFinanceiroAdapter, cliente.clienteId, mes);
    setOsDoMes(os);
  }

  return (
    <div className="border-t border-line px-4 pb-4">
      {cliente.meses.map((m) => (
        <div key={m.mes} className="border-b border-line py-2 last:border-0">
          <button
            type="button"
            onClick={() => expandirMes(m.mes)}
            className="flex w-full items-center justify-between text-xs"
          >
            <span className="text-ink-2">
              {new Date(m.mes).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </span>
            <span className={m.margemCentavos >= 0 ? "text-[#1E8E45]" : "text-[#A23B25]"}>
              R$ {centavosParaReais(m.margemCentavos)} (
              {m.margemPercentual !== null ? `${m.margemPercentual}%` : "—"})
            </span>
          </button>
          {mesExpandido === m.mes && (
            <div className="mt-2 flex flex-col gap-1 pl-3">
              {osDoMes.length === 0 ? (
                <p className="text-[11px] text-ink-3">Sem OS finalizadas neste mês.</p>
              ) : (
                osDoMes.map((os) => (
                  <div key={os.osId} className="flex justify-between text-[11px] text-ink-3">
                    <span>
                      OS {os.numero} · {os.horas.toFixed(2)}h {!os.valorado && "(não valorado)"}
                    </span>
                    <span>R$ {centavosParaReais(os.custoMoCentavos + os.despesaCentavos)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
