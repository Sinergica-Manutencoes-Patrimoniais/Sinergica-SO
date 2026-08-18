import { Button, DataTable } from "@sinergica/ui";
import { Landmark, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  listarProvisoesImposto,
  obterConfigImpostos,
  provisionarImposto,
  salvarConfigImpostos,
} from "../application/impostos";
import { centavosParaReais } from "../domain/dinheiro";
import { FAIXAS_ANEXO_III_PADRAO } from "../domain/impostos";
import type {
  ConfigImpostos,
  FaixaRbt12,
  ProvisaoImposto,
  TipoAliquotaImposto,
} from "../domain/impostos";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; config: ConfigImpostos | null; provisoes: ProvisaoImposto[] };

function mesAtualISO(): string {
  return `${new Date().toISOString().slice(0, 7)}-01`;
}

/** `new Date("2026-07-01")` parseia como UTC meia-noite; formatar em `pt-BR` (America/Sao_Paulo,
 * UTC-3) rola pro dia/mês anterior. Extrai mês/ano direto da string ISO — sem passar por `Date`. */
function formatarCompetencia(competenciaIso: string): string {
  const [ano, mes] = competenciaIso.split("-");
  return `${mes}/${ano}`;
}

export function ImpostosPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [provisionando, setProvisionando] = useState(false);
  const [competencia, setCompetencia] = useState(mesAtualISO());

  const temLeitura = podeAcessar("financeiro", "leitura");
  const temEscrita = podeAcessar("financeiro", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [config, provisoes] = await Promise.all([
        obterConfigImpostos(supabaseFinanceiroAdapter),
        listarProvisoesImposto(supabaseFinanceiroAdapter),
      ]);
      setEstado({ fase: "pronto", config, provisoes });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar impostos.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(config: ConfigImpostos) {
    if (!user) return;
    setErroAcao(null);
    await salvarConfigImpostos(supabaseFinanceiroAdapter, { ...config, userId: user.id });
    await carregar();
  }

  async function provisionar() {
    if (!competencia) return;
    setProvisionando(true);
    setErroAcao(null);
    try {
      await provisionarImposto(supabaseFinanceiroAdapter, competencia);
      await carregar();
    } catch (error) {
      setErroAcao(
        error instanceof Error ? error.message : "Não foi possível provisionar o imposto.",
      );
    } finally {
      setProvisionando(false);
    }
  }

  if (permissoesCarregando || estado.fase === "carregando")
    return <div className="p-8 text-center text-body text-ink-3">Carregando…</div>;
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

  const { config, provisoes } = estado;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-ink-3" />
          <h3 className="text-heading font-semibold text-ink">Impostos — provisão gerencial</h3>
        </div>
        <p className="mt-0.5 text-body text-ink-3">
          Simples Nacional/DAS por competência — provisão gerencial, não substitui a apuração fiscal
          oficial.
        </p>
        {erroAcao && (
          <div className="mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erroAcao}
          </div>
        )}
      </section>

      {temEscrita && <ConfigForm config={config} onSalvar={salvar} />}

      {config && (
        <section className="rounded-lg border border-line bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-body font-semibold text-ink">Provisionar competência</h3>
              <p className="mt-0.5 text-caption text-ink-3">
                Recalcula se já existir provisão para o mês (retificação, auditável).
              </p>
            </div>
            {temEscrita && (
              <div className="flex items-end gap-2">
                <label className="block">
                  <span className="mb-1 block text-micro font-semibold text-ink-3">
                    Competência
                  </span>
                  <input
                    type="month"
                    value={competencia.slice(0, 7)}
                    onChange={(e) => setCompetencia(`${e.target.value}-01`)}
                    className="input"
                  />
                </label>
                <Button
                  variant="accent"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={provisionar}
                  disabled={provisionando}
                  loading={provisionando}
                >
                  Provisionar
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {provisoes.length === 0 ? (
        <div className="rounded-lg border border-line bg-card px-5 py-10 text-center">
          <Landmark className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-body text-ink-3">Nenhuma provisão calculada ainda.</p>
        </div>
      ) : (
        <DataTable
          colunas={[
            {
              chave: "competencia",
              cabecalho: "Competência",
              render: (p: ProvisaoImposto) => formatarCompetencia(p.competencia),
            },
            {
              chave: "receita",
              cabecalho: "Receita",
              numerica: true,
              render: (p: ProvisaoImposto) => `R$ ${centavosParaReais(p.receitaCentavos)}`,
            },
            {
              chave: "rbt12",
              cabecalho: "RBT12",
              numerica: true,
              render: (p: ProvisaoImposto) => `R$ ${centavosParaReais(p.rbt12Centavos)}`,
            },
            {
              chave: "aliquota",
              cabecalho: "Alíquota efetiva",
              numerica: true,
              render: (p: ProvisaoImposto) => `${(p.aliquotaEfetiva * 100).toFixed(2)}%`,
            },
            {
              chave: "imposto",
              cabecalho: "Imposto",
              numerica: true,
              render: (p: ProvisaoImposto) => (
                <span className="font-semibold text-ink">
                  R$ {centavosParaReais(p.valorCentavos)}
                </span>
              ),
            },
          ]}
          itens={provisoes}
          chaveLinha={(p) => p.competencia}
          vazio={<>Nenhuma provisão calculada ainda.</>}
        />
      )}
    </div>
  );
}

function ConfigForm({
  config,
  onSalvar,
}: { config: ConfigImpostos | null; onSalvar: (config: ConfigImpostos) => Promise<void> }) {
  const [tipo, setTipo] = useState<TipoAliquotaImposto>(config?.tipo ?? "faixa_rbt12");
  const [aliquotaFixaPercentual, setAliquotaFixaPercentual] = useState(
    config?.aliquotaFixa != null ? String((config.aliquotaFixa * 100).toFixed(2)) : "6,00",
  );
  const [faixas, setFaixas] = useState<FaixaRbt12[]>(
    config?.faixas.length ? config.faixas : FAIXAS_ANEXO_III_PADRAO,
  );
  const [diaVencimento, setDiaVencimento] = useState(config?.diaVencimento ?? 20);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({
        tipo,
        aliquotaFixa:
          tipo === "fixa" ? Number(aliquotaFixaPercentual.replace(",", ".")) / 100 : null,
        faixas: tipo === "faixa_rbt12" ? faixas : [],
        diaVencimento,
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function atualizarFaixa(index: number, patch: Partial<FaixaRbt12>) {
    setFaixas((atual) => atual.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <h3 className="text-body font-semibold text-ink">Configuração</h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">
            Regime de cálculo
          </span>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoAliquotaImposto)}
            className="input w-full"
          >
            <option value="faixa_rbt12">Simples Nacional — faixas por RBT12</option>
            <option value="fixa">Alíquota fixa</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">
            Dia de vencimento (mês seguinte)
          </span>
          <input
            type="number"
            min={1}
            max={28}
            value={diaVencimento}
            onChange={(e) => setDiaVencimento(Number(e.target.value))}
            className="input w-full"
          />
        </label>
        {tipo === "fixa" && (
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">
              Alíquota fixa (%)
            </span>
            <input
              value={aliquotaFixaPercentual}
              onChange={(e) => setAliquotaFixaPercentual(e.target.value)}
              className="input w-full"
              placeholder="6,00"
            />
          </label>
        )}
      </div>

      {tipo === "faixa_rbt12" && (
        <div className="mt-4">
          <DataTable
            colunas={[
              {
                chave: "ateRbt12",
                cabecalho: "Até RBT12 (R$)",
                render: (f: FaixaRbt12 & { __i: number }) => (
                  <input
                    value={f.ateRbt12Centavos == null ? "" : centavosParaReais(f.ateRbt12Centavos)}
                    onChange={(e) =>
                      atualizarFaixa(f.__i, {
                        ateRbt12Centavos: e.target.value
                          ? Math.round(Number(e.target.value.replace(",", ".")) * 100)
                          : null,
                      })
                    }
                    placeholder="sem teto"
                    className="input w-full"
                  />
                ),
              },
              {
                chave: "aliquotaNominal",
                cabecalho: "Alíquota nominal (%)",
                render: (f: FaixaRbt12 & { __i: number }) => (
                  <input
                    value={(f.aliquotaNominal * 100).toFixed(2)}
                    onChange={(e) =>
                      atualizarFaixa(f.__i, {
                        aliquotaNominal: Number(e.target.value.replace(",", ".")) / 100,
                      })
                    }
                    className="input w-full"
                  />
                ),
              },
              {
                chave: "parcelaDeduzir",
                cabecalho: "Parcela a deduzir (R$)",
                render: (f: FaixaRbt12 & { __i: number }) => (
                  <input
                    value={centavosParaReais(f.parcelaDeduzirCentavos)}
                    onChange={(e) =>
                      atualizarFaixa(f.__i, {
                        parcelaDeduzirCentavos: Math.round(
                          Number(e.target.value.replace(",", ".")) * 100,
                        ),
                      })
                    }
                    className="input w-full"
                  />
                ),
              },
              {
                chave: "acoes",
                cabecalho: "",
                render: (f: FaixaRbt12 & { __i: number }) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFaixas((atual) => atual.filter((_, idx) => idx !== f.__i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ),
              },
            ]}
            itens={faixas.map((f, i) => ({ ...f, __i: i }))}
            chaveLinha={(f) => String(f.__i)}
            vazio={<>Nenhuma faixa cadastrada.</>}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() =>
              setFaixas((atual) => [
                ...atual,
                { ateRbt12Centavos: null, aliquotaNominal: 0.06, parcelaDeduzirCentavos: 0 },
              ])
            }
            className="mt-2"
          >
            Adicionar faixa
          </Button>
        </div>
      )}

      {erro && (
        <div className="mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
          {erro}
        </div>
      )}

      <Button
        variant="accent"
        onClick={salvar}
        disabled={salvando}
        loading={salvando}
        className="mt-4"
      >
        {salvando ? "Salvando…" : "Salvar configuração"}
      </Button>
    </section>
  );
}
