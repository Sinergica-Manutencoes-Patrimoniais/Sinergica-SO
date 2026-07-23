import {
  ChevronDown,
  ChevronUp,
  History,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  cancelarReservaFerramenta,
  criarReservaFerramenta,
  efetivarReservaFerramenta,
  listarReservasFerramenta,
} from "../application/ferramenta-reservas";
import {
  baixarUnidadeFerramenta,
  gerarUnidadesFerramenta,
  listarHistoricoUnidade,
  listarUnidadesFerramenta,
} from "../application/ferramenta-unidades";
import {
  criarFerramenta,
  desativarFerramenta,
  editarFerramenta,
  listarCategoriasFerramenta,
  listarFerramentas,
} from "../application/ferramentas";
import { HistoricoMovimentacoesModal } from "../components/HistoricoMovimentacoesModal";
import { KitsSection } from "../components/KitsSection";
import { type FerramentaReservaItem, ordenarAgendaReservas } from "../domain/ferramenta-reservas";
import {
  type FerramentaUnidadeItem,
  type MovimentacaoFerramentaItem,
  rotuloStatusUnidade,
} from "../domain/ferramenta-unidades";
import { validarFerramentaInline } from "../domain/ferramentas";
import type {
  FerramentaCategoriaOpcao,
  FerramentaFormData,
  FerramentaItem,
  FuncionarioFerramentaOpcao,
} from "../domain/ferramentas";
import { supabaseFerramentaReservasAdapter } from "../infrastructure/supabase-ferramenta-reservas-adapter";
import { supabaseFerramentaUnidadesAdapter } from "../infrastructure/supabase-ferramenta-unidades-adapter";
import { supabaseFerramentasAdapter } from "../infrastructure/supabase-ferramentas-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | {
      fase: "pronto";
      ferramentas: FerramentaItem[];
      categorias: FerramentaCategoriaOpcao[];
      unidades: FerramentaUnidadeItem[];
      funcionarios: FuncionarioFerramentaOpcao[];
      reservas: FerramentaReservaItem[];
    };

type Modal =
  | { modo: "novo"; ferramenta?: undefined }
  | { modo: "editar"; ferramenta: FerramentaItem }
  | null;

