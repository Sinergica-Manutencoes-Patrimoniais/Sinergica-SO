// SistemasPage.tsx — E01-S76 (AC-7, AC-8): CRUD de Sistema + seletor de itens membros (N:N) +
// status de sync Auvo (código/estado — descriptor `sistemas` nasce writeEnabled:false, dry-run).
import { Link2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { listarClientesEquipamento } from "../application/equipamentos";
import {
  adicionarItem,
  criarSistema,
  desativarSistema,
  editarSistema,
  listarItensDisponiveis,
  listarItensDoSistema,
  listarSistemas,
  removerItem,
} from "../application/sistemas";
import type { EquipamentoClienteOpcao } from "../domain/equipamentos";
import type { Area } from "../domain/hierarquia";
import type { Sistema, SistemaFormData, SistemaItemMembro } from "../domain/sistemas";
import { supabaseEquipamentosAdapter } from "../infrastructure/supabase-equipamentos-adapter";
import { supabaseHierarquiaAdapter } from "../infrastructure/supabase-hierarquia-adapter";
import { supabaseSistemasAdapter } from "../infrastructure/supabase-sistemas-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; sistemas: Sistema[]; clientes: EquipamentoClienteOpcao[] };

type Modal = { modo: "novo" } | { modo: "editar"; sistema: Sistema } | null;

const STATUS_LABEL_DEFAULT = { texto: "Pendente (dry-run)", classe: "bg-[#FDF1DF] text-[#9A5A00]" };
const STATUS_LABEL: Record<string, { texto: string; classe: string }> = {
  pending: STATUS_LABEL_DEFAULT,
  synced: { texto: "Sincronizado", classe: "bg-[#E7F6EC] text-[#1E8E45]" },
  error: { texto: "Erro", classe: "bg-[#FFF4F1] text-[#A23B25]" },
};

export function SistemasPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modal, setModal] = useState<Modal>(null);
  const [membrosAbertoId, setMembrosAbertoId] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [sistemas, clientes] = await Promise.all([
        listarSistemas(supabaseSistemasAdapter),
        listarClientesEquipamento(supabaseEquipamentosAdapter),
      ]);
      setEstado({ fase: "pronto", sistemas, clientes });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar Sistemas.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(dados: SistemaFormData) {
    if (!user) return;
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editarSistema(supabaseSistemasAdapter, {
        ...dados,
        id: modal.sistema.id,
        userId: user.id,
      });
    } else {
      await criarSistema(supabaseSistemasAdapter, { ...dados, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function desativar(sistema: Sistema) {
    if (!user) return;
    if (!confirm(`Desativar "${sistema.nome}"?`)) return;
    setErroAcao(null);
    await desativarSistema(supabaseSistemasAdapter, sistema.id, user.id);
    await carregar();
  }

  if (permissoesCarregando)
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">Você não tem permissão de leitura no módulo PCM.</p>
      </div>
    );
  }
  if (estado.fase === "carregando")
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button type="button" onClick={carregar} className="mt-4 font-semibold text-orange">
          <RefreshCw className="mr-1 inline h-4 w-4" />
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
            <h3 className="text-base font-semibold text-ink">Sistemas</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Agrupamento funcional transversal de Itens ("Sistema de Hidrante Torre A") — enfileira
              no Auvo como Equipment (dry-run, escrita ainda desligada)
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModal({ modo: "novo" })}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
            >
              <Plus className="h-4 w-4" />
              Novo Sistema
            </button>
          )}
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {estado.sistemas.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <Link2 className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhum Sistema cadastrado.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {estado.sistemas.map((sistema) => {
            const status =
              STATUS_LABEL[sistema.auvoSyncStatus ?? "pending"] ?? STATUS_LABEL_DEFAULT;
            const clienteNome =
              estado.clientes.find((c) => c.id === sistema.clienteId)?.nome ?? "—";
            return (
              <section key={sistema.id} className="rounded-[8px] border border-line bg-card">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate text-sm font-semibold text-ink">
                        {sistema.nome}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${status.classe}`}
                      >
                        {status.texto}
                      </span>
                      {sistema.codigo && (
                        <span className="shrink-0 rounded-full bg-line-soft px-1.5 py-0.5 text-[10px] font-semibold text-ink-2">
                          {sistema.codigo}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-ink-3">
                      {clienteNome}
                      {sistema.tipo ? ` · ${sistema.tipo}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setMembrosAbertoId(membrosAbertoId === sistema.id ? null : sistema.id)
                    }
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] border border-line px-2.5 text-xs font-semibold text-ink-2 hover:bg-line-soft"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Itens
                  </button>
                  {temEscrita && (
                    <>
                      <button
                        type="button"
                        onClick={() => setModal({ modo: "editar", sistema })}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] border border-line px-2.5 text-xs font-semibold text-ink-2 hover:bg-line-soft"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => desativar(sistema)}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] border border-[#F2C0B5] px-2.5 text-xs font-semibold text-[#A23B25] hover:bg-[#FFF4F1]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
                {membrosAbertoId === sistema.id && (
                  <MembrosSistema
                    sistema={sistema}
                    temEscrita={temEscrita}
                    userId={user?.id ?? ""}
                  />
                )}
              </section>
            );
          })}
        </div>
      )}

      {modal && (
        <SistemaModal
          sistema={modal.modo === "editar" ? modal.sistema : undefined}
          clientes={estado.clientes}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}
    </div>
  );
}

