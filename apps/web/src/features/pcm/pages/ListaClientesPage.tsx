import {
  Building2,
  ClipboardList,
  Filter,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import type { ClienteFormData, ClienteResumo } from "../application/cliente-360-gateway";
import { criarCliente, editarCliente, excluirCliente } from "../application/clientes-crud";
import { listarClientes } from "../application/listar-clientes";
import { rotuloOuPlaceholder } from "../domain/cliente-360";
import { supabaseCliente360Adapter } from "../infrastructure/supabase-cliente-360-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro" }
  | { fase: "pronto"; clientes: ClienteResumo[] };

type FiltroStatus = "todos" | "ativo" | "inativo";
type FiltroTipo = "todos" | "cliente" | "lead";
type FiltroOperacao = "todos" | "com_ativos" | "com_backlog" | "sem_contato" | "incompleto";
type Ordenacao = "nome" | "atividade" | "ativos" | "backlog" | "gut";

const STATUS_COMERCIAL_LABEL: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  prospecto: "Prospecto",
};

export function ListaClientesPage({
  onSelecionar,
}: {
  onSelecionar: (clienteId: string) => void;
}) {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<FiltroStatus>("todos");
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [operacao, setOperacao] = useState<FiltroOperacao>("todos");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("atividade");
  const [modal, setModal] = useState<
    { modo: "novo" } | { modo: "editar"; cliente: ClienteResumo } | null
  >(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temAcesso = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const clientes = await listarClientes(supabaseCliente360Adapter);
      setEstado({ fase: "pronto", clientes });
    } catch {
      setEstado({ fase: "erro" });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temAcesso) carregar();
  }, [permissoesCarregando, temAcesso, carregar]);

  const clientes = estado.fase === "pronto" ? estado.clientes : [];
  const termo = normalizar(busca);
  const clientesFiltrados = useMemo(() => {
    return clientes
      .filter((cliente) => {
        if (status !== "todos" && (status === "ativo") !== cliente.ativo) return false;
        if (tipo !== "todos" && cliente.tipo !== tipo) return false;
        if (operacao === "com_ativos" && (cliente.equipamentosAtivos ?? 0) === 0) return false;
        if (operacao === "com_backlog" && (cliente.osAbertas ?? 0) === 0) return false;
        if (
          operacao === "sem_contato" &&
          (cliente.contatoTelefone || cliente.contatoEmail || cliente.contatoNome)
        ) {
          return false;
        }
        if (operacao === "incompleto" && cliente.cadastroCompleto) return false;
        if (!termo) return true;

        return [
          cliente.nome,
          cliente.cnpj,
          cliente.endereco,
          cliente.cidade,
          cliente.estado,
          cliente.cep,
          cliente.contatoNome,
          cliente.contatoTelefone,
          cliente.contatoEmail,
          cliente.statusComercial,
          cliente.auvoId ? String(cliente.auvoId) : null,
        ]
          .filter(Boolean)
          .some((valor) => normalizar(String(valor)).includes(termo));
      })
      .sort((a, b) => compararClientes(a, b, ordenacao));
  }, [clientes, termo, status, tipo, operacao, ordenacao]);

  const metricas = useMemo(() => montarMetricas(clientes), [clientes]);
  const filtrosAtivos =
    Boolean(busca.trim()) ||
    status !== "todos" ||
    tipo !== "todos" ||
    operacao !== "todos" ||
    ordenacao !== "atividade";

  function limparFiltros() {
    setBusca("");
    setStatus("todos");
    setTipo("todos");
    setOperacao("todos");
    setOrdenacao("atividade");
  }

  async function salvarCliente(dados: ClienteFormData) {
    if (!user) return;
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editarCliente(supabaseCliente360Adapter, {
        ...dados,
        id: modal.cliente.id,
        userId: user.id,
      });
    } else {
      await criarCliente(supabaseCliente360Adapter, { ...dados, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function excluir(cliente: ClienteResumo) {
    if (!user) return;
    if (!confirm(`Excluir ${cliente.nome}? Clientes com OS aberta serão bloqueados.`)) return;
    try {
      setErroAcao(null);
      await excluirCliente(supabaseCliente360Adapter, { id: cliente.id, userId: user.id });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível excluir o cliente.");
    }
  }

  if (permissoesCarregando) {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }

  if (!temAcesso) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="text-sm text-ink-3 mt-1">
          Você não tem permissão de leitura no módulo PCM para ver esta tela.
        </p>
      </div>
    );
  }

  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }

  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="text-sm text-ink-3 mt-1">Não foi possível carregar a lista de clientes.</p>
        <button
          type="button"
          onClick={carregar}
          className="mt-4 text-sm font-semibold text-orange hover:text-orange-deep cursor-pointer"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">Clientes</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Carteira PCM enriquecida por Auvo, OS, inspeções e ativos de campo
            </p>
          </div>
          <div className="flex flex-col gap-3 xl:items-end">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[620px]">
              <ResumoCarteira label="Clientes" value={String(metricas.total)} />
              <ResumoCarteira label="Ativos Auvo" value={String(metricas.ativos)} />
              <ResumoCarteira label="OS abertas" value={String(metricas.osAbertas)} />
              <ResumoCarteira label="Incompletos" value={String(metricas.incompletos)} />
            </div>
            {temEscrita && (
              <button
                type="button"
                onClick={() => setModal({ modo: "novo" })}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
              >
                <Plus className="h-4 w-4" />
                Novo cliente
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,1fr)_repeat(4,170px)_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              className="input w-full"
              style={{ paddingLeft: "2.25rem" }}
              placeholder="Buscar por cliente, cidade, contato, CNPJ ou ID Auvo"
            />
          </div>

          <SelectFiltro
            label="Status"
            value={status}
            onChange={(valor) => setStatus(valor as FiltroStatus)}
            options={[
              ["todos", "Todos"],
              ["ativo", "Ativos"],
              ["inativo", "Inativos"],
            ]}
          />
          <SelectFiltro
            label="Tipo"
            value={tipo}
            onChange={(valor) => setTipo(valor as FiltroTipo)}
            options={[
              ["todos", "Todos"],
              ["cliente", "Clientes"],
              ["lead", "Leads"],
            ]}
          />
          <SelectFiltro
            label="Operação"
            value={operacao}
            onChange={(valor) => setOperacao(valor as FiltroOperacao)}
            options={[
              ["todos", "Todos"],
              ["com_ativos", "Com ativos"],
              ["com_backlog", "Com backlog"],
              ["sem_contato", "Sem contato"],
              ["incompleto", "Incompleto"],
            ]}
          />
          <SelectFiltro
            label="Ordenar"
            value={ordenacao}
            onChange={(valor) => setOrdenacao(valor as Ordenacao)}
            options={[
              ["atividade", "Atividade"],
              ["nome", "Nome"],
              ["ativos", "Ativos"],
              ["backlog", "Backlog"],
              ["gut", "GUT"],
            ]}
          />

          <button
            type="button"
            onClick={limparFiltros}
            disabled={!filtrosAtivos}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-45"
          >
            <X className="h-4 w-4" />
            Limpar
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-ink-3">
          <Filter className="h-3.5 w-3.5" />
          {clientesFiltrados.length} de {clientes.length} cadastro(s) visíveis
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {clientes.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <Building2 className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhum cliente cadastrado</p>
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center text-sm text-ink-3">
          Nenhum cliente encontrado para os filtros atuais.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {clientesFiltrados.map((cliente) => (
            <ClienteCard
              key={cliente.id}
              cliente={cliente}
              onSelecionar={onSelecionar}
              onEditar={temEscrita ? () => setModal({ modo: "editar", cliente }) : undefined}
              onExcluir={temEscrita ? () => excluir(cliente) : undefined}
            />
          ))}
        </div>
      )}
      {modal && (
        <ClienteFormModal
          cliente={modal.modo === "editar" ? modal.cliente : undefined}
          onCancel={() => setModal(null)}
          onSalvar={salvarCliente}
        />
      )}
    </div>
  );
}

