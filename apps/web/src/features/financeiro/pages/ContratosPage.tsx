import { AlertTriangle, FileText, Pencil, Plus, RefreshCw, Wand2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  criarContrato,
  editarContrato,
  gerarRecorrencias,
  listarContratos,
} from "../application/contratos";
import type { ClienteOpcao } from "../application/financeiro-gateway";
import { listarClientesOpcoes } from "../application/lancamentos";
import type { ContratoFormData, ContratoItem, ContratoStatus } from "../domain/contrato";
import { receitaMensalPrevista } from "../domain/contrato";
import { centavosParaReais, reaisParaCentavos } from "../domain/dinheiro";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; contratos: ContratoItem[]; clientes: ClienteOpcao[] };

type Modal =
  | { modo: "novo"; contrato?: undefined }
  | { modo: "editar"; contrato: ContratoItem }
  | null;

function competenciaAtualIso(): string {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
}

export function ContratosPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modal, setModal] = useState<Modal>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [mensagemGeracao, setMensagemGeracao] = useState<string | null>(null);

  const temLeitura = podeAcessar("financeiro", "leitura");
  const temEscrita = podeAcessar("financeiro", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [contratos, clientes] = await Promise.all([
        listarContratos(supabaseFinanceiroAdapter),
        listarClientesOpcoes(supabaseFinanceiroAdapter),
      ]);
      setEstado({ fase: "pronto", contratos, clientes });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar contratos.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: ContratoFormData) {
    if (!user) return;
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editarContrato(supabaseFinanceiroAdapter, {
        ...input,
        id: modal.contrato.id,
        userId: user.id,
      });
    } else {
      await criarContrato(supabaseFinanceiroAdapter, { ...input, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function gerarPrevistosDoMes() {
    setGerando(true);
    setMensagemGeracao(null);
    try {
      const criados = await gerarRecorrencias(supabaseFinanceiroAdapter, competenciaAtualIso());
      setMensagemGeracao(
        criados > 0
          ? `${criados} recebível(is) gerado(s) para este mês.`
          : "Nenhum recebível novo — já gerado ou sem contrato vigente.",
      );
    } catch (error) {
      setMensagemGeracao(error instanceof Error ? error.message : "Falha ao gerar recebíveis.");
    } finally {
      setGerando(false);
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

  const { contratos, clientes } = estado;
  const clientePorId = new Map(clientes.map((c) => [c.id, c.nome]));

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">Contratos</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Receita mensal prevista (ativos): R${" "}
              {centavosParaReais(receitaMensalPrevista(contratos))}
            </p>
          </div>
          <div className="flex gap-2">
            {temEscrita && (
              <button
                type="button"
                onClick={gerarPrevistosDoMes}
                disabled={gerando}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-line-soft disabled:opacity-50"
              >
                <Wand2 className="h-4 w-4" />
                {gerando ? "Gerando..." : "Gerar previstos do mês"}
              </button>
            )}
            {temEscrita && (
              <button
                type="button"
                onClick={() => setModal({ modo: "novo" })}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
              >
                <Plus className="h-4 w-4" />
                Novo contrato
              </button>
            )}
          </div>
        </div>
        {mensagemGeracao && <p className="mt-3 text-sm text-ink-3">{mensagemGeracao}</p>}
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {contratos.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <FileText className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhum contrato cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {contratos.map((contrato) => (
            <div key={contrato.id} className="rounded-[8px] border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold text-ink">
                    {clientePorId.get(contrato.clienteId) ?? "Cliente"}
                  </h4>
                  <p className="mt-1 text-xs text-ink-3">
                    R$ {centavosParaReais(contrato.valorMensalCentavos)}/mês · vence dia{" "}
                    {contrato.diaVencimento}
                  </p>
                </div>
                <StatusBadge status={contrato.status} />
              </div>
              {contrato.descricao && (
                <p className="mt-3 text-sm text-ink-3">{contrato.descricao}</p>
              )}
              {contrato.bloqueiaOsEmAtraso && (
                <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#9A6B00]">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Bloqueia OS em atraso (aviso — sem enforcement no PCM)
                </p>
              )}
              <div className="mt-4 flex justify-end">
                {temEscrita && (
                  <button
                    type="button"
                    onClick={() => setModal({ modo: "editar", contrato })}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border border-line px-3 text-xs font-semibold text-ink-2 hover:bg-line-soft"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ContratoModal
          contrato={modal.modo === "editar" ? modal.contrato : undefined}
          clientes={clientes}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ContratoStatus }) {
  const estilos: Record<ContratoStatus, string> = {
    ativo: "bg-[#E7F6EC] text-[#1E8E45]",
    suspenso: "bg-[#FFF6E5] text-[#9A6B00]",
    encerrado: "bg-[#EFF1F4] text-[#5A6175]",
  };
  const rotulos: Record<ContratoStatus, string> = {
    ativo: "Ativo",
    suspenso: "Suspenso",
    encerrado: "Encerrado",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${estilos[status]}`}>
      {rotulos[status]}
    </span>
  );
}

function ContratoModal({
  contrato,
  clientes,
  onCancel,
  onSalvar,
}: {
  contrato?: ContratoItem;
  clientes: ClienteOpcao[];
  onCancel: () => void;
  onSalvar: (input: ContratoFormData) => Promise<void>;
}) {
  const [clienteId, setClienteId] = useState(contrato?.clienteId ?? "");
  const [descricao, setDescricao] = useState(contrato?.descricao ?? "");
  const [valor, setValor] = useState(
    contrato ? centavosParaReais(contrato.valorMensalCentavos) : "",
  );
  const [diaVencimento, setDiaVencimento] = useState(contrato?.diaVencimento ?? 10);
  const [inicio, setInicio] = useState(contrato?.inicio ?? new Date().toISOString().slice(0, 10));
  const [fim, setFim] = useState(contrato?.fim ?? "");
  const [status, setStatus] = useState<ContratoStatus>(contrato?.status ?? "ativo");
  const [bloqueia, setBloqueia] = useState(contrato?.bloqueiaOsEmAtraso ?? false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({
        clienteId,
        descricao,
        valorMensalCentavos: reaisParaCentavos(valor),
        diaVencimento,
        inicio,
        fim: fim || null,
        status,
        bloqueiaOsEmAtraso: bloqueia,
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar contrato.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-2xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">
            {contrato ? "Editar contrato" : "Novo contrato"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Cliente *</span>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="input w-full"
            >
              <option value="">Selecione...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Valor mensal *</span>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="input w-full"
              placeholder="0,00"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">
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
            <span className="mb-1 block text-xs font-semibold text-ink-3">Início *</span>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Fim (opcional)</span>
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Status *</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ContratoStatus)}
              className="input w-full"
            >
              <option value="ativo">Ativo</option>
              <option value="suspenso">Suspenso</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={bloqueia}
              onChange={(e) => setBloqueia(e.target.checked)}
            />
            Bloqueia OS em atraso (aviso visual)
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Descrição</span>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="input w-full"
            />
          </label>
          {erro && (
            <div className="sm:col-span-2 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-[6px] border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !clienteId}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
