import { ConfirmDialog, Modal as ModalPrimitivo, Skeleton } from "@sinergica/ui";
import { Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
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
  const [equipeParaDesativar, setEquipeParaDesativar] = useState<EquipeItem | null>(null);

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

  async function desativar() {
    if (!user || !equipeParaDesativar) return;
    await desativarEquipe(supabaseEquipesAdapter, { id: equipeParaDesativar.id, userId: user.id });
    await carregar();
  }

  if (permissoesCarregando || estado.fase === "carregando")
    return (
      <div className="flex flex-col gap-3 p-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    );
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-body text-ink-3">
          Você não tem permissão de leitura no módulo PCM.
        </p>
      </div>
    );
  }
  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-body text-ink-3">{estado.mensagem}</p>
        <button
          type="button"
          onClick={carregar}
          className="mt-4 inline-flex items-center gap-2 text-body font-semibold text-orange hover:text-orange-deep"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-heading font-semibold text-ink">Equipes</h1>
            <p className="mt-0.5 text-body text-ink-3">
              Criação sincronizada com Auvo /teams; edição e exclusão ficam apenas no PCM
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModal({ modo: "novo" })}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-orange px-3 text-body font-semibold text-white hover:bg-orange-deep"
            >
              <Plus className="h-4 w-4" />
              Nova equipe
            </button>
          )}
        </div>
        <div className="mt-3 rounded-md border border-warning-soft bg-warning-soft px-3 py-2 text-body text-warning">
          Alterações em Equipes já sincronizadas não refletem no Auvo. Para mudar participantes lá,
          use o app Auvo.
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erroAcao}
          </div>
        )}
      </section>

      {estado.equipes.length === 0 ? (
        <div className="rounded-lg border border-line bg-card px-5 py-10 text-center">
          <Users className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-body text-ink-3">Nenhuma equipe cadastrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {estado.equipes.map((equipe) => (
            <div key={equipe.id} className="rounded-lg border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-body font-semibold text-ink">{equipe.nome}</h4>
                  <p className="mt-1 text-caption text-ink-3">
                    Auvo {equipe.auvoId ?? "-"} · Sync {equipe.auvoSyncStatus ?? "pending"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-micro font-semibold ${equipe.ativo ? "bg-success-soft text-success" : "bg-line-soft text-ink-2"}`}
                >
                  {equipe.ativo ? "Ativa" : "Inativa"}
                </span>
              </div>
              <p className="mt-3 text-body text-ink-3">
                Participantes: {equipe.participantesNomes.join(", ") || "nenhum"}
              </p>
              <p className="mt-1 text-body text-ink-3">
                Gestores: {equipe.gestoresNomes.join(", ") || "nenhum"}
              </p>
              {equipe.auvoSyncError && (
                <p className="mt-2 text-caption text-danger">{equipe.auvoSyncError}</p>
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
                    onClick={() => setEquipeParaDesativar(equipe)}
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

      <ConfirmDialog
        open={equipeParaDesativar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setEquipeParaDesativar(null);
        }}
        titulo={`Desativar "${equipeParaDesativar?.nome}"`}
        descricao="A exclusão será apenas local no PCM — o histórico não é apagado."
        rotuloConfirmar="Desativar"
        onConfirmar={desativar}
      />
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
    <ModalPrimitivo
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo={equipe ? "Editar equipe local" : "Nova equipe"}
      tamanho="lg"
    >
      <div className="max-h-[70vh] overflow-y-auto">
        {equipe?.auvoId && (
          <div className="mb-3 rounded-md border border-warning-soft bg-warning-soft px-3 py-2 text-body text-warning">
            Esta edição será apenas local no PCM.
          </div>
        )}
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Nome *</span>
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
          <div className="mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-md border border-line px-3 text-body font-semibold text-ink-2 hover:bg-line-soft"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="h-9 rounded-md bg-orange px-3 text-body font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </ModalPrimitivo>
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
      <h4 className="text-caption font-semibold text-ink-3">{titulo}</h4>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {funcionarios.map((funcionario) => (
          <label
            key={funcionario.id}
            className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-body text-ink-2"
          >
            <input
              type="checkbox"
              checked={ids.includes(funcionario.id)}
              onChange={() => onToggle(funcionario.id)}
            />
            <span className="min-w-0 flex-1 truncate">{funcionario.nome}</span>
            <span className="text-caption text-ink-3">Auvo {funcionario.auvoUserId ?? "-"}</span>
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
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-caption font-semibold ${danger ? "border-danger-line text-danger hover:bg-danger-soft" : "border-line text-ink-2 hover:bg-line-soft"}`}
    >
      {icon}
      {label}
    </button>
  );
}