function ClienteCard({
  cliente,
  onSelecionar,
  onEditar,
  onExcluir,
}: {
  cliente: ClienteResumo;
  onSelecionar: (clienteId: string) => void;
  onEditar?: () => void;
  onExcluir?: () => void;
}) {
  const local = [cliente.cidade, cliente.estado].filter(Boolean).join(" — ");
  const score = cliente.maiorScorePcm ?? 0;
  const contato = cliente.contatoTelefone ?? cliente.contatoEmail ?? cliente.contatoNome;

  return (
    <div className="rounded-[8px] border border-line bg-card p-4 text-left transition-colors hover:border-orange/60 hover:bg-orange-soft/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-ink">{cliente.nome}</p>
            <Badge tone={cliente.ativo ? "success" : "neutral"}>
              {cliente.ativo ? "Ativo" : "Inativo"}
            </Badge>
            {cliente.tipo && (
              <Badge tone="neutral">{cliente.tipo === "lead" ? "Lead" : "Cliente"}</Badge>
            )}
            {cliente.statusComercial && (
              <Badge tone={cliente.statusComercial === "ativo" ? "success" : "warning"}>
                {STATUS_COMERCIAL_LABEL[cliente.statusComercial] ?? cliente.statusComercial}
              </Badge>
            )}
            {!cliente.cadastroCompleto && <Badge tone="warning">Cadastro incompleto</Badge>}
          </div>
          <p className="mt-1 text-xs tabular-nums text-ink-3">
            CNPJ: {rotuloOuPlaceholder(cliente.cnpj, "—")} · Auvo{" "}
            {rotuloOuPlaceholder(cliente.auvoId ?? null, "—")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-brand text-xl font-bold leading-none text-ink tabular-nums">
            {cliente.equipamentosAtivos ?? 0}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
            ativos
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniIndicador
          icon={ClipboardList}
          label="OS abertas"
          value={String(cliente.osAbertas ?? 0)}
        />
        <MiniIndicador
          icon={Package}
          label="Ativos Auvo"
          value={String(cliente.equipamentosAtivos ?? 0)}
        />
        <MiniIndicador
          icon={UserCheck}
          label="Maior GUT"
          value={String(score)}
          destaque={score >= 80}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-3">
        {local && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {local}
          </span>
        )}
        {contato && (
          <span className="inline-flex items-center gap-1">
            {cliente.contatoEmail ? (
              <Mail className="h-3.5 w-3.5" />
            ) : (
              <Phone className="h-3.5 w-3.5" />
            )}
            {contato}
          </span>
        )}
        <span>Última atividade: {formatarDataCurta(cliente.ultimaAtividadeEm)}</span>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => onSelecionar(cliente.id)}
          className="inline-flex h-8 items-center justify-center rounded-[6px] border border-line px-3 text-xs font-semibold text-ink-2 hover:bg-line-soft"
        >
          Ver 360
        </button>
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

function ClienteFormModal({
  cliente,
  onCancel,
  onSalvar,
}: {
  cliente?: ClienteResumo;
  onCancel: () => void;
  onSalvar: (dados: ClienteFormData) => Promise<void>;
}) {
  const [dados, setDados] = useState<ClienteFormData>({
    nome: cliente?.nome ?? "",
    cnpj: cliente?.cnpj ?? "",
    endereco: cliente?.endereco ?? "",
    cidade: cliente?.cidade ?? "",
    estado: cliente?.estado ?? "",
    cep: cliente?.cep ?? "",
    contatoNome: cliente?.contatoNome ?? "",
    contatoTelefone: cliente?.contatoTelefone ?? "",
    contatoEmail: cliente?.contatoEmail ?? "",
    observacoes: cliente?.observacoes ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(dados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o cliente.");
    } finally {
      setSalvando(false);
    }
  }

  function setCampo(campo: keyof ClienteFormData, valor: string) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-3xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold text-ink">
            {cliente ? "Editar cliente" : "Novo cliente"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto p-5 md:grid-cols-2">
          <Field label="Nome *" value={dados.nome} onChange={(v) => setCampo("nome", v)} />
          <Field label="CNPJ/CPF" value={dados.cnpj ?? ""} onChange={(v) => setCampo("cnpj", v)} />
          <Field
            label="Endereço"
            value={dados.endereco ?? ""}
            onChange={(v) => setCampo("endereco", v)}
            className="md:col-span-2"
          />
          <Field
            label="Cidade"
            value={dados.cidade ?? ""}
            onChange={(v) => setCampo("cidade", v)}
          />
          <Field
            label="Estado"
            value={dados.estado ?? ""}
            onChange={(v) => setCampo("estado", v)}
          />
          <Field label="CEP" value={dados.cep ?? ""} onChange={(v) => setCampo("cep", v)} />
          <Field
            label="Contato"
            value={dados.contatoNome ?? ""}
            onChange={(v) => setCampo("contatoNome", v)}
          />
          <Field
            label="Telefone"
            value={dados.contatoTelefone ?? ""}
            onChange={(v) => setCampo("contatoTelefone", v)}
          />
          <Field
            label="E-mail"
            value={dados.contatoEmail ?? ""}
            onChange={(v) => setCampo("contatoEmail", v)}
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
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-ink-3">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input w-full"
      />
    </label>
  );
}

function ResumoCarteira({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] border border-line-soft px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</p>
      <p className="mt-1 font-brand text-xl font-bold text-ink tabular-nums">{value}</p>
    </div>
  );
}

function SelectFiltro({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input h-10 w-full bg-card"
        aria-label={label}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function MiniIndicador({
  icon: Icon,
  label,
  value,
  destaque = false,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-[6px] border border-line-soft px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate">{label}</span>
      </div>
      <p
        className={`mt-1 font-brand text-lg font-bold tabular-nums ${destaque ? "text-orange" : "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Badge({ tone, children }: { tone: "success" | "warning" | "neutral"; children: string }) {
  const classes = {
    success: "bg-[#E7F6EC] text-[#1E8E45]",
    warning: "bg-[#FDF1DF] text-[#B26A00]",
    neutral: "bg-[#EFF1F4] text-[#5A6175]",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${classes[tone]}`}
    >
      {children}
    </span>
  );
}

function montarMetricas(clientes: ClienteResumo[]) {
  return {
    total: clientes.length,
    ativos: clientes.reduce((acc, cliente) => acc + (cliente.equipamentosAtivos ?? 0), 0),
    osAbertas: clientes.reduce((acc, cliente) => acc + (cliente.osAbertas ?? 0), 0),
    incompletos: clientes.filter((cliente) => !cliente.cadastroCompleto).length,
  };
}

function compararClientes(a: ClienteResumo, b: ClienteResumo, ordenacao: Ordenacao): number {
  if (ordenacao === "ativos") {
    return (
      (b.equipamentosAtivos ?? 0) - (a.equipamentosAtivos ?? 0) || a.nome.localeCompare(b.nome)
    );
  }
  if (ordenacao === "backlog") {
    return (b.osAbertas ?? 0) - (a.osAbertas ?? 0) || a.nome.localeCompare(b.nome);
  }
  if (ordenacao === "gut") {
    return (b.maiorScorePcm ?? 0) - (a.maiorScorePcm ?? 0) || a.nome.localeCompare(b.nome);
  }
  if (ordenacao === "atividade") {
    return (
      (Date.parse(b.ultimaAtividadeEm ?? "") || 0) - (Date.parse(a.ultimaAtividadeEm ?? "") || 0) ||
      a.nome.localeCompare(b.nome)
    );
  }
  return a.nome.localeCompare(b.nome);
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function formatarDataCurta(data: string | null | undefined): string {
  if (!data) return "—";
  const parsed = new Date(data);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(parsed);
}
