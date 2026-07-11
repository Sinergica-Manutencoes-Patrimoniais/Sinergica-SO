import { UserRoundCog } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import type { UsuarioConfig } from "../application/config-gateway";
import { criarUsuario } from "../application/criar-usuario";
import { definirPermissaoUsuario } from "../application/definir-permissao-usuario";
import { listarGrupos } from "../application/listar-grupos";
import { listarUsuarios } from "../application/listar-usuarios";
import { ModuloPermissaoGrid } from "../components/ModuloPermissaoGrid";
import type { Grupo, PermissaoModulo } from "../domain/grupo";
import type { ModuloId, NivelAcesso } from "../domain/modulo";
import { supabaseConfigAdapter } from "../infrastructure/supabase-config-adapter";

type PermissoesMap = Partial<Record<ModuloId, NivelAcesso>>;

function paraMapa(permissoes: PermissaoModulo[]): PermissoesMap {
  const mapa: PermissoesMap = {};
  for (const p of permissoes) mapa[p.modulo] = p.nivel;
  return mapa;
}

function paraLista(mapa: PermissoesMap): PermissaoModulo[] {
  return (Object.entries(mapa) as Array<[ModuloId, NivelAcesso | undefined]>)
    .filter((entry): entry is [ModuloId, NivelAcesso] => entry[1] !== undefined)
    .map(([modulo, nivel]) => ({ modulo, nivel }));
}

// Não importa Papel de features/auth/domain/role — features de domínios diferentes não se
// importam (CLAUDE.md). Duplica só os 4 literais, mesmo padrão de MODULO_LABELS no
// ModuloPermissaoGrid.
const PAPEIS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "superadmin", label: "Superadmin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "colaborador", label: "Colaborador" },
  { value: "cliente-sindico", label: "Cliente-síndico" },
];

const PAPEL_LABEL: Record<string, string> = Object.fromEntries(
  PAPEIS.map((p) => [p.value, p.label]),
);

interface FormCriacao {
  email: string;
  senha: string;
  nome: string;
  papel: string;
  modoTipo: "grupo" | "individual";
  grupoId: string;
  permissoes: PermissoesMap;
}

const FORM_VAZIO: FormCriacao = {
  email: "",
  senha: "",
  nome: "",
  papel: "colaborador",
  modoTipo: "individual",
  grupoId: "",
  permissoes: {},
};

interface FormModo {
  modoTipo: "grupo" | "individual";
  grupoId: string;
  permissoes: PermissoesMap;
}

function descreverModo(usuario: UsuarioConfig): string {
  if (usuario.modo.tipo === "grupo") {
    return `Grupo — ${usuario.modo.grupoNome ?? "desconhecido"}`;
  }
  const n = usuario.modo.permissoes.length;
  return n === 0
    ? "Individual — sem acesso a módulos"
    : `Individual — ${n} módulo${n === 1 ? "" : "s"}`;
}

