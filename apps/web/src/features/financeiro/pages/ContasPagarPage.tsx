import { Button, ConfirmDialog, Modal as ModalPrimitivo } from "@sinergica/ui";
import { AlertCircle, Pencil, Plus, RefreshCw, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { listarCategorias } from "../application/categorias";
import { listarContas } from "../application/contas";
import {
  criarRecorrencia,
  desativarRecorrencia,
  editarRecorrencia,
  listarAgingPagaveis,
  listarRecorrencias,
} from "../application/contas-pagar";
import { baixarLancamento } from "../application/lancamentos";
import { LABEL_FAIXA, ORDEM_FAIXAS, agruparPorFaixa, ehAlerta } from "../domain/aging";
import type { PagavelAging } from "../domain/aging-pagaveis";
import type { CategoriaItem } from "../domain/categoria";
import type { ContaBancariaItem } from "../domain/conta-bancaria";
import { centavosParaReais, reaisParaCentavos } from "../domain/dinheiro";
import { totalMensalRecorrencias, validarRecorrencia } from "../domain/recorrencia-pagavel";
import type { RecorrenciaFormData, RecorrenciaItem } from "../domain/recorrencia-pagavel";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | {
      fase: "pronto";
      recorrencias: RecorrenciaItem[];
      pagaveis: PagavelAging[];
      categorias: CategoriaItem[];
      contas: ContaBancariaItem[];
    };

type Modal =
  | { modo: "novo"; recorrencia?: undefined }
  | { modo: "editar"; recorrencia: RecorrenciaItem }
  | null;

export function ContasPagarPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modal, setModal] = useState<Modal>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [recorrenciaParaDesativar, setRecorrenciaParaDesativar] = useState<RecorrenciaItem | null>(
    null,
  );

  const temLeitura = podeAcessar("financeiro", "leitura");
  const temEscrita = podeAcessar("financeiro", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [recorrencias, pagaveis, categorias, contas] = await Promise.all([
        listarRecorrencias(supabaseFinanceiroAdapter),
        listarAgingPagaveis(supabaseFinanceiroAdapter),
        listarCategorias(supabaseFinanceiroAdapter),
        listarContas(supabaseFinanceiroAdapter),
      ]);
      setEstado({ fase: "pronto", recorrencias, pagaveis, categorias, contas });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar contas a pagar.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: RecorrenciaFormData) {
    if (!user) return;
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editarRecorrencia(supabaseFinanceiroAdapter, {
        ...input,
        id: modal.recorrencia.id,
        userId: user.id,
      });
    } else {
      await criarRecorrencia(supabaseFinanceiroAdapter, { ...input, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function desativar() {
    if (!user || !recorrenciaParaDesativar) return;
    await desativarRecorrencia(supabaseFinanceiroAdapter, recorrenciaParaDesativar.id, user.id);
    await carregar();
  }

  async function baixar(pagavel: PagavelAging) {
    if (!user) return;
    try {
      setErroAcao(null);
      await baixarLancamento(supabaseFinanceiroAdapter, {
        id: pagavel.lancamentoId,
        dataPagamento: new Date().toISOString().slice(0, 10),
        userId: user.id,
      });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível dar baixa.");
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

  const { recorrencias, pagaveis, categorias, contas } = estado;
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c.nome]));
  const grupos = agruparPorFaixa(pagaveis);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-heading font-semibold text-ink">Contas a pagar</h3>
            <p className="mt-0.5 text-body text-ink-3">
              Despesas fixas (ativas): R$ {centavosParaReais(totalMensalRecorrencias(recorrencias))}
              /mês
            </p>
          </div>
          {temEscrita && (
            <Button
              variant="accent"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setModal({ modo: "novo" })}
            >
              Nova despesa fixa
            </Button>
          )}
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erroAcao}
          </div>
        )}
      </section>

      {recorrencias.length > 0 && (
        <div className="rounded-lg border border-line bg-card p-4">
          <h4 className="mb-3 text-body font-semibold text-ink">Despesas fixas cadastradas</h4>
          <div className="flex flex-col gap-2">
            {recorrencias.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2"
              >
                <div className="min-w-0">
                  <p
                    className={`truncate text-body ${r.ativo ? "text-ink-2" : "text-ink-3 line-through"}`}
                  >
                    {r.descricao} — {categoriaPorId.get(r.categoriaId) ?? "Categoria"}
                  </p>
                  <p className="text-caption text-ink-3">
                    R$ {centavosParaReais(r.valorCentavos)} · vence dia {r.diaVencimento}
                  </p>
                </div>
                {temEscrita && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setModal({ modo: "editar", recorrencia: r })}
                      className="text-ink-3 hover:text-ink"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {r.ativo && (
                      <button
                        type="button"
                        onClick={() => setRecorrenciaParaDesativar(r)}
                        className="text-ink-3 hover:text-danger"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {ORDEM_FAIXAS.map((faixa) => {
          const itens = grupos[faixa];
          if (itens.length === 0) return null;
          const total = itens.reduce((soma, i) => soma + i.valorCentavos, 0);
          return (
            <div key={faixa} className="rounded-lg border border-line bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-body font-semibold text-ink">
                  {ehAlerta(faixa) && <AlertCircle className="h-3.5 w-3.5 text-danger" />}
                  {LABEL_FAIXA[faixa]}
                  <span className="text-caption font-normal text-ink-3">({itens.length})</span>
                </h4>
                <span className="text-body font-semibold text-ink">
                  R$ {centavosParaReais(total)}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {itens.map((item) => (
                  <div
                    key={item.lancamentoId}
                    className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-body text-ink-2">
                        {categoriaPorId.get(item.categoriaId) ?? "Categoria"} —{" "}
                        {item.descricao ?? "Pagável"}
                      </p>
                      <p className="text-caption text-ink-3">
                        Vence {new Date(item.dataVencimento).toLocaleDateString("pt-BR")}
                        {item.diasAtraso > 0 && ` · ${item.diasAtraso}d de atraso`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-body font-semibold text-ink">
                        R$ {centavosParaReais(item.valorCentavos)}
                      </span>
                      {temEscrita && (
                        <button
                          type="button"
                          onClick={() => baixar(item)}
                          className="inline-flex items-center gap-1 text-caption font-semibold text-orange hover:text-orange-deep"
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          Pagar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {pagaveis.length === 0 && (
          <div className="rounded-lg border border-line bg-card px-5 py-10 text-center">
            <p className="text-body text-ink-3">Nenhuma conta a pagar prevista.</p>
          </div>
        )}
      </div>

      {modal && (
        <RecorrenciaModal
          recorrencia={modal.modo === "editar" ? modal.recorrencia : undefined}
          categorias={categorias}
          contas={contas}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}

      <ConfirmDialog
        open={recorrenciaParaDesativar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setRecorrenciaParaDesativar(null);
        }}
        titulo={`Desativar "${recorrenciaParaDesativar?.descricao}"`}
        descricao="A despesa fixa deixa de gerar novos lançamentos."
        rotuloConfirmar="Desativar"
        onConfirmar={desativar}
      />
    </div>
  );
}

function RecorrenciaModal({
  recorrencia,
  categorias,
  contas,
  onCancel,
  onSalvar,
}: {
  recorrencia?: RecorrenciaItem;
  categorias: CategoriaItem[];
  contas: ContaBancariaItem[];
  onCancel: () => void;
  onSalvar: (input: RecorrenciaFormData) => Promise<void>;
}) {
  const [descricao, setDescricao] = useState(recorrencia?.descricao ?? "");
  const [valor, setValor] = useState(
    recorrencia ? centavosParaReais(recorrencia.valorCentavos) : "",
  );
  const [diaVencimento, setDiaVencimento] = useState(recorrencia?.diaVencimento ?? 10);
  const [categoriaId, setCategoriaId] = useState(recorrencia?.categoriaId ?? "");
  const [contaId, setContaId] = useState(recorrencia?.contaId ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const categoriasSaida = categorias.filter((c) => c.tipo === "saida");

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      const validado = validarRecorrencia({
        descricao,
        valorCentavos: reaisParaCentavos(valor),
        diaVencimento,
        categoriaId,
        contaId: contaId || null,
      });
      await onSalvar(validado);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
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
      titulo={recorrencia ? "Editar despesa fixa" : "Nova despesa fixa"}
      tamanho="md"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Descrição *</span>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="input w-full"
            placeholder="Aluguel"
          />
        </label>
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
          <span className="mb-1 block text-caption font-semibold text-ink-3">
            Dia de vencimento (1-28) *
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
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Categoria *</span>
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="input w-full"
          >
            <option value="">Selecione…</option>
            {categoriasSaida.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
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
        {erro && (
          <div className="sm:col-span-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
          <Button variant="secondary" onClick={onCancel} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="accent" onClick={salvar} loading={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </ModalPrimitivo>
  );
}
