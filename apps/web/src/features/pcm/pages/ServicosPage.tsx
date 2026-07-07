import { Briefcase, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  criarServico,
  desativarServico,
  editarServico,
  listarServicos,
} from "../application/servicos";
import {
  type ServicoFormData,
  type ServicoItem,
  centavosParaReais,
  reaisParaCentavos,
} from "../domain/servicos";
import { supabaseServicosAdapter } from "../infrastructure/supabase-servicos-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; servicos: ServicoItem[] };

type Modal =
  | { modo: "novo"; servico?: undefined }
  | { modo: "editar"; servico: ServicoItem }
  | null;

export function ServicosPage() {
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
      setEstado({ fase: "pronto", servicos: await listarServicos(supabaseServicosAdapter) });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar serviços.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: ServicoFormData) {
    if (!user) return;
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editarServico(supabaseServicosAdapter, {
        ...input,
        id: modal.servico.id,
        userId: user.id,
      });
    } else {
      await criarServico(supabaseServicosAdapter, { ...input, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function desativar(servico: ServicoItem) {
    if (!user || !confirm(`Desativar ${servico.titulo}?`)) return;
    try {
      setErroAcao(null);
      await desativarServico(supabaseServicosAdapter, { id: servico.id, userId: user.id });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível desativar.");
    }
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
      <section className="rounded-[8px] border border-line bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">Serviços</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Catálogo de serviços sincronizado com Auvo /services
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModal({ modo: "novo" })}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
            >
              <Plus className="h-4 w-4" />
              Novo serviço
            </button>
          )}
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {estado.servicos.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <Briefcase className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhum serviço cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {estado.servicos.map((servico) => (
            <div key={servico.id} className="rounded-[8px] border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold text-ink">{servico.titulo}</h4>
                  <p className="mt-1 text-xs text-ink-3">
                    Auvo {servico.auvoId ?? "-"} · R$ {centavosParaReais(servico.precoCentavos)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${servico.ativo ? "bg-[#E7F6EC] text-[#1E8E45]" : "bg-[#EFF1F4] text-[#5A6175]"}`}
                >
                  {servico.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>
              {servico.descricao && <p className="mt-3 text-sm text-ink-3">{servico.descricao}</p>}
              <p className="mt-3 text-xs text-ink-3">Sync: {servico.auvoSyncStatus ?? "pending"}</p>
              {servico.auvoSyncError && (
                <p className="mt-2 text-xs text-[#A23B25]">{servico.auvoSyncError}</p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                {temEscrita && (
                  <IconButton
                    label="Editar"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => setModal({ modo: "editar", servico })}
                  />
                )}
                {temEscrita && servico.ativo && (
                  <IconButton
                    label="Desativar"
                    danger
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => desativar(servico)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ServicoModal
          servico={modal.modo === "editar" ? modal.servico : undefined}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}
    </div>
  );
}

function ServicoModal({
  servico,
  onCancel,
  onSalvar,
}: {
  servico?: ServicoItem;
  onCancel: () => void;
  onSalvar: (input: ServicoFormData) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState(servico?.titulo ?? "");
  const [descricao, setDescricao] = useState(servico?.descricao ?? "");
  const [preco, setPreco] = useState(servico ? centavosParaReais(servico.precoCentavos) : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({ titulo, descricao, precoCentavos: reaisParaCentavos(preco) });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar serviço.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold text-ink">
            {servico ? "Editar serviço" : "Novo serviço"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5">
          <Field label="Título *" value={titulo} onChange={setTitulo} />
          <Field label="Preço *" value={preco} onChange={setPreco} />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Descrição</span>
            <textarea
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              className="input min-h-[88px] w-full resize-y"
            />
          </label>
          {erro && (
            <div className="rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
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

function Field({
  label,
  value,
  onChange,
}: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-3">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input w-full"
      />
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
