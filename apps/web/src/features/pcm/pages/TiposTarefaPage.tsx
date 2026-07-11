import { Edit3, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  criarTipoTarefa,
  editarTipoTarefa,
  excluirTipoTarefa,
  listarTiposTarefa,
} from "../application/tipos-tarefa";
import type { TipoTarefa, TipoTarefaFormData } from "../domain/tipos-tarefa";
import { syncStatusLabel } from "../domain/tipos-tarefa";
import { supabaseTiposTarefaAdapter } from "../infrastructure/supabase-tipos-tarefa-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; tipos: TipoTarefa[] };

interface ModalState {
  modo: "criar" | "editar";
  tipo?: TipoTarefa;
}

const FORM_INICIAL: TipoTarefaFormData = {
  nome: "",
  preencheRelato: false,
  exigeAssinatura: false,
  fotosMinimas: 0,
  ativo: true,
};

export function TiposTarefaPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [busca, setBusca] = useState("");
  const [somenteAtivos, setSomenteAtivos] = useState(true);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    setErroAcao(null);
    try {
      const tipos = await listarTiposTarefa(supabaseTiposTarefaAdapter);
      setEstado({ fase: "pronto", tipos });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar tipos.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  const tiposFiltrados = useMemo(() => {
    if (estado.fase !== "pronto") return [];
    const termo = busca.trim().toLowerCase();
    return estado.tipos.filter((tipo) => {
      const passaAtivo = !somenteAtivos || tipo.ativo;
      const passaBusca = termo.length === 0 || tipo.nome.toLowerCase().includes(termo);
      return passaAtivo && passaBusca;
    });
  }, [estado, busca, somenteAtivos]);

  async function onSalvar(input: TipoTarefaFormData) {
    if (!user || !modal) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      if (modal.modo === "criar") {
        await criarTipoTarefa(supabaseTiposTarefaAdapter, { ...input, userId: user.id });
      } else if (modal.tipo) {
        await editarTipoTarefa(supabaseTiposTarefaAdapter, {
          ...input,
          id: modal.tipo.id,
          userId: user.id,
        });
      }
      setModal(null);
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function onExcluir(tipo: TipoTarefa) {
    if (!user) return;
    const confirmado = window.confirm(`Excluir "${tipo.nome}"?`);
    if (!confirmado) return;

    setSalvando(true);
    setErroAcao(null);
    try {
      await excluirTipoTarefa(supabaseTiposTarefaAdapter, { id: tipo.id, userId: user.id });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível excluir.");
    } finally {
      setSalvando(false);
    }
  }

  if (permissoesCarregando) {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }

  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">Você não tem permissão de leitura no módulo PCM.</p>
      </div>
    );
  }

  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando tipos de tarefa…</div>;
  }

  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button type="button" onClick={carregar} className="mt-4 text-sm font-semibold text-orange">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Tipos de Tarefa</h2>
          <p className="text-sm text-ink-3">Catálogo operacional sincronizado com o Auvo</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={carregar} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModal({ modo: "criar" })}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" />
              Novo
            </button>
          )}
        </div>
      </div>

      {erroAcao && (
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erroAcao}
        </div>
      )}

      <section className="rounded-[10px] border border-line bg-card">
        <div className="grid grid-cols-1 gap-3 border-b border-line-soft px-4 py-3 md:grid-cols-[minmax(240px,1fr)_180px]">
          <input
            className="input"
            placeholder="Buscar por nome"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />
          <label className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={somenteAtivos}
              onChange={(event) => setSomenteAtivos(event.target.checked)}
            />
            Somente ativos
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line-soft text-sm">
            <thead className="bg-line-soft/60 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">
              <tr>
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">Requisitos</th>
                <th className="px-5 py-3">Sync</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {tiposFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-ink-3">
                    Nenhum tipo de tarefa encontrado.
                  </td>
                </tr>
              ) : (
                tiposFiltrados.map((tipo) => (
                  <tr key={tipo.id} className="hover:bg-line-soft/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{tipo.nome}</p>
                      <p className="mt-1 text-xs text-ink-3">
                        {tipo.ativo ? "Ativo" : "Inativo"}
                        {tipo.auvoId ? ` · Auvo #${tipo.auvoId}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      <div className="flex flex-wrap gap-2">
                        {tipo.preencheRelato && <Badge>Relato</Badge>}
                        {tipo.exigeAssinatura && <Badge>Assinatura</Badge>}
                        <Badge>{tipo.fotosMinimas} foto(s)</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#EFF1F4] px-2 py-1 text-xs font-semibold text-[#5A6175]">
                        {syncStatusLabel(tipo.auvoSyncStatus)}
                      </span>
                      {tipo.auvoSyncError && (
                        <p className="mt-1 max-w-[260px] truncate text-xs text-[#A12D24]">
                          {tipo.auvoSyncError}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {temEscrita && (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setModal({ modo: "editar", tipo })}
                            className="rounded-[6px] border border-line p-2 text-ink-2 hover:bg-line-soft"
                            title="Editar"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={salvando}
                            onClick={() => onExcluir(tipo)}
                            className="rounded-[6px] border border-[#F0C2BD] p-2 text-[#A12D24] hover:bg-[#FFF4F2] disabled:opacity-50"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal && (
        <TipoTarefaModal
          modal={modal}
          salvando={salvando}
          erro={erroAcao}
          onClose={() => setModal(null)}
          onSalvar={onSalvar}
        />
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[#EAEEF8] px-2 py-1 text-xs font-semibold text-[#2E3C70]">
      {children}
    </span>
  );
}

function TipoTarefaModal({
  modal,
  salvando,
  erro,
  onClose,
  onSalvar,
}: {
  modal: ModalState;
  salvando: boolean;
  erro: string | null;
  onClose: () => void;
  onSalvar: (input: TipoTarefaFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<TipoTarefaFormData>(() =>
    modal.tipo
      ? {
          nome: modal.tipo.nome,
          preencheRelato: modal.tipo.preencheRelato,
          exigeAssinatura: modal.tipo.exigeAssinatura,
          fotosMinimas: modal.tipo.fotosMinimas,
          ativo: modal.tipo.ativo,
        }
      : FORM_INICIAL,
  );

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-xl rounded-[10px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <h3 className="text-base font-semibold text-ink">
            {modal.modo === "criar" ? "Novo Tipo de Tarefa" : "Editar Tipo de Tarefa"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] p-2 text-ink-3 hover:bg-line-soft"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="space-y-4 px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            void onSalvar(form);
          }}
        >
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">Nome</span>
            <input
              className="input mt-1"
              value={form.nome}
              onChange={(event) => setForm((atual) => ({ ...atual, nome: event.target.value }))}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={form.preencheRelato}
                onChange={(event) =>
                  setForm((atual) => ({ ...atual, preencheRelato: event.target.checked }))
                }
              />
              Exige relato
            </label>
            <label className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={form.exigeAssinatura}
                onChange={(event) =>
                  setForm((atual) => ({ ...atual, exigeAssinatura: event.target.checked }))
                }
              />
              Assinatura
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                Fotos
              </span>
              <input
                className="input mt-1"
                type="number"
                min={0}
                step={1}
                value={form.fotosMinimas}
                onChange={(event) =>
                  setForm((atual) => ({
                    ...atual,
                    fotosMinimas: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>

          <label className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={form.ativo ?? true}
              onChange={(event) => setForm((atual) => ({ ...atual, ativo: event.target.checked }))}
            />
            Ativo
          </label>

          {erro && (
            <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
              {erro}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[6px] border border-line px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
