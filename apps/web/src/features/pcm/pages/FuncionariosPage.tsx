import {
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserCog,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  criarFuncionario,
  desativarFuncionario,
  editarFuncionario,
  listarFuncionarios,
} from "../application/funcionarios";
import type {
  CriarFuncionarioFormData,
  FuncionarioFormData,
  FuncionarioItem,
} from "../domain/funcionarios";
import { supabaseFuncionariosAdapter } from "../infrastructure/supabase-funcionarios-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; funcionarios: FuncionarioItem[] };

type Modal =
  | { modo: "novo"; funcionario?: undefined }
  | { modo: "editar"; funcionario: FuncionarioItem }
  | null;

export function FuncionariosPage() {
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
      setEstado({
        fase: "pronto",
        funcionarios: await listarFuncionarios(supabaseFuncionariosAdapter),
      });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem:
          error instanceof Error ? error.message : "Não foi possível carregar funcionários.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: CriarFuncionarioFormData | FuncionarioFormData) {
    if (!user) return;
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editarFuncionario(supabaseFuncionariosAdapter, {
        ...input,
        id: modal.funcionario.id,
        userId: user.id,
      });
    } else {
      await criarFuncionario(supabaseFuncionariosAdapter, {
        ...(input as CriarFuncionarioFormData),
        userId: user.id,
      });
    }
    setModal(null);
    await carregar();
  }

  async function desativar(funcionario: FuncionarioItem) {
    if (!user) return;
    if (!confirm(`Desativar ${funcionario.nome} para tarefas no Auvo?`)) return;
    try {
      setErroAcao(null);
      await desativarFuncionario(supabaseFuncionariosAdapter, {
        id: funcionario.id,
        userId: user.id,
      });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível desativar.");
    }
  }

  if (permissoesCarregando) {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
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

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">Funcionários</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Técnicos e gestores sincronizados com usuários Auvo
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModal({ modo: "novo" })}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
            >
              <Plus className="h-4 w-4" />
              Novo funcionário
            </button>
          )}
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {estado.funcionarios.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <UserCog className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhum funcionário cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {estado.funcionarios.map((funcionario) => (
            <FuncionarioCard
              key={funcionario.id}
              funcionario={funcionario}
              onEditar={temEscrita ? () => setModal({ modo: "editar", funcionario }) : undefined}
              onDesativar={
                temEscrita && funcionario.ativo ? () => desativar(funcionario) : undefined
              }
            />
          ))}
        </div>
      )}

      {modal && (
        <FuncionarioModal
          funcionario={modal.modo === "editar" ? modal.funcionario : undefined}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}
    </div>
  );
}

function FuncionarioCard({
  funcionario,
  onEditar,
  onDesativar,
}: {
  funcionario: FuncionarioItem;
  onEditar?: () => void;
  onDesativar?: () => void;
}) {
  return (
    <div className="rounded-[8px] border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-ink">{funcionario.nome}</h4>
          <p className="mt-1 text-xs text-ink-3">
            Auvo {funcionario.auvoId ?? "-"} · {labelUserType(funcionario.userType)}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            funcionario.ativo ? "bg-[#E7F6EC] text-[#1E8E45]" : "bg-[#EFF1F4] text-[#5A6175]"
          }`}
        >
          {funcionario.ativo ? "Ativo" : "Inativo"}
        </span>
      </div>
      <p className="mt-3 text-sm text-ink-3">
        {[funcionario.cargo, funcionario.equipe].filter(Boolean).join(" · ") || "Sem cargo/equipe"}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-3">
        {funcionario.telefone && (
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" />
            {funcionario.telefone}
          </span>
        )}
        {funcionario.email && (
          <span className="inline-flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" />
            {funcionario.email}
          </span>
        )}
        <span>Sync: {funcionario.auvoSyncStatus ?? "pending"}</span>
      </div>
      {funcionario.auvoSyncError && (
        <p className="mt-2 text-xs text-[#A23B25]">{funcionario.auvoSyncError}</p>
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

function FuncionarioModal({
  funcionario,
  onCancel,
  onSalvar,
}: {
  funcionario?: FuncionarioItem;
  onCancel: () => void;
  onSalvar: (input: CriarFuncionarioFormData | FuncionarioFormData) => Promise<void>;
}) {
  const [dados, setDados] = useState<CriarFuncionarioFormData>({
    nome: funcionario?.nome ?? "",
    equipe: funcionario?.equipe ?? "",
    cargo: funcionario?.cargo ?? "",
    telefone: funcionario?.telefone ?? "",
    email: funcionario?.email ?? "",
    culture: funcionario?.culture ?? "pt-BR",
    userType: funcionario?.userType ?? 1,
    login: "",
    password: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(
        funcionario
          ? {
              nome: dados.nome,
              equipe: dados.equipe,
              cargo: dados.cargo,
              telefone: dados.telefone,
              email: dados.email,
              culture: dados.culture,
              userType: dados.userType,
            }
          : dados,
      );
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar funcionário.");
    } finally {
      setSalvando(false);
    }
  }

  function setCampo(campo: keyof CriarFuncionarioFormData, valor: string | number) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-3xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">
            {funcionario ? "Editar funcionário" : "Novo funcionário"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
          {!funcionario && (
            <div className="md:col-span-2 rounded-[6px] border border-[#F0D4B0] bg-orange-soft px-3 py-2 text-sm text-[#8A4B00]">
              <span className="inline-flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-4 w-4" />
                Este cadastro cria acesso real ao app Auvo.
              </span>
            </div>
          )}
          <Field label="Nome *" value={dados.nome} onChange={(v) => setCampo("nome", v)} />
          <SelectUserType value={dados.userType} onChange={(v) => setCampo("userType", v)} />
          {!funcionario && (
            <>
              <Field
                label="Login Auvo *"
                value={dados.login}
                onChange={(v) => setCampo("login", v)}
              />
              <Field
                label="Senha Auvo *"
                type="password"
                value={dados.password}
                onChange={(v) => setCampo("password", v)}
              />
            </>
          )}
          <Field label="Cultura" value={dados.culture} onChange={(v) => setCampo("culture", v)} />
          <Field
            label="Equipe"
            value={dados.equipe ?? ""}
            onChange={(v) => setCampo("equipe", v)}
          />
          <Field
            label={funcionario ? "Cargo" : "Cargo *"}
            value={dados.cargo ?? ""}
            onChange={(v) => setCampo("cargo", v)}
          />
          <Field
            label={funcionario ? "Telefone" : "Telefone *"}
            value={dados.telefone ?? ""}
            onChange={(v) => setCampo("telefone", v)}
          />
          <Field
            label={funcionario ? "E-mail" : "E-mail *"}
            value={dados.email ?? ""}
            onChange={(v) => setCampo("email", v)}
          />
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
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-3">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input w-full"
      />
    </label>
  );
}

function SelectUserType({
  value,
  onChange,
}: {
  value: 1 | 2 | 3;
  onChange: (value: 1 | 2 | 3) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-3">Tipo *</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value) as 1 | 2 | 3)}
        className="input w-full"
      >
        <option value={1}>Usuário de campo</option>
        <option value={2}>Gestor de equipe</option>
        <option value={3}>Administrador</option>
      </select>
    </label>
  );
}

function labelUserType(value: 1 | 2 | 3): string {
  if (value === 2) return "Gestor de equipe";
  if (value === 3) return "Administrador";
  return "Usuário de campo";
}