function MembrosSistema({
  sistema,
  temEscrita,
  userId,
}: {
  sistema: Sistema;
  temEscrita: boolean;
  userId: string;
}) {
  const [membros, setMembros] = useState<SistemaItemMembro[] | "carregando">("carregando");
  const [itensDisponiveis, setItensDisponiveis] = useState<Array<{ id: string; nome: string }>>([]);
  const [itemSelecionado, setItemSelecionado] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [membrosAtuais, itens] = await Promise.all([
      listarItensDoSistema(supabaseSistemasAdapter, sistema.id),
      listarItensDisponiveis(supabaseSistemasAdapter, sistema.clienteId),
    ]);
    setMembros(membrosAtuais);
    setItensDisponiveis(itens);
  }, [sistema.id, sistema.clienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionar() {
    if (!itemSelecionado) return;
    try {
      setErro(null);
      await adicionarItem(supabaseSistemasAdapter, sistema.id, itemSelecionado, userId);
      setItemSelecionado("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível adicionar o item.");
    }
  }

  async function remover(itemId: string) {
    await removerItem(supabaseSistemasAdapter, sistema.id, itemId);
    await carregar();
  }

  const membrosIds = new Set(membros === "carregando" ? [] : membros.map((m) => m.itemId));
  const opcoes = itensDisponiveis.filter((i) => !membrosIds.has(i.id));

  return (
    <div className="border-t border-line-soft px-4 py-3">
      {temEscrita && (
        <div className="mb-3 flex gap-2">
          <select
            value={itemSelecionado}
            onChange={(e) => setItemSelecionado(e.target.value)}
            className="input h-9 flex-1"
          >
            <option value="">Selecione um item para adicionar…</option>
            {opcoes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={adicionar}
            className="btn-secondary"
            disabled={!itemSelecionado}
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </div>
      )}
      {erro && <p className="mb-2 text-xs text-[#A23B25]">{erro}</p>}
      {membros === "carregando" ? (
        <p className="text-sm text-ink-3">Carregando…</p>
      ) : membros.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhum item neste Sistema.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {membros.map((membro) => (
            <span
              key={membro.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-line-soft px-3 py-1 text-xs font-semibold text-ink-2"
            >
              {membro.itemNome}
              {temEscrita && (
                <button
                  type="button"
                  onClick={() => remover(membro.itemId)}
                  aria-label={`Remover ${membro.itemNome}`}
                  className="text-ink-3 hover:text-[#A23B25]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SistemaModal({
  sistema,
  clientes,
  onCancel,
  onSalvar,
}: {
  sistema?: Sistema;
  clientes: EquipamentoClienteOpcao[];
  onCancel: () => void;
  onSalvar: (dados: SistemaFormData) => Promise<void>;
}) {
  const [dados, setDados] = useState<SistemaFormData>({
    clienteId: sistema?.clienteId ?? "",
    areaId: sistema?.areaId ?? "",
    nome: sistema?.nome ?? "",
    tipo: sistema?.tipo ?? "",
    descricao: sistema?.descricao ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [areasDoCliente, setAreasDoCliente] = useState<Area[]>([]);

  // Área é escopo opcional do Sistema — sempre selecionada dentre as Áreas já cadastradas na
  // Estrutura do cliente (nunca digitada), pra não divergir do que existe lá.
  useEffect(() => {
    if (!dados.clienteId) {
      setAreasDoCliente([]);
      return;
    }
    let cancelado = false;
    supabaseHierarquiaAdapter.listarAreas(dados.clienteId).then((areas) => {
      if (!cancelado) setAreasDoCliente(areas);
    });
    return () => {
      cancelado = true;
    };
  }, [dados.clienteId]);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(dados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o Sistema.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-lg rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">
            {sistema ? "Editar Sistema" : "Novo Sistema"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Cliente *</span>
            <select
              value={dados.clienteId}
              onChange={(e) => setDados((atual) => ({ ...atual, clienteId: e.target.value }))}
              className="input w-full"
              disabled={Boolean(sistema)}
            >
              <option value="">Selecione…</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Área</span>
            <select
              value={dados.areaId ?? ""}
              onChange={(e) => setDados((atual) => ({ ...atual, areaId: e.target.value }))}
              className="input w-full"
              disabled={!dados.clienteId}
            >
              <option value="">Sem escopo de Área</option>
              {areasDoCliente.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Nome *</span>
            <input
              value={dados.nome}
              onChange={(e) => setDados((atual) => ({ ...atual, nome: e.target.value }))}
              className="input w-full"
              placeholder='ex.: "Sistema de Hidrante Torre A"'
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Tipo</span>
            <input
              value={dados.tipo ?? ""}
              onChange={(e) => setDados((atual) => ({ ...atual, tipo: e.target.value }))}
              className="input w-full"
              placeholder="hidrante, incêndio, spda..."
            />
          </label>
          {erro && (
            <div className="rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
