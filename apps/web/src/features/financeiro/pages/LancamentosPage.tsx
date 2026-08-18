import { Button, ConfirmDialog, DataTable, Modal as ModalPrimitivo } from "@sinergica/ui";
import {
  ClipboardList,
  Download,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { listarCategorias } from "../application/categorias";
import { listarContas } from "../application/contas";
import type { ClienteOpcao, FiltroLancamentos } from "../application/financeiro-gateway";
import {
  baixarLancamento,
  criarLancamento,
  editarLancamento,
  estornarBaixaLancamento,
  listarClientesOpcoes,
  listarLancamentos,
} from "../application/lancamentos";
import {
  anexarComprovante,
  corrigirLancamento,
  estornarLancamentoRealizado,
  urlAssinadaComprovante,
} from "../application/robustez";
import { categoriasRaiz, subcategoriasDe } from "../domain/categoria";
import type { CategoriaItem } from "../domain/categoria";
import type { ContaBancariaItem } from "../domain/conta-bancaria";
import { centavosParaReais, reaisParaCentavos } from "../domain/dinheiro";
import { gerarCsvLancamentos } from "../domain/exportacao";
import { estaConciliado, podeExcluirOuAlterarValor } from "../domain/lancamento";
import type {
  LancamentoFormData,
  LancamentoItem,
  LancamentoStatus,
  LancamentoTipo,
} from "../domain/lancamento";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | {
      fase: "pronto";
      lancamentos: LancamentoItem[];
      categorias: CategoriaItem[];
      contas: ContaBancariaItem[];
      clientes: ClienteOpcao[];
    };

type Modal =
  | { modo: "novo"; lancamento?: undefined }
  | { modo: "editar"; lancamento: LancamentoItem }
  | { modo: "baixa"; lancamento: LancamentoItem }
  | { modo: "corrigir"; lancamento: LancamentoItem }
  | null;

const FILTRO_VAZIO: FiltroLancamentos = {};

export function LancamentosPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [filtro, setFiltro] = useState<FiltroLancamentos>(FILTRO_VAZIO);
  const [modal, setModal] = useState<Modal>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [lancamentoParaEstornar, setLancamentoParaEstornar] = useState<LancamentoItem | null>(null);
  const [lancamentoParaExcluir, setLancamentoParaExcluir] = useState<LancamentoItem | null>(null);

  const temLeitura = podeAcessar("financeiro", "leitura");
  const temEscrita = podeAcessar("financeiro", "escrita");

  // Evita fechamento obsoleto: recarregarLancamentos nunca captura `estado`/`filtro` do momento em
  // que foi criada — sempre recebe o filtro atual por parâmetro e usa o updater funcional do
  // setState, então funciona corretamente mesmo chamada logo após uma mutação (criar/baixar/estornar).
  const carregarTudo = useCallback(async (filtroAtual: FiltroLancamentos) => {
    setEstado((atual) => (atual.fase === "pronto" ? atual : { fase: "carregando" }));
    try {
      const [lancamentos, categorias, contas, clientes] = await Promise.all([
        listarLancamentos(supabaseFinanceiroAdapter, filtroAtual),
        listarCategorias(supabaseFinanceiroAdapter),
        listarContas(supabaseFinanceiroAdapter),
        listarClientesOpcoes(supabaseFinanceiroAdapter),
      ]);
      setEstado({ fase: "pronto", lancamentos, categorias, contas, clientes });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar lançamentos.",
      });
    }
  }, []);

  const recarregarLancamentos = useCallback(async (filtroAtual: FiltroLancamentos) => {
    try {
      const lancamentos = await listarLancamentos(supabaseFinanceiroAdapter, filtroAtual);
      setEstado((atual) => (atual.fase === "pronto" ? { ...atual, lancamentos } : atual));
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Falha ao recarregar lançamentos.");
    }
  }, []);

  const primeiraCargaFeita = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: carregarTudo/recarregarLancamentos são useCallback([]), referência estável — incluir geraria loop sem mudar comportamento.
  useEffect(() => {
    if (permissoesCarregando || !temLeitura) return;
    if (!primeiraCargaFeita.current) {
      primeiraCargaFeita.current = true;
      carregarTudo(filtro);
    } else {
      recarregarLancamentos(filtro);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissoesCarregando, temLeitura, filtro]);

  const totais = useMemo(() => {
    if (estado.fase !== "pronto") return { entradas: 0, saidas: 0, resultado: 0 };
    let entradas = 0;
    let saidas = 0;
    for (const l of estado.lancamentos) {
      if (l.tipo === "entrada") entradas += l.valorCentavos;
      else saidas += l.valorCentavos;
    }
    return { entradas, saidas, resultado: entradas - saidas };
  }, [estado]);

  async function salvar(input: LancamentoFormData) {
    if (!user) return;
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editarLancamento(supabaseFinanceiroAdapter, {
        ...input,
        id: modal.lancamento.id,
        userId: user.id,
      });
    } else {
      await criarLancamento(supabaseFinanceiroAdapter, { ...input, userId: user.id });
    }
    setModal(null);
    await recarregarLancamentos(filtro);
  }

  async function darBaixa(lancamento: LancamentoItem, dataPagamento: string) {
    if (!user) return;
    try {
      setErroAcao(null);
      await baixarLancamento(supabaseFinanceiroAdapter, {
        id: lancamento.id,
        dataPagamento,
        userId: user.id,
      });
      setModal(null);
      await recarregarLancamentos(filtro);
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível dar baixa.");
    }
  }

  async function estornar() {
    if (!user || !lancamentoParaEstornar) return;
    await estornarBaixaLancamento(supabaseFinanceiroAdapter, {
      id: lancamentoParaEstornar.id,
      userId: user.id,
    });
    await recarregarLancamentos(filtro);
  }

  async function corrigir(
    lancamento: LancamentoItem,
    dados: { valorCentavos: number; categoriaId: string; dataCompetencia: string },
  ) {
    if (!user) return;
    await corrigirLancamento(supabaseFinanceiroAdapter, {
      ...lancamento,
      id: lancamento.id,
      userId: user.id,
      valorCentavos: dados.valorCentavos,
      categoriaId: dados.categoriaId,
      dataCompetencia: dados.dataCompetencia,
    });
    setModal(null);
    await recarregarLancamentos(filtro);
  }

  async function excluirRealizado() {
    if (!user || !lancamentoParaExcluir) return;
    await estornarLancamentoRealizado(supabaseFinanceiroAdapter, lancamentoParaExcluir.id, user.id);
    await recarregarLancamentos(filtro);
  }

  const [anexandoId, setAnexandoId] = useState<string | null>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const lancamentoParaAnexoRef = useRef<string | null>(null);

  function abrirSeletorComprovante(lancamentoId: string) {
    lancamentoParaAnexoRef.current = lancamentoId;
    inputArquivoRef.current?.click();
  }

  async function onArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    const lancamentoId = lancamentoParaAnexoRef.current;
    e.target.value = "";
    if (!arquivo || !lancamentoId) return;
    try {
      setErroAcao(null);
      setAnexandoId(lancamentoId);
      await anexarComprovante(supabaseFinanceiroAdapter, lancamentoId, arquivo);
      await recarregarLancamentos(filtro);
    } catch (error) {
      setErroAcao(
        error instanceof Error ? error.message : "Não foi possível anexar o comprovante.",
      );
    } finally {
      setAnexandoId(null);
    }
  }

  function exportarCsv() {
    if (estado.fase !== "pronto") return;
    const csv = gerarCsvLancamentos(estado.lancamentos, {
      categoriaPorId: new Map(estado.categorias.map((c) => [c.id, c.nome])),
      contaPorId: new Map(estado.contas.map((c) => [c.id, c.nome])),
      clientePorId: new Map(estado.clientes.map((c) => [c.id, c.nome])),
    });
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lancamentos-financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function verComprovante(path: string) {
    try {
      const url = await urlAssinadaComprovante(supabaseFinanceiroAdapter, path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível abrir o comprovante.");
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
          onClick={() => carregarTudo(filtro)}
          className="mt-4"
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  const { lancamentos, categorias, contas, clientes } = estado;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-heading font-semibold text-ink">Lançamentos</h1>
            <p className="mt-0.5 text-body text-ink-3">
              Entradas e saídas — ciclo previsto → realizado.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={exportarCsv}
            >
              Exportar CSV
            </Button>
            {temEscrita && (
              <Button
                variant="accent"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setModal({ modo: "novo" })}
              >
                Novo lançamento
              </Button>
            )}
          </div>
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erroAcao}
          </div>
        )}

        <FiltrosBar
          filtro={filtro}
          onChange={setFiltro}
          categorias={categorias}
          contas={contas}
          clientes={clientes}
        />
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Totalizador label="Entradas" valorCentavos={totais.entradas} tom="positivo" />
        <Totalizador label="Saídas" valorCentavos={totais.saidas} tom="negativo" />
        <Totalizador
          label="Resultado do filtro"
          valorCentavos={totais.resultado}
          tom={totais.resultado >= 0 ? "positivo" : "negativo"}
        />
      </div>

      {lancamentos.length === 0 ? (
        <div className="rounded-lg border border-line bg-card px-5 py-10 text-center">
          <ClipboardList className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-body text-ink-3">
            Nenhum lançamento encontrado para este filtro.
          </p>
        </div>
      ) : (
        <DataTable
          colunas={[
            {
              chave: "competencia",
              cabecalho: "Competência",
              render: (lancamento) =>
                new Date(lancamento.dataCompetencia).toLocaleDateString("pt-BR", {
                  month: "2-digit",
                  year: "numeric",
                }),
            },
            {
              chave: "tipo",
              cabecalho: "Tipo",
              render: (lancamento) => (
                <span
                  className={`rounded-full px-2 py-0.5 text-micro font-semibold ${lancamento.tipo === "entrada" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
                >
                  {lancamento.tipo === "entrada" ? "Entrada" : "Saída"}
                </span>
              ),
            },
            {
              chave: "categoria",
              cabecalho: "Categoria",
              render: (lancamento) =>
                categorias.find((c) => c.id === lancamento.categoriaId)?.nome ?? "—",
            },
            {
              chave: "descricao",
              cabecalho: "Descrição",
              render: (lancamento) => (
                <span className="block max-w-[240px] truncate">{lancamento.descricao ?? "—"}</span>
              ),
            },
            {
              chave: "valor",
              cabecalho: "Valor",
              numerica: true,
              render: (lancamento) => (
                <span className="font-semibold text-ink">
                  R$ {centavosParaReais(lancamento.valorCentavos)}
                </span>
              ),
            },
            {
              chave: "status",
              cabecalho: "Status",
              render: (lancamento) => <StatusBadge lancamento={lancamento} />,
            },
            {
              chave: "acoes",
              cabecalho: "Ações",
              render: (lancamento) => (
                <div className="flex flex-wrap justify-end gap-2">
                  {temEscrita &&
                    lancamento.status === "previsto" &&
                    podeExcluirOuAlterarValor(lancamento) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setModal({ modo: "editar", lancamento })}
                      >
                        Editar
                      </Button>
                    )}
                  {temEscrita && lancamento.status === "previsto" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Wallet className="h-3.5 w-3.5" />}
                      onClick={() => setModal({ modo: "baixa", lancamento })}
                    >
                      Dar baixa
                    </Button>
                  )}
                  {temEscrita &&
                    lancamento.status === "realizado" &&
                    !estaConciliado(lancamento) && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setModal({ modo: "corrigir", lancamento })}
                        >
                          Corrigir
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<RotateCcw className="h-3.5 w-3.5" />}
                          onClick={() => setLancamentoParaEstornar(lancamento)}
                        >
                          Estornar baixa
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="h-3.5 w-3.5 text-danger" />}
                          onClick={() => setLancamentoParaExcluir(lancamento)}
                        >
                          Excluir
                        </Button>
                      </>
                    )}
                  {temEscrita &&
                    lancamento.status === "realizado" &&
                    !lancamento.comprovantePath && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Paperclip className="h-3.5 w-3.5" />}
                        onClick={() => abrirSeletorComprovante(lancamento.id)}
                        disabled={anexandoId === lancamento.id}
                        loading={anexandoId === lancamento.id}
                      >
                        Anexar comprovante
                      </Button>
                    )}
                  {lancamento.comprovantePath && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Paperclip className="h-3.5 w-3.5" />}
                      onClick={() => verComprovante(lancamento.comprovantePath as string)}
                    >
                      Ver comprovante
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
          itens={lancamentos}
          chaveLinha={(lancamento) => lancamento.id}
          vazio={<>Nenhum lançamento encontrado para este filtro.</>}
        />
      )}

      {(modal?.modo === "novo" || modal?.modo === "editar") && (
        <LancamentoModal
          lancamento={modal.modo === "editar" ? modal.lancamento : undefined}
          categorias={categorias}
          contas={contas}
          clientes={clientes}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}

      {modal?.modo === "baixa" && (
        <BaixaModal
          lancamento={modal.lancamento}
          onCancel={() => setModal(null)}
          onConfirmar={darBaixa}
        />
      )}

      {modal?.modo === "corrigir" && (
        <CorrigirModal
          lancamento={modal.lancamento}
          categorias={categorias}
          onCancel={() => setModal(null)}
          onSalvar={corrigir}
        />
      )}

      <input
        ref={inputArquivoRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={onArquivoSelecionado}
      />

      <ConfirmDialog
        open={lancamentoParaEstornar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setLancamentoParaEstornar(null);
        }}
        titulo="Estornar a baixa"
        descricao={`"${lancamentoParaEstornar?.descricao ?? "Este lançamento"}" volta a previsto.`}
        rotuloConfirmar="Estornar"
        onConfirmar={estornar}
      />

      <ConfirmDialog
        open={lancamentoParaExcluir !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setLancamentoParaExcluir(null);
        }}
        titulo="Excluir lançamento realizado"
        descricao={`"${lancamentoParaExcluir?.descricao ?? "Este lançamento"}" — a ação fica registrada em auditoria e não pode ser desfeita.`}
        rotuloConfirmar="Excluir"
        onConfirmar={excluirRealizado}
      />
    </div>
  );
}

function StatusBadge({ lancamento }: { lancamento: LancamentoItem }) {
  if (lancamento.status === "previsto") {
    return (
      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-micro font-semibold text-warning">
        Previsto
      </span>
    );
  }
  if (estaConciliado(lancamento)) {
    return (
      <span className="rounded-full bg-info-soft px-2 py-0.5 text-micro font-semibold text-info">
        Conciliado
      </span>
    );
  }
  return (
    <span className="rounded-full bg-success-soft px-2 py-0.5 text-micro font-semibold text-success">
      Realizado
    </span>
  );
}

function Totalizador({
  label,
  valorCentavos,
  tom,
}: { label: string; valorCentavos: number; tom: "positivo" | "negativo" }) {
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <p className="text-caption font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <p
        className={`mt-1 text-title font-semibold ${tom === "positivo" ? "text-success" : "text-danger"}`}
      >
        R$ {centavosParaReais(Math.abs(valorCentavos))}
      </p>
    </div>
  );
}

function FiltrosBar({
  filtro,
  onChange,
  categorias,
  contas,
  clientes,
}: {
  filtro: FiltroLancamentos;
  onChange: (filtro: FiltroLancamentos) => void;
  categorias: CategoriaItem[];
  contas: ContaBancariaItem[];
  clientes: ClienteOpcao[];
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <label className="block">
        <span className="mb-1 block text-micro font-semibold text-ink-3">De</span>
        <input
          type="date"
          value={filtro.competenciaInicio ?? ""}
          onChange={(e) => onChange({ ...filtro, competenciaInicio: e.target.value || undefined })}
          className="input w-full"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-micro font-semibold text-ink-3">Até</span>
        <input
          type="date"
          value={filtro.competenciaFim ?? ""}
          onChange={(e) => onChange({ ...filtro, competenciaFim: e.target.value || undefined })}
          className="input w-full"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-micro font-semibold text-ink-3">Tipo</span>
        <select
          value={filtro.tipo ?? ""}
          onChange={(e) =>
            onChange({
              ...filtro,
              tipo: (e.target.value || undefined) as LancamentoTipo | undefined,
            })
          }
          className="input w-full"
        >
          <option value="">Todos</option>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-micro font-semibold text-ink-3">Status</span>
        <select
          value={filtro.status ?? ""}
          onChange={(e) =>
            onChange({
              ...filtro,
              status: (e.target.value || undefined) as LancamentoStatus | undefined,
            })
          }
          className="input w-full"
        >
          <option value="">Todos</option>
          <option value="previsto">Previsto</option>
          <option value="realizado">Realizado</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-micro font-semibold text-ink-3">Categoria</span>
        <select
          value={filtro.categoriaId ?? ""}
          onChange={(e) => onChange({ ...filtro, categoriaId: e.target.value || undefined })}
          className="input w-full"
        >
          <option value="">Todas</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-micro font-semibold text-ink-3">Conta</span>
        <select
          value={filtro.contaId ?? ""}
          onChange={(e) => onChange({ ...filtro, contaId: e.target.value || undefined })}
          className="input w-full"
        >
          <option value="">Todas</option>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-2 lg:col-span-2">
        <span className="mb-1 block text-micro font-semibold text-ink-3">Cliente</span>
        <select
          value={filtro.clienteId ?? ""}
          onChange={(e) => onChange({ ...filtro, clienteId: e.target.value || undefined })}
          className="input w-full"
        >
          <option value="">Todos</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      {(filtro.competenciaInicio ||
        filtro.competenciaFim ||
        filtro.tipo ||
        filtro.status ||
        filtro.categoriaId ||
        filtro.contaId ||
        filtro.clienteId) && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="self-end text-caption font-semibold text-ink-3 hover:text-ink"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}

function LancamentoModal({
  lancamento,
  categorias,
  contas,
  clientes,
  onCancel,
  onSalvar,
}: {
  lancamento?: LancamentoItem;
  categorias: CategoriaItem[];
  contas: ContaBancariaItem[];
  clientes: ClienteOpcao[];
  onCancel: () => void;
  onSalvar: (input: LancamentoFormData) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<LancamentoTipo>(lancamento?.tipo ?? "saida");
  const [status, setStatus] = useState<LancamentoStatus>(lancamento?.status ?? "realizado");
  const [valor, setValor] = useState(lancamento ? centavosParaReais(lancamento.valorCentavos) : "");
  const [dataCompetencia, setDataCompetencia] = useState(
    lancamento?.dataCompetencia ?? new Date().toISOString().slice(0, 10),
  );
  const [dataVencimento, setDataVencimento] = useState(lancamento?.dataVencimento ?? "");
  const [dataPagamento, setDataPagamento] = useState(
    lancamento?.dataPagamento ?? new Date().toISOString().slice(0, 10),
  );
  const [categoriaId, setCategoriaId] = useState(lancamento?.categoriaId ?? "");
  const [contaId, setContaId] = useState(lancamento?.contaId ?? "");
  const [clienteId, setClienteId] = useState(lancamento?.clienteId ?? "");
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeAlterarValor = !lancamento || podeExcluirOuAlterarValor(lancamento);
  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo);
  const raizesDoTipo = categoriasRaiz(categoriasDoTipo);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({
        tipo,
        status,
        valorCentavos: reaisParaCentavos(valor),
        dataCompetencia,
        dataVencimento: status === "previsto" ? dataVencimento : null,
        dataPagamento: status === "realizado" ? dataPagamento : null,
        categoriaId,
        contaId: contaId || null,
        clienteId: clienteId || null,
        descricao,
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar lançamento.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalPrimitivo
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo={lancamento ? "Editar lançamento" : "Novo lançamento"}
      tamanho="lg"
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Tipo *</span>
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as LancamentoTipo);
                setCategoriaId("");
              }}
              className="input w-full"
            >
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Valor *</span>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              disabled={!podeAlterarValor}
              className="input w-full disabled:opacity-60"
              placeholder="0,00"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Competência *</span>
            <input
              type="date"
              value={dataCompetencia}
              onChange={(e) => setDataCompetencia(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Status *</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LancamentoStatus)}
              className="input w-full"
            >
              <option value="previsto">Previsto</option>
              <option value="realizado">Realizado</option>
            </select>
          </label>
          {status === "previsto" && (
            <label className="block">
              <span className="mb-1 block text-caption font-semibold text-ink-3">Vencimento *</span>
              <input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="input w-full"
              />
            </label>
          )}
          {status === "realizado" && (
            <label className="block">
              <span className="mb-1 block text-caption font-semibold text-ink-3">Pagamento *</span>
              <input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="input w-full"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Categoria *</span>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="input w-full"
            >
              <option value="">Selecione…</option>
              {raizesDoTipo.map((raiz) => (
                <optgroup key={raiz.id} label={raiz.nome}>
                  <option value={raiz.id}>{raiz.nome}</option>
                  {subcategoriasDe(categoriasDoTipo, raiz.id).map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {"↳ "}
                      {sub.nome}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Conta</span>
            <select
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              className="input w-full"
            >
              <option value="">Ainda não sei</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Cliente</span>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="input w-full"
            >
              <option value="">Nenhum</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Descrição</span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="input min-h-[72px] w-full resize-y"
            />
          </label>
          {erro && (
            <div className="sm:col-span-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
          <Button variant="secondary" onClick={onCancel} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={salvar}
            disabled={salvando || !categoriaId}
            loading={salvando}
          >
            Salvar
          </Button>
        </div>
      </div>
    </ModalPrimitivo>
  );
}

function BaixaModal({
  lancamento,
  onCancel,
  onConfirmar,
}: {
  lancamento: LancamentoItem;
  onCancel: () => void;
  onConfirmar: (lancamento: LancamentoItem, dataPagamento: string) => Promise<void>;
}) {
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [confirmando, setConfirmando] = useState(false);

  async function confirmar() {
    setConfirmando(true);
    await onConfirmar(lancamento, dataPagamento);
    setConfirmando(false);
  }

  return (
    <ModalPrimitivo
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo="Dar baixa"
      tamanho="sm"
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-body text-ink-2">
            R$ {centavosParaReais(lancamento.valorCentavos)} — confirme a data de pagamento.
          </p>
          <label className="mt-3 block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">
              Data de pagamento *
            </span>
            <input
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              className="input w-full"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
          <Button variant="secondary" onClick={onCancel} disabled={confirmando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={confirmar}
            disabled={confirmando}
            loading={confirmando}
          >
            Confirmar baixa
          </Button>
        </div>
      </div>
    </ModalPrimitivo>
  );
}

function CorrigirModal({
  lancamento,
  categorias,
  onCancel,
  onSalvar,
}: {
  lancamento: LancamentoItem;
  categorias: CategoriaItem[];
  onCancel: () => void;
  onSalvar: (
    lancamento: LancamentoItem,
    dados: { valorCentavos: number; categoriaId: string; dataCompetencia: string },
  ) => Promise<void>;
}) {
  const [valor, setValor] = useState(centavosParaReais(lancamento.valorCentavos));
  const [categoriaId, setCategoriaId] = useState(lancamento.categoriaId);
  const [dataCompetencia, setDataCompetencia] = useState(lancamento.dataCompetencia);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const categoriasDoTipo = categorias.filter((c) => c.tipo === lancamento.tipo);
  const raizesDoTipo = categoriasRaiz(categoriasDoTipo);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      const valorCentavos = reaisParaCentavos(valor);
      if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) {
        throw new Error("Valor deve ser maior que zero.");
      }
      await onSalvar(lancamento, { valorCentavos, categoriaId, dataCompetencia });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível corrigir o lançamento.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalPrimitivo
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo="Corrigir lançamento realizado"
      tamanho="sm"
    >
      <div className="flex flex-col gap-4">
        <p className="text-caption text-ink-3">
          A correção fica registrada em auditoria (valor anterior/novo por campo alterado).
        </p>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Valor *</span>
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="input w-full"
            placeholder="0,00"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Competência *</span>
          <input
            type="date"
            value={dataCompetencia}
            onChange={(e) => setDataCompetencia(e.target.value)}
            className="input w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Categoria *</span>
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="input w-full"
          >
            {raizesDoTipo.map((raiz) => (
              <optgroup key={raiz.id} label={raiz.nome}>
                <option value={raiz.id}>{raiz.nome}</option>
                {subcategoriasDe(categoriasDoTipo, raiz.id).map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {"↳ "}
                    {sub.nome}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {erro && (
          <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={salvando}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={salvar} disabled={salvando} loading={salvando}>
          Salvar correção
        </Button>
      </div>
    </ModalPrimitivo>
  );
}
