import { Pencil, Plus, RefreshCw, Trash2, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  criarEquipe,
  desativarEquipe,
  editarEquipe,
  listarEquipes,
  listarFuncionariosEquipe,
} from "../application/equipes";
import type { EquipeFormData, EquipeFuncionarioOpcao, EquipeItem } from "../domain/equipes";
import { supabaseEquipesAdapter } from "../infrastructure/supabase-equipes-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; equipes: EquipeItem[]; funcionarios: EquipeFuncionarioOpcao[] };

type Modal = { modo: "novo"; equipe?: undefined } | { modo: "editar"; equipe: EquipeItem } | null;

export function EquipesPage() {
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
      const [equipes, funcionarios] = await Promise.all([
        listarEquipes(supabaseEquipesAdapter),
        listarFuncionariosEquipe(supabaseEquipesAdapter),
      ]);
      setEstado({ fase: "pronto", equipes, funcionarios });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar equipes.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: EquipeFormData) {
    if (!user) return;
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editarEquipe(supabaseEquipesAdapter, {
        ...input,
        id: modal.equipe.id,
        userId: user.id,
      });
    } else {
      await criarEquipe(supabaseEquipesAdapter, { ...input, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function desativar(equipe: EquipeItem) {
    if (!user || !confirm(`Desativar ${equipe.nome}? A exclusão será apenas local no PCM.`)) return;
    try {
      setErroAcao(null);
      await desativarEquipe(supabaseEquipesAdapter, { id: equipe.id, userId: user.id });
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
            <h3 className="text-lg font-semibold text-ink">Equipes</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Criação sincronizada com Auvo /teams; edição e exclusão ficam apenas no PCM
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModal({ modo: "novo" })}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
            >
              <Plus className="h-4 w-4" />
              Nova equipe
            </button>
          )}
        </div>
        <div className="mt-3 rounded-[6px] border border-[#F4D28C] bg-[#FFF8E8] px-3 py-2 text-sm text-[#7A4D00]">
          Alterações em Equipes já sincronizadas não refletem no Auvo. Para mudar participantes lá,
          use o app Auvo.
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {estado.equipes.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <Users className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhuma equipe cadastrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {estado.equipes.map((equipe) => (
            <div key={equipe.id} className="rounded-[8px] border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold text-ink">{equipe.nome}</h4>
                  <p className="mt-1 text-xs text-ink-3">
                    Auvo {equipe.auvoId ?? "-"} · Sync {equipe.auvoSyncStatus ?? "pending"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${equipe.ativo ? "bg-[#E7F6EC] text-[#1E8E45]" : "bg-[#EFF1F4] text-[#5A6175]"}`}
                >
                  {equipe.ativo ? "Ativa" : "Inativa"}
                </span>
              </div>
              <p className="mt-3 text-sm text-ink-3">
                Participantes: {equipe.participantesNomes.join(", ") || "nenhum"}
              </p>
              <p className="mt-1 text-sm text-ink-3">
                Gestores: {equipe.gestoresNomes.join(", ") || "nenhum"}
              </p>
              {equipe.auvoSyncError && (
                <p className="mt-2 text-xs text-[#A23B25]">{equipe.auvoSyncError}</p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                {temEscrita && (
                  <IconButton
                    label="Editar local"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => setModal({ modo: "editar", equipe })}
                  />
                )}
                {temEscrita && equipe.ativo && (
                  <IconButton
                    label="Desativar local"
                    danger
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => desativar(equipe)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <EquipeModal
          equipe={modal.modo === "editar" ? modal.equipe : undefined}
          funcionarios={estado.funcionarios}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}
    </div>
  );
}

function EquipeModal({
  equipe,
  funcionarios,
  onCancel,
  onSalvar,
}: {
  equipe?: EquipeItem;
  funcionarios: EquipeFuncionarioOpcao[];
  onCancel: () => void;
  onSalvar: (input: EquipeFormData) => Promise<void>;
}) {
  const [dados, setDados] = useState<EquipeFormData>({
    nome: equipe?.nome ?? "",
    participanteIds: funcionarios
      .filter((f) => equipe?.participantesAuvoIds.includes(f.auvoUserId ?? -1))
      .map((f) => f.id),
    gestorIds: funcionarios
      .filter((f) => equipe?.gestoresAuvoIds.includes(f.auvoUserId ?? -1))
      .map((f) => f.id),
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(dados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar equipe.");
    } finally {
      setSalvando(false);
    }
  }

  function toggle(campo: "participanteIds" | "gestorIds", id: string) {
    setDados((atual) => {
      const set = new Set(atual[campo]);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...atual, [campo]: [...set] };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-2xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold text-ink">
            {equipe ? "Editar equipe local" : "Nova equipe"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {equipe?.auvoId && (
            <div className="mb-3 rounded-[6px] border border-[#F4D28C] bg-[#FFF8E8] px-3 py-2 text-sm text-[#7A4D00]">
              Esta edição será apenas local no PCM.
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Nome *</span>
            <input
              value={dados.nome}
              onChange={(event) => setDados((a) => ({ ...a, nome: event.target.value }))}
              className="input w-full"
            />
          </label>
          <Checklist
            titulo="Participantes"
            ids={dados.participanteIds}
            funcionarios={funcionarios}
            onToggle={(id) => toggle("participanteIds", id)}
          />
          <Checklist
            titulo="Gestores"
            ids={dados.gestorIds}
            funcionarios={funcionarios}
            onToggle={(id) => toggle("gestorIds", id)}
          />
          {erro && (
            <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
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

function Checklist({
  titulo,
  ids,
  funcionarios,
  onToggle,
}: {
  titulo: string;
  ids: string[];
  funcionarios: EquipeFuncionarioOpcao[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-ink-3">{titulo}</h4>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {funcionarios.map((funcionario) => (
          <label
            key={funcionario.id}
            className="flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm text-ink-2"
          >
            <input
              type="checkbox"
              checked={ids.includes(funcionario.id)}
              onChange={() => onToggle(funcionario.id)}
            />
            <span className="min-w-0 flex-1 truncate">{funcionario.nome}</span>
            <span className="text-xs text-ink-3">Auvo {funcionario.auvoUserId ?? "-"}</span>
          </label>
        ))}
      </div>
    </div>
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
