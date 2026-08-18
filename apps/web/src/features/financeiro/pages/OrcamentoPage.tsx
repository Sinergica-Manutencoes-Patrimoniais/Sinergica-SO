import { Button, DataTable, Skeleton } from "@sinergica/ui";
import { AlertTriangle, RefreshCw, Target } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { listarCategorias } from "../application/categorias";
import { obterOrcamentoRealizado, salvarOrcamentoAnual } from "../application/dre";
import type { CategoriaItem } from "../domain/categoria";
import { centavosParaReais, reaisParaCentavos } from "../domain/dinheiro";
import { calcularDesvio } from "../domain/dre";
import type { DesvioOrcamento, OrcamentoRealizadoLinha } from "../domain/dre";
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
    setEstado((atual) => (atual.fase === "pronto" ? atual : { fase: "carregando" }));
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
    return (
      <div className="flex flex-col gap-3 p-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    );
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-body text-ink-3">
          Você não tem permissão de leitura no módulo Financeiro.
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
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={carregar}
          className="mt-4"
        >
          Tentar novamente
        </Button>
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
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-ink-3" />
            <h1 className="text-heading font-semibold text-ink">Orçamento — {ano}</h1>
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
          <div className="mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erroAcao}
          </div>
        )}
      </section>

      {temEscrita && (
        <section className="rounded-lg border border-line bg-card p-4">
          <h3 className="text-body font-semibold text-ink">Definir meta mensal</h3>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-caption font-semibold text-ink-3">Categoria</span>
              <select
                value={categoriaSelecionada}
                onChange={(e) => setCategoriaSelecionada(e.target.value)}
                className="input w-64"
              >
                <option value="">Selecione…</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-caption font-semibold text-ink-3">
                Valor mensal (R$)
              </span>
              <input
                value={valorMensal}
                onChange={(e) => setValorMensal(e.target.value)}
                className="input w-40"
                placeholder="0,00"
              />
            </label>
            <Button
              variant="accent"
              onClick={salvar}
              disabled={salvando || !categoriaSelecionada}
              loading={salvando}
            >
              Aplicar aos 12 meses
            </Button>
          </div>
        </section>
      )}

      {resumoAnual.length === 0 ? (
        <div className="rounded-lg border border-line bg-card px-5 py-10 text-center">
          <Target className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-body text-ink-3">
            Nenhum orçamento ou lançamento neste ano ainda.
          </p>
        </div>
      ) : (
        <DataTable
          colunas={[
            {
              chave: "categoria",
              cabecalho: "Categoria",
              render: (d: DesvioOrcamento) => d.categoriaNome,
            },
            {
              chave: "orcado",
              cabecalho: "Orçado (ano)",
              numerica: true,
              render: (d: DesvioOrcamento) =>
                d.temOrcamento ? `R$ ${centavosParaReais(d.orcadoCentavos)}` : "—",
            },
            {
              chave: "realizado",
              cabecalho: "Realizado (ano)",
              numerica: true,
              render: (d: DesvioOrcamento) => `R$ ${centavosParaReais(d.realizadoCentavos)}`,
            },
            {
              chave: "desvio",
              cabecalho: "Desvio",
              numerica: true,
              render: (d: DesvioOrcamento) =>
                d.temOrcamento ? (
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${d.estourou ? "text-danger" : "text-success"}`}
                  >
                    {d.estourou && <AlertTriangle className="h-3.5 w-3.5" />}
                    {d.desvioPercentual !== null
                      ? `${d.desvioPercentual >= 0 ? "+" : ""}${d.desvioPercentual.toFixed(1)}%`
                      : "—"}
                  </span>
                ) : (
                  <span className="text-ink-3">sem meta</span>
                ),
            },
          ]}
          itens={resumoAnual}
          chaveLinha={(d) => d.categoriaId}
          vazio={<>Nenhum orçamento ou lançamento neste ano ainda.</>}
        />
      )}
    </div>
  );
}