export function FerramentasPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modal, setModal] = useState<Modal>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<FerramentaUnidadeItem | null>(null);
  // E01-S75 AC-1: histórico de posse por unidade — "quem ficou com FER-0003 quando quebrou".
  const [historicoUnidade, setHistoricoUnidade] = useState<{
    codigo: string;
    itens: MovimentacaoFerramentaItem[];
  } | null>(null);
  const [reservaForm, setReservaForm] = useState({
    ferramentaId: "",
    unidadeId: "",
    funcionarioId: "",
    dataInicio: "",
    dataFim: "",
  });
  const [salvandoReserva, setSalvandoReserva] = useState(false);
  const [efetivando, setEfetivando] = useState<FerramentaReservaItem | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [ferramentas, categorias, unidades, funcionarios, reservas] = await Promise.all([
        listarFerramentas(supabaseFerramentasAdapter),
        listarCategoriasFerramenta(supabaseFerramentasAdapter),
        listarUnidadesFerramenta(supabaseFerramentaUnidadesAdapter),
        supabaseFerramentasAdapter.listarFuncionarios(),
        listarReservasFerramenta(supabaseFerramentaReservasAdapter),
      ]);
      setEstado({ fase: "pronto", ferramentas, categorias, unidades, funcionarios, reservas });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar ferramentas.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: FerramentaFormData) {
    if (!user) return;
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editarFerramenta(supabaseFerramentasAdapter, {
        ...input,
        id: modal.ferramenta.id,
        userId: user.id,
      });
    } else {
      await criarFerramenta(supabaseFerramentasAdapter, { ...input, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function desativar(ferramenta: FerramentaItem) {
    if (!user || !confirm(`Desativar ${ferramenta.nome}?`)) return;
    try {
      setErroAcao(null);
      await desativarFerramenta(supabaseFerramentasAdapter, { id: ferramenta.id, userId: user.id });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível desativar.");
    }
  }

  async function gerarUnidades(ferramenta: FerramentaItem, quantidade: number) {
    if (!user) return;
    try {
      setErroAcao(null);
      await gerarUnidadesFerramenta(supabaseFerramentaUnidadesAdapter, {
        ferramentaId: ferramenta.id,
        quantidade,
        userId: user.id,
      });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível gerar unidades.");
    }
  }

  async function verHistoricoUnidade(unidade: FerramentaUnidadeItem) {
    try {
      const itens = await listarHistoricoUnidade(supabaseFerramentaUnidadesAdapter, unidade.id);
      setHistoricoUnidade({ codigo: unidade.codigo, itens });
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível carregar histórico.");
    }
  }

  async function confirmarBaixa(motivo: string) {
    if (!user || !baixando) return;
    await baixarUnidadeFerramenta(supabaseFerramentaUnidadesAdapter, {
      unidadeId: baixando.id,
      motivo,
      userId: user.id,
    });
    setBaixando(null);
    await carregar();
  }

  async function criarReserva() {
    if (!user) return;
    try {
      setSalvandoReserva(true);
      setErroAcao(null);
      await criarReservaFerramenta(
        supabaseFerramentaReservasAdapter,
        supabaseFerramentaUnidadesAdapter,
        {
          ferramentaId: reservaForm.ferramentaId,
          unidadeId: reservaForm.unidadeId || null,
          funcionarioId: reservaForm.funcionarioId,
          dataInicio: reservaForm.dataInicio,
          dataFim: reservaForm.dataFim || null,
          userId: user.id,
        },
      );
      setReservaForm({
        ferramentaId: "",
        unidadeId: "",
        funcionarioId: "",
        dataInicio: "",
        dataFim: "",
      });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível criar a reserva.");
    } finally {
      setSalvandoReserva(false);
    }
  }

  async function cancelarReserva(reserva: FerramentaReservaItem) {
    if (!user || !confirm(`Cancelar a reserva de ${reserva.funcionarioNome}?`)) return;
    try {
      setErroAcao(null);
      await cancelarReservaFerramenta(supabaseFerramentaReservasAdapter, {
        reservaId: reserva.id,
        userId: user.id,
      });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível cancelar a reserva.");
    }
  }

  async function confirmarEfetivar(unidadeId: string) {
    if (!user || !efetivando) return;
    await efetivarReservaFerramenta(
      supabaseFerramentaReservasAdapter,
      supabaseFerramentaUnidadesAdapter,
      {
        reservaId: efetivando.id,
        unidadeId,
        userId: user.id,
      },
    );
    setEfetivando(null);
    await carregar();
  }

  if (permissoesCarregando || estado.fase === "carregando")
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">Você não tem permissão de leitura no módulo PCM.</p>
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

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">Ferramentas</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Produtos Auvo tratados como ferramentas e kits operacionais
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModal({ modo: "novo" })}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
            >
              <Plus className="h-4 w-4" />
              Nova ferramenta
            </button>
          )}
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {estado.ferramentas.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <Wrench className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhuma ferramenta cadastrada.</p>
        </div>
      ) : (
        <section className="rounded-[8px] border border-line bg-card overflow-hidden">
          <div className="divide-y divide-line-soft">
            {estado.ferramentas.map((ferramenta) => (
              <FerramentaLinha
                key={ferramenta.id}
                ferramenta={ferramenta}
                unidades={estado.unidades.filter((u) => u.ferramentaId === ferramenta.id)}
                expandida={expandida === ferramenta.id}
                onToggleExpandir={() =>
                  setExpandida((atual) => (atual === ferramenta.id ? null : ferramenta.id))
                }
                onEditar={temEscrita ? () => setModal({ modo: "editar", ferramenta }) : undefined}
                onDesativar={
                  temEscrita && ferramenta.ativo ? () => desativar(ferramenta) : undefined
                }
                onGerarUnidades={
                  temEscrita
                    ? (quantidade: number) => gerarUnidades(ferramenta, quantidade)
                    : undefined
                }
                onBaixarUnidade={temEscrita ? (unidade) => setBaixando(unidade) : undefined}
                onVerHistorico={verHistoricoUnidade}
              />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <h3 className="text-base font-semibold text-ink">Reservas</h3>
        <p className="mt-0.5 text-sm text-ink-3">
          Reserva uma unidade (ou "qualquer disponível") pra um técnico num período — sem mover a
          ferramenta ainda
        </p>
        {temEscrita && (
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(160px,1fr)_minmax(140px,1fr)_minmax(160px,1fr)_120px_120px_auto]">
            <select
              value={reservaForm.ferramentaId}
              onChange={(event) =>
                setReservaForm((a) => ({ ...a, ferramentaId: event.target.value, unidadeId: "" }))
              }
              className="input h-9"
            >
              <option value="">Ferramenta</option>
              {estado.ferramentas.map((ferramenta) => (
                <option key={ferramenta.id} value={ferramenta.id}>
                  {ferramenta.nome}
                </option>
              ))}
            </select>
            <select
              value={reservaForm.unidadeId}
              onChange={(event) => setReservaForm((a) => ({ ...a, unidadeId: event.target.value }))}
              disabled={!reservaForm.ferramentaId}
              className="input h-9"
            >
              <option value="">Qualquer disponível</option>
              {estado.unidades
                .filter(
                  (u) => u.ferramentaId === reservaForm.ferramentaId && u.status !== "baixada",
                )
                .map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {unidade.codigo}
                  </option>
                ))}
            </select>
            <select
              value={reservaForm.funcionarioId}
              onChange={(event) =>
                setReservaForm((a) => ({ ...a, funcionarioId: event.target.value }))
              }
              className="input h-9"
            >
              <option value="">Técnico</option>
              {estado.funcionarios.map((funcionario) => (
                <option key={funcionario.id} value={funcionario.id}>
                  {funcionario.nome}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={reservaForm.dataInicio}
              onChange={(event) =>
                setReservaForm((a) => ({ ...a, dataInicio: event.target.value }))
              }
              className="input h-9"
            />
            <input
              type="date"
              value={reservaForm.dataFim}
              placeholder="fim (opcional)"
              onChange={(event) => setReservaForm((a) => ({ ...a, dataFim: event.target.value }))}
              className="input h-9"
            />
            <button
              type="button"
              onClick={criarReserva}
              disabled={
                salvandoReserva ||
                !reservaForm.ferramentaId ||
                !reservaForm.funcionarioId ||
                !reservaForm.dataInicio
              }
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
            >
              Reservar
            </button>
          </div>
        )}

        {ordenarAgendaReservas(estado.reservas).length === 0 ? (
          <p className="mt-4 text-sm text-ink-3">Sem reservas pendentes.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {ordenarAgendaReservas(estado.reservas).map((reserva) => (
              <li
                key={reserva.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-line-soft bg-paper px-3 py-2 text-sm"
              >
                <span className="text-ink-2">
                  {reserva.ferramentaNome}{" "}
                  {reserva.unidadeCodigo ? `(${reserva.unidadeCodigo})` : "(qualquer unidade)"} ·{" "}
                  {reserva.funcionarioNome} · {reserva.dataInicio}
                  {reserva.dataFim !== reserva.dataInicio ? ` a ${reserva.dataFim}` : ""}
                </span>
                {temEscrita && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEfetivando(reserva)}
                      className="text-xs font-semibold text-orange hover:text-orange-deep"
                    >
                      Efetivar
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelarReserva(reserva)}
                      className="text-xs font-semibold text-[#A23B25] hover:underline"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <KitsSection temEscrita={temEscrita} />

      {modal && (
        <FerramentaModal
          ferramenta={modal.modo === "editar" ? modal.ferramenta : undefined}
          categorias={estado.categorias}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}

      {baixando && (
        <BaixaModal
          unidade={baixando}
          onCancel={() => setBaixando(null)}
          onConfirmar={confirmarBaixa}
        />
      )}

      {efetivando && (
        <EfetivarReservaModal
          reserva={efetivando}
          unidadesDisponiveis={estado.unidades.filter(
            (u) => u.ferramentaId === efetivando.ferramentaId && u.status === "disponivel",
          )}
          onCancel={() => setEfetivando(null)}
          onConfirmar={confirmarEfetivar}
        />
      )}

      {historicoUnidade && (
        <HistoricoMovimentacoesModal
          titulo={`Histórico de ${historicoUnidade.codigo}`}
          itens={historicoUnidade.itens}
          onFechar={() => setHistoricoUnidade(null)}
        />
      )}
    </div>
  );
}

function EfetivarReservaModal({
  reserva,
  unidadesDisponiveis,
  onCancel,
  onConfirmar,
}: {
  reserva: FerramentaReservaItem;
  unidadesDisponiveis: FerramentaUnidadeItem[];
  onCancel: () => void;
  onConfirmar: (unidadeId: string) => Promise<void>;
}) {
  const [unidadeId, setUnidadeId] = useState(reserva.unidadeId ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    try {
      setSalvando(true);
      setErro(null);
      await onConfirmar(unidadeId);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível efetivar a reserva.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-md rounded-[8px] border border-line bg-card shadow-xl">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">Efetivar reserva</h3>
          <p className="text-xs text-ink-3">
            {reserva.ferramentaNome} · {reserva.funcionarioNome}
          </p>
        </div>
        <div className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Unidade</span>
            <select
              value={unidadeId}
              onChange={(event) => setUnidadeId(event.target.value)}
              className="input w-full"
            >
              <option value="">Escolha a unidade</option>
              {unidadesDisponiveis.map((unidade) => (
                <option key={unidade.id} value={unidade.id}>
                  {unidade.codigo}
                </option>
              ))}
            </select>
          </label>
          {erro && (
            <div className="rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
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
            onClick={confirmar}
            disabled={salvando || !unidadeId}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Efetivar (atribuir agora)"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FerramentaLinha({
  ferramenta,
  unidades,
  expandida,
  onToggleExpandir,
  onEditar,
  onDesativar,
  onGerarUnidades,
  onBaixarUnidade,
  onVerHistorico,
}: {
  ferramenta: FerramentaItem;
  unidades: FerramentaUnidadeItem[];
  expandida: boolean;
  onToggleExpandir: () => void;
  onEditar?: () => void;
  onDesativar?: () => void;
  onGerarUnidades?: (quantidade: number) => void;
  onBaixarUnidade?: (unidade: FerramentaUnidadeItem) => void;
  onVerHistorico: (unidade: FerramentaUnidadeItem) => void;
}) {
  const faltamGerar = Math.max(ferramenta.quantidadeTotal - unidades.length, 0);
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-3">
        {ferramenta.imagemUrl ? (
          <img
            src={ferramenta.imagemUrl}
            alt={ferramenta.nome}
            className="h-9 w-9 shrink-0 rounded-[6px] border border-line object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-line bg-line-soft">
            <Wrench className="h-4 w-4 text-ink-3" />
          </div>
        )}

        <button
          type="button"
          onClick={onToggleExpandir}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {expandida ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-ink-3" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-3" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="truncate text-sm font-semibold text-ink">{ferramenta.nome}</span>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${ferramenta.ativo ? "bg-[#E7F6EC] text-[#1E8E45]" : "bg-[#EFF1F4] text-[#5A6175]"}`}
              >
                {ferramenta.ativo ? "Ativa" : "Inativa"}
              </span>
            </div>
            <p className="truncate text-xs text-ink-3">
              {ferramenta.categoriaNome ?? "sem categoria"} · Auvo {ferramenta.auvoId ?? "-"}
              {ferramenta.auvoSyncError ? ` · erro: ${ferramenta.auvoSyncError}` : ""}
            </p>
          </div>
        </button>

        <span className="shrink-0 text-xs text-ink-3">
          {unidades.length}/{ferramenta.quantidadeTotal} unid.
        </span>

        {onEditar && (
          <IconButton label="Editar" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onEditar} />
        )}
        {onDesativar && (
          <IconButton
            label="Desativar"
            danger
            icon={<Trash2 className="h-3.5 w-3.5" />}
            onClick={onDesativar}
          />
        )}
      </div>

      {expandida && (
        <div className="mt-2 ml-12 space-y-2 rounded-[6px] border border-line-soft bg-paper p-2.5">
          {onGerarUnidades && faltamGerar > 0 && (
            <button
              type="button"
              onClick={() => onGerarUnidades(faltamGerar)}
              className="text-xs font-semibold text-orange hover:text-orange-deep"
            >
              Gerar {faltamGerar} unidade(s) (total cadastrado: {ferramenta.quantidadeTotal})
            </button>
          )}
          {unidades.length === 0 ? (
            <p className="text-xs text-ink-3">Nenhuma unidade gerada ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {unidades.map((unidade) => (
                <li key={unidade.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-ink-2">
                    <span className="font-brand">{unidade.codigo}</span> ·{" "}
                    {rotuloStatusUnidade(unidade.status)}
                    {unidade.status === "atribuida" && unidade.atribuidaANome
                      ? ` com ${unidade.atribuidaANome}`
                      : ""}
                    {unidade.status === "atribuida" && unidade.atribuidaEm
                      ? ` (desde ${new Date(unidade.atribuidaEm).toLocaleDateString("pt-BR")})`
                      : ""}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onVerHistorico(unidade)}
                      className="inline-flex items-center gap-1 font-semibold text-ink-2 hover:text-ink"
                    >
                      <History className="h-3 w-3" />
                      Histórico
                    </button>
                    {onBaixarUnidade && unidade.status !== "baixada" && (
                      <button
                        type="button"
                        onClick={() => onBaixarUnidade(unidade)}
                        className="text-[#A23B25] hover:underline"
                      >
                        Baixar
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function BaixaModal({
  unidade,
  onCancel,
  onConfirmar,
}: {
  unidade: FerramentaUnidadeItem;
  onCancel: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    try {
      setSalvando(true);
      setErro(null);
      await onConfirmar(motivo);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível dar baixa na unidade.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-md rounded-[8px] border border-line bg-card shadow-xl">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">Dar baixa em {unidade.codigo}</h3>
          <p className="text-xs text-ink-3">{unidade.ferramentaNome} — ação permanente</p>
        </div>
        <div className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Motivo *</span>
            <textarea
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              className="input min-h-[80px] w-full resize-y"
              placeholder="Ex.: extraviada em campo, quebrada sem conserto..."
            />
          </label>
          {erro && (
            <div className="rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
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
            onClick={confirmar}
            disabled={salvando}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Confirmar baixa"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FerramentaModal({
  ferramenta,
  categorias,
  onCancel,
  onSalvar,
}: {
  ferramenta?: FerramentaItem;
  categorias: FerramentaCategoriaOpcao[];
  onCancel: () => void;
  onSalvar: (input: FerramentaFormData) => Promise<void>;
}) {
  const [dados, setDados] = useState<FerramentaFormData>({
    nome: ferramenta?.nome ?? "",
    descricao: ferramenta?.descricao ?? "",
    categoriaId: ferramenta?.categoriaId ?? "",
    quantidadeTotal: ferramenta?.quantidadeTotal ?? 0,
    quantidadeMinima: ferramenta?.quantidadeMinima ?? 0,
    valorUnitario: ferramenta?.valorUnitario ?? null,
    custoUnitario: ferramenta?.custoUnitario ?? null,
  });
  const [categoriaTexto, setCategoriaTexto] = useState(ferramenta?.categoriaNome ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const errosInline = validarFerramentaInline(dados);

  function selecionarCategoriaPorTexto(texto: string) {
    setCategoriaTexto(texto);
    const encontrada = categorias.find((c) => c.nome.toLowerCase() === texto.trim().toLowerCase());
    setDados((a) => ({ ...a, categoriaId: encontrada?.id ?? "" }));
  }

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(dados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar ferramenta.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-2xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">
            {ferramenta ? "Editar ferramenta" : "Nova ferramenta"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
          {ferramenta && (
            <div className="md:col-span-2">
              {ferramenta.imagemUrl ? (
                <div className="flex items-center gap-3">
                  <img
                    src={ferramenta.imagemUrl}
                    alt={ferramenta.nome}
                    className="h-16 w-16 rounded-[6px] border border-line object-cover"
                  />
                  <p className="text-xs text-ink-3">
                    Imagem vinda do Auvo. Pra trocar, cadastre direto no app Auvo — o PCM ainda não
                    escreve esse campo (contrato de escrita não confirmado).
                  </p>
                </div>
              ) : (
                <p className="rounded-[6px] border border-line-soft bg-paper px-3 py-2 text-xs text-ink-3">
                  Sem imagem. Cadastre a foto direto no Auvo — o PCM só exibe quando o Auvo tiver.
                </p>
              )}
              {ferramenta.codigoAuvo && (
                <p className="mt-2 text-xs text-ink-3">
                  Código Auvo:{" "}
                  <span className="font-brand text-ink-2">{ferramenta.codigoAuvo}</span>
                </p>
              )}
            </div>
          )}
          <Field
            label="Nome *"
            value={dados.nome}
            onChange={(v) => setDados((a) => ({ ...a, nome: v }))}
            erro={errosInline.nome}
          />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Categoria</span>
            <input
              list="ferramenta-categorias-lista"
              value={categoriaTexto}
              onChange={(event) => selecionarCategoriaPorTexto(event.target.value)}
              placeholder="Buscar categoria..."
              className="input w-full"
            />
            <datalist id="ferramenta-categorias-lista">
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.nome} />
              ))}
            </datalist>
          </label>
          <NumberField
            label="Quantidade total"
            value={dados.quantidadeTotal}
            onChange={(v) => setDados((a) => ({ ...a, quantidadeTotal: v }))}
            erro={errosInline.quantidadeTotal}
          />
          <NumberField
            label="Quantidade mínima"
            value={dados.quantidadeMinima}
            onChange={(v) => setDados((a) => ({ ...a, quantidadeMinima: v }))}
            erro={errosInline.quantidadeMinima}
          />
          <NumberField
            label="Valor unitário (R$)"
            value={dados.valorUnitario ?? 0}
            onChange={(v) => setDados((a) => ({ ...a, valorUnitario: v }))}
            step={0.01}
          />
          <NumberField
            label="Custo unitário (R$)"
            value={dados.custoUnitario ?? 0}
            onChange={(v) => setDados((a) => ({ ...a, custoUnitario: v }))}
            step={0.01}
          />
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Descrição</span>
            <textarea
              value={dados.descricao ?? ""}
              onChange={(event) => setDados((a) => ({ ...a, descricao: event.target.value }))}
              className="input min-h-[88px] w-full resize-y"
            />
          </label>
          {erro && (
            <div className="md:col-span-2 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
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
            disabled={salvando || Object.keys(errosInline).length > 0}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  erro,
}: { label: string; value: string; onChange: (value: string) => void; erro?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-3">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input w-full"
      />
      {erro && <span className="mt-1 block text-xs text-[#A23B25]">{erro}</span>}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  erro,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  erro?: string;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-3">{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="input w-full"
      />
      {erro && <span className="mt-1 block text-xs text-[#A23B25]">{erro}</span>}
    </label>
  );
}

function IconButton({
  label,
  icon,
  danger,
  onClick,
}: { label: string; icon: ReactNode; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border px-3 text-xs font-semibold ${danger ? "border-[#F2C0B5] text-[#A23B25] hover:bg-[#FFF4F1]" : "border-line text-ink-2 hover:bg-line-soft"}`}
    >
      {icon}
      {label}
    </button>
  );
}
