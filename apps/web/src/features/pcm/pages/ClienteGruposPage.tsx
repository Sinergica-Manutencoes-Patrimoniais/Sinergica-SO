import { Pencil, Plus, RefreshCw, Trash2, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import type { ClienteResumo } from "../application/cliente-360-gateway";
import {
  criarClienteGrupo,
  editarClienteGrupo,
  excluirClienteGrupo,
  listarClienteGrupos,
  listarClientesSincronizadosParaGrupo,
} from "../application/cliente-grupos";
import type { ClienteGrupoItem } from "../domain/cliente-grupos";
import { supabaseClienteGruposAdapter } from "../infrastructure/supabase-cliente-grupos-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; grupos: ClienteGrupoItem[]; clientes: ClienteResumo[] };

type Modal =
  | { modo: "novo"; grupo?: undefined }
  | { modo: "editar"; grupo: ClienteGrupoItem }
  | null;

export function ClienteGruposPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modal, setModal] = useState<Modal>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [grupos, clientes] = await Promise.all([
        listarClienteGrupos(supabaseClienteGruposAdapter),
        listarClientesSincronizadosParaGrupo(supabaseClienteGruposAdapter),
      ]);
      setEstado({ fase: "pronto", grupos, clientes });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar grupos.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: { nome: string; clienteIds: string[] }) {
    if (!user) return;
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editarClienteGrupo(supabaseClienteGruposAdapter, {
        ...input,
        id: modal.grupo.id,
        userId: user.id,
      });
    } else {
      await criarClienteGrupo(supabaseClienteGruposAdapter, { ...input, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function excluir(grupo: ClienteGrupoItem) {
    if (!user) return;
    if (!confirm(`Excluir grupo ${grupo.nome}?`)) return;
    try {
      setErroAcao(null);
      await excluirClienteGrupo(supabaseClienteGruposAdapter, { id: grupo.id, userId: user.id });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível excluir o grupo.");
    }
  }

  if (permissoesCarregando) {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
  }

  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">
          Você não tem permissão de leitura no módulo PCM para ver esta tela.
        </p>
      </div>
    );
  }

  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
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

  const { grupos, clientes } = estado;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">Grupos de Clientes</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Grupos criados com clientes já sincronizados no Auvo
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModal({ modo: "novo" })}
              disabled={clientes.length === 0}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Novo grupo
            </button>
          )}
        </div>
        <div className="mt-4 rounded-[6px] border border-[#F0D4B0] bg-orange-soft px-3 py-2 text-sm text-[#8A4B00]">
          Renomear ou trocar clientes aqui não altera um grupo já existente no Auvo; a API v2
          documenta criação e exclusão, mas não edição de grupos.
        </div>
        {clientes.length === 0 && (
          <div className="mt-3 rounded-[6px] border border-line bg-line-soft px-3 py-2 text-sm text-ink-3">
            Cadastre ou sincronize clientes antes de criar grupos.
          </div>
        )}
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {grupos.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <Users className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhum grupo de clientes cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {grupos.map((grupo) => (
            <GrupoCard
              key={grupo.id}
              grupo={grupo}
              clientes={clientes}
              onEditar={temEscrita ? () => setModal({ modo: "editar", grupo }) : undefined}
              onExcluir={temEscrita ? () => excluir(grupo) : undefined}
            />
          ))}
        </div>
      )}

      {modal && (
        <GrupoModal
          grupo={modal.modo === "editar" ? modal.grupo : undefined}
          clientes={clientes}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}
    </div>
  );
}

function GrupoCard({
  grupo,
  clientes,
  onEditar,
  onExcluir,
}: {
  grupo: ClienteGrupoItem;
  clientes: ClienteResumo[];
  onEditar?: () => void;
  onExcluir?: () => void;
}) {
  const nomes = grupo.clienteIds
    .map((id) => clientes.find((cliente) => cliente.id === id)?.nome)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rounded-[8px] border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-ink">{grupo.nome}</h4>
          <p className="mt-1 text-xs text-ink-3">
            Auvo {grupo.auvoId ?? "-"} · {grupo.clienteIds.length} cliente(s)
          </p>
        </div>
        <span className="rounded-full bg-[#EFF1F4] px-2 py-0.5 text-[11px] font-semibold text-[#5A6175]">
          {grupo.auvoSyncStatus ?? "pending"}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-ink-3">{nomes || "Clientes não encontrados"}</p>
      {grupo.auvoSyncError && <p className="mt-2 text-xs text-[#A23B25]">{grupo.auvoSyncError}</p>}
      <div className="mt-4 flex justify-end gap-2">
        {onEditar && (
          <button
            type="button"
            onClick={onEditar}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border border-line px-3 text-xs font-semibold text-ink-2 hover:bg-line-soft"
          >
            <Pencil className="h-3.5 w-3.5" />
            Renomear local
          </button>
        )}
        {onExcluir && (
          <button
            type="button"
            onClick={onExcluir}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border border-[#F2C0B5] px-3 text-xs font-semibold text-[#A23B25] hover:bg-[#FFF4F1]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </button>
        )}
      </div>
    </div>
  );
}

function GrupoModal({
  grupo,
  clientes,
  onCancel,
  onSalvar,
}: {
  grupo?: ClienteGrupoItem;
  clientes: ClienteResumo[];
  onCancel: () => void;
  onSalvar: (input: { nome: string; clienteIds: string[] }) => Promise<void>;
}) {
  const [nome, setNome] = useState(grupo?.nome ?? "");
  const [clienteIds, setClienteIds] = useState<string[]>(grupo?.clienteIds ?? []);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const selecionados = useMemo(() => new Set(clienteIds), [clienteIds]);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({ nome, clienteIds });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o grupo.");
    } finally {
      setSalvando(false);
    }
  }

  function toggleCliente(id: string) {
    setClienteIds((atuais) =>
      atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id],
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-2xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold text-ink">
            {grupo ? "Renomear grupo" : "Novo grupo de clientes"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Nome *</span>
            <input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              className="input w-full"
            />
          </label>
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-ink-3">Clientes sincronizados *</p>
            <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {clientes.map((cliente) => (
                <label
                  key={cliente.id}
                  className="flex items-start gap-2 rounded-[6px] border border-line px-3 py-2 text-sm text-ink-2"
                >
                  <input
                    type="checkbox"
                    checked={selecionados.has(cliente.id)}
                    onChange={() => toggleCliente(cliente.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold">{cliente.nome}</span>
                    <span className="text-xs text-ink-3">Auvo {cliente.auvoId}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          {grupo && (
            <div className="mt-4 rounded-[6px] border border-[#F0D4B0] bg-orange-soft px-3 py-2 text-sm text-[#8A4B00]">
              Esta alteração fica local. Para refletir no Auvo, exclua e crie um novo grupo.
            </div>
          )}
          {erro && (
            <div className="mt-4 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
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