export function UsuariosPage() {
  const { user } = useAuth();
  const papeisDisponiveis =
    user?.papel === "superadmin" ? PAPEIS : PAPEIS.filter((p) => p.value !== "superadmin");

  const [usuarios, setUsuarios] = useState<UsuarioConfig[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState<FormCriacao>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formModo, setFormModo] = useState<FormModo | null>(null);
  const [salvandoModo, setSalvandoModo] = useState(false);
  const [erroModo, setErroModo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [listaUsuarios, listaGrupos] = await Promise.all([
        listarUsuarios(supabaseConfigAdapter),
        listarGrupos(supabaseConfigAdapter),
      ]);
      setUsuarios(listaUsuarios);
      setGrupos(listaGrupos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os usuários.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirCriacao() {
    setForm({
      ...FORM_VAZIO,
      papel: papeisDisponiveis[papeisDisponiveis.length - 1]?.value ?? "colaborador",
    });
    setErroForm(null);
    setCriando(true);
  }

  function alterarPermissaoCriacao(modulo: ModuloId, nivel: NivelAcesso | null) {
    setForm((f) => {
      const permissoes = { ...f.permissoes };
      if (nivel === null) delete permissoes[modulo];
      else permissoes[modulo] = nivel;
      return { ...f, permissoes };
    });
  }

  async function salvarCriacao() {
    setSalvando(true);
    setErroForm(null);
    try {
      await criarUsuario(supabaseConfigAdapter, {
        email: form.email,
        senha: form.senha,
        nome: form.nome,
        papel: form.papel,
        modo:
          form.modoTipo === "grupo"
            ? { tipo: "grupo", grupoId: form.grupoId }
            : { tipo: "individual", permissoes: paraLista(form.permissoes) },
      });
      setCriando(false);
      await carregar();
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : "Não foi possível criar o usuário.");
    } finally {
      setSalvando(false);
    }
  }

  function abrirTrocaModo(usuario: UsuarioConfig) {
    setEditandoId(usuario.userId);
    setErroModo(null);
    setFormModo(
      usuario.modo.tipo === "grupo"
        ? { modoTipo: "grupo", grupoId: usuario.modo.grupoId, permissoes: {} }
        : { modoTipo: "individual", grupoId: "", permissoes: paraMapa(usuario.modo.permissoes) },
    );
  }

  function fecharTrocaModo() {
    setEditandoId(null);
    setFormModo(null);
  }

  function alterarPermissaoModo(modulo: ModuloId, nivel: NivelAcesso | null) {
    setFormModo((f) => {
      if (!f) return f;
      const permissoes = { ...f.permissoes };
      if (nivel === null) delete permissoes[modulo];
      else permissoes[modulo] = nivel;
      return { ...f, permissoes };
    });
  }

  async function salvarModo() {
    if (!editandoId || !formModo) return;
    setSalvandoModo(true);
    setErroModo(null);
    try {
      await definirPermissaoUsuario(
        supabaseConfigAdapter,
        editandoId,
        formModo.modoTipo === "grupo"
          ? { tipo: "grupo", grupoId: formModo.grupoId }
          : { tipo: "individual", permissoes: paraLista(formModo.permissoes) },
      );
      fecharTrocaModo();
      await carregar();
    } catch (e) {
      setErroModo(e instanceof Error ? e.message : "Não foi possível atualizar a permissão.");
    } finally {
      setSalvandoModo(false);
    }
  }

  const editandoUsuario = editandoId ? usuarios.find((u) => u.userId === editandoId) : null;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2 className="page-title">Usuários</h2>
          <p className="page-subtitle">Contas com acesso ao Sinérgica SO.</p>
        </div>
        <button type="button" onClick={abrirCriacao} className="btn-accent">
          Novo usuário
        </button>
      </div>

      {erro && <p className="status-error">{erro}</p>}

      {carregando ? (
        <div
          className="surface-card h-24 animate-pulse bg-line-soft"
          aria-label="Carregando usuários"
        />
      ) : usuarios.length === 0 ? (
        <div className="empty-state">
          <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-line-soft text-ink-3">
            <UserRoundCog className="h-5 w-5" />
          </span>
          <p className="font-semibold text-ink-2">Nenhum usuário cadastrado</p>
          <p className="mt-1 max-w-sm">Adicione a primeira conta e defina seu nível de acesso.</p>
        </div>
      ) : (
        <div className="surface-card divide-y divide-line-soft">
          {usuarios.map((usuario) => (
            <div key={usuario.userId} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink truncate">{usuario.nome}</p>
                  {!usuario.ativo && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EFF1F4] text-[#5A6175]">
                      Inativo
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-3 mt-0.5">
                  {PAPEL_LABEL[usuario.papel] ?? usuario.papel} · {descreverModo(usuario)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => abrirTrocaModo(usuario)}
                className="text-xs font-semibold text-orange hover:text-orange-deep cursor-pointer shrink-0"
              >
                Trocar permissão
              </button>
            </div>
          ))}
        </div>
      )}

      {criando && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-lg p-4 sm:p-5 flex flex-col gap-4">
            <h3 className="text-base font-semibold text-ink">Novo usuário</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label
                  htmlFor="usuario-nome"
                  className="block text-sm font-medium text-ink-2 mb-1.5"
                >
                  Nome
                </label>
                <input
                  id="usuario-nome"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  className="input"
                />
              </div>
              <div className="col-span-2">
                <label
                  htmlFor="usuario-email"
                  className="block text-sm font-medium text-ink-2 mb-1.5"
                >
                  E-mail
                </label>
                <input
                  id="usuario-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label
                  htmlFor="usuario-senha"
                  className="block text-sm font-medium text-ink-2 mb-1.5"
                >
                  Senha
                </label>
                <input
                  id="usuario-senha"
                  type="password"
                  value={form.senha}
                  onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                  placeholder="mín. 8 caracteres"
                  className="input"
                />
              </div>
              <div>
                <label
                  htmlFor="usuario-papel"
                  className="block text-sm font-medium text-ink-2 mb-1.5"
                >
                  Papel
                </label>
                <select
                  id="usuario-papel"
                  value={form.papel}
                  onChange={(e) => setForm((f) => ({ ...f, papel: e.target.value }))}
                  className="input"
                >
                  {papeisDisponiveis.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="block text-sm font-medium text-ink-2 mb-1.5">Modo de permissão</p>
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-1.5 text-sm text-ink-2">
                  <input
                    type="radio"
                    name="modo-criacao"
                    checked={form.modoTipo === "individual"}
                    onChange={() => setForm((f) => ({ ...f, modoTipo: "individual" }))}
                  />
                  Individual
                </label>
                <label className="flex items-center gap-1.5 text-sm text-ink-2">
                  <input
                    type="radio"
                    name="modo-criacao"
                    checked={form.modoTipo === "grupo"}
                    onChange={() => setForm((f) => ({ ...f, modoTipo: "grupo" }))}
                  />
                  Grupo pré-criado
                </label>
              </div>

              {form.modoTipo === "grupo" ? (
                <select
                  value={form.grupoId}
                  onChange={(e) => setForm((f) => ({ ...f, grupoId: e.target.value }))}
                  className="input"
                >
                  <option value="">Selecione um grupo…</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <ModuloPermissaoGrid
                  permissoes={form.permissoes}
                  onChange={alterarPermissaoCriacao}
                />
              )}
            </div>

            {erroForm && <p className="status-error">{erroForm}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCriando(false)} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarCriacao}
                disabled={salvando}
                className="btn-accent"
              >
                {salvando ? "Criando…" : "Criar usuário"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editandoId && formModo && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-lg p-4 sm:p-5 flex flex-col gap-4">
            <h3 className="text-base font-semibold text-ink">
              Trocar permissão — {editandoUsuario?.nome ?? ""}
            </h3>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm text-ink-2">
                <input
                  type="radio"
                  name="modo-edicao"
                  checked={formModo.modoTipo === "individual"}
                  onChange={() => setFormModo((f) => (f ? { ...f, modoTipo: "individual" } : f))}
                />
                Individual
              </label>
              <label className="flex items-center gap-1.5 text-sm text-ink-2">
                <input
                  type="radio"
                  name="modo-edicao"
                  checked={formModo.modoTipo === "grupo"}
                  onChange={() => setFormModo((f) => (f ? { ...f, modoTipo: "grupo" } : f))}
                />
                Grupo pré-criado
              </label>
            </div>

            {formModo.modoTipo === "grupo" ? (
              <select
                value={formModo.grupoId}
                onChange={(e) => setFormModo((f) => (f ? { ...f, grupoId: e.target.value } : f))}
                className="input"
              >
                <option value="">Selecione um grupo…</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </select>
            ) : (
              <ModuloPermissaoGrid
                permissoes={formModo.permissoes}
                onChange={alterarPermissaoModo}
              />
            )}

            {erroModo && <p className="status-error">{erroModo}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={fecharTrocaModo} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarModo}
                disabled={salvandoModo}
                className="btn-accent"
              >
                {salvandoModo ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
