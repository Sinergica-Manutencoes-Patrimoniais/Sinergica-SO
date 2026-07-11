import { MapPin, Pencil, Plus, RefreshCw, Trash2, Wrench, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  criarEquipamento,
  desativarEquipamento,
  editarEquipamento,
  listarClientesEquipamento,
  listarEquipamentos,
} from "../application/equipamentos";
import type {
  EquipamentoClienteOpcao,
  EquipamentoFormData,
  EquipamentoItem,
} from "../domain/equipamentos";
import { supabaseEquipamentosAdapter } from "../infrastructure/supabase-equipamentos-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; equipamentos: EquipamentoItem[]; clientes: EquipamentoClienteOpcao[] };

type Modal =
  | { modo: "novo"; equipamento?: undefined }
  | { modo: "editar"; equipamento: EquipamentoItem }
  | null;

export function EquipamentosPage() {
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
      const [equipamentos, clientes] = await Promise.all([
        listarEquipamentos(supabaseEquipamentosAdapter),
        listarClientesEquipamento(supabaseEquipamentosAdapter),
      ]);
      setEstado({ fase: "pronto", equipamentos, clientes });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem:
          error instanceof Error ? error.message : "Não foi possível carregar equipamentos.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: EquipamentoFormData) {
    if (!user) return;
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editarEquipamento(supabaseEquipamentosAdapter, {
        ...input,
        id: modal.equipamento.id,
        userId: user.id,
      });
    } else {
      await criarEquipamento(supabaseEquipamentosAdapter, { ...input, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function desativar(equipamento: EquipamentoItem) {
    if (!user) return;
    try {
      setErroAcao(null);
      const possuiOs = await supabaseEquipamentosAdapter.possuiOsAberta(equipamento.id);
      const msg = possuiOs
        ? `Desativar ${equipamento.nome}? Há vínculo com OS; o histórico será preservado.`
        : `Desativar ${equipamento.nome}?`;
      if (!confirm(msg)) return;
      await desativarEquipamento(supabaseEquipamentosAdapter, {
        id: equipamento.id,
        userId: user.id,
      });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível desativar.");
    }
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
            <h3 className="text-base font-semibold text-ink">Equipamentos</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Cadastro PCM sincronizado com equipamentos operacionais do Auvo
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModal({ modo: "novo" })}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
            >
              <Plus className="h-4 w-4" />
              Novo equipamento
            </button>
          )}
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {estado.equipamentos.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <Wrench className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhum equipamento cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {estado.equipamentos.map((equipamento) => (
            <EquipamentoCard
              key={equipamento.id}
              equipamento={equipamento}
              onEditar={temEscrita ? () => setModal({ modo: "editar", equipamento }) : undefined}
              onDesativar={
                temEscrita && equipamento.ativo ? () => desativar(equipamento) : undefined
              }
            />
          ))}
        </div>
      )}

      {modal && (
        <EquipamentoModal
          equipamento={modal.modo === "editar" ? modal.equipamento : undefined}
          clientes={estado.clientes}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}
    </div>
  );
}

function EquipamentoCard({
  equipamento,
  onEditar,
  onDesativar,
}: {
  equipamento: EquipamentoItem;
  onEditar?: () => void;
  onDesativar?: () => void;
}) {
  return (
    <div className="rounded-[8px] border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-ink">{equipamento.nome}</h4>
          <p className="mt-1 text-xs text-ink-3">
            Auvo {equipamento.auvoId ?? "-"} · {equipamento.identificador ?? "sem identificador"}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${equipamento.ativo ? "bg-[#E7F6EC] text-[#1E8E45]" : "bg-[#EFF1F4] text-[#5A6175]"}`}
        >
          {equipamento.ativo ? "Ativo" : "Inativo"}
        </span>
      </div>
      <p className="mt-3 text-sm text-ink-3">{equipamento.categoria ?? "Sem categoria"}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-3">
        <span>Cliente: {equipamento.clienteNome ?? "sem vínculo"}</span>
        {equipamento.localizacao && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {equipamento.localizacao}
          </span>
        )}
        <span>Sync: {equipamento.auvoSyncStatus ?? "pending"}</span>
      </div>
      {equipamento.auvoSyncError && (
        <p className="mt-2 text-xs text-[#A23B25]">{equipamento.auvoSyncError}</p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        {onEditar && (
          <button
            type="button"
            onClick={onEditar}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border border-line px-3 text-xs font-semibold text-ink-2 hover:bg-line-soft"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        )}
        {onDesativar && (
          <button
            type="button"
            onClick={onDesativar}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border border-[#F2C0B5] px-3 text-xs font-semibold text-[#A23B25] hover:bg-[#FFF4F1]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Desativar
          </button>
        )}
      </div>
    </div>
  );
}

function EquipamentoModal({
  equipamento,
  clientes,
  onCancel,
  onSalvar,
}: {
  equipamento?: EquipamentoItem;
  clientes: EquipamentoClienteOpcao[];
  onCancel: () => void;
  onSalvar: (input: EquipamentoFormData) => Promise<void>;
}) {
  const [dados, setDados] = useState<EquipamentoFormData>({
    nome: equipamento?.nome ?? "",
    identificador: equipamento?.identificador ?? "",
    categoria: equipamento?.categoria ?? "",
    clientId: equipamento?.clientId ?? "",
    localizacao: equipamento?.localizacao ?? "",
    observacoes: equipamento?.observacoes ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(dados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar equipamento.");
    } finally {
      setSalvando(false);
    }
  }

  function setCampo(campo: keyof EquipamentoFormData, valor: string) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-3xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">
            {equipamento ? "Editar equipamento" : "Novo equipamento"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
          <Field label="Nome *" value={dados.nome} onChange={(v) => setCampo("nome", v)} />
          <Field
            label="Identificador"
            value={dados.identificador ?? ""}
            onChange={(v) => setCampo("identificador", v)}
          />
          <Field
            label="Categoria"
            value={dados.categoria ?? ""}
            onChange={(v) => setCampo("categoria", v)}
          />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Cliente</span>
            <select
              value={dados.clientId ?? ""}
              onChange={(event) => setCampo("clientId", event.target.value)}
              className="input w-full"
            >
              <option value="">Sem vínculo</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                  {cliente.auvoId ? ` · Auvo ${cliente.auvoId}` : ""}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Localização"
            value={dados.localizacao ?? ""}
            onChange={(v) => setCampo("localizacao", v)}
          />
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Observações</span>
            <textarea
              value={dados.observacoes ?? ""}
              onChange={(event) => setCampo("observacoes", event.target.value)}
              className="input min-h-[92px] w-full resize-y"
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
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
