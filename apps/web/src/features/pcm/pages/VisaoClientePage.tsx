// Página da Visão 360 do Cliente (E01-S12) — sub-tela read-only do PCM.
// Recebe `clienteId` por prop (o app ainda não tem roteamento por id — ver OPEN-QUESTION #3 em
// tasks.md; a página é testável/integrável isoladamente). Orquestra o gate AC-1 + o caso de uso.
//
// A tela não grava cadastro nem operação localmente: dados de cliente são governados pelo Auvo e
// OS/qualidade continuam nas telas de origem. A ação de edição só leva o usuário para o alvo.
import { Button, Skeleton } from "@sinergica/ui";
import {
  Activity,
  Briefcase,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Copy,
  DollarSign,
  ExternalLink,
  FolderTree,
  Layers,
  LayoutGrid,
  Link2,
  MessageCircle,
  Package,
  Pencil,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { useFormularioSujo } from "../../../app/use-formulario-sujo";
import { supabaseConfigAdapter } from "../../config/infrastructure/supabase-config-adapter";
import type {
  AssessmentClienteResumo,
  Cliente360Evento,
  Cliente360Metricas,
  ClienteHeader,
  GrupoClienteResumo,
  OrdemServicoResumo,
  QualidadeClienteResumo,
  ResultadoEquipamentos,
} from "../application/cliente-360-gateway";
import { obterAlma, salvarAlma } from "../application/cliente-alma";
import {
  criarResponsavel,
  editarResponsavel,
  listarResponsaveis,
  removerResponsavel,
} from "../application/cliente-responsaveis";
import { editarCliente } from "../application/clientes-crud";
import {
  alocarFerramenta,
  devolverFerramenta,
  listarAlocacoesCliente,
  listarFerramentasDisponiveis,
} from "../application/ferramenta-alocacao-cliente";
import { type VisaoCliente, obterVisaoCliente } from "../application/obter-visao-cliente";
import { BoardAtivos } from "../components/BoardAtivos";
import { CabecalhoCliente } from "../components/CabecalhoCliente";
import { ClienteFormModal } from "../components/ClienteFormModal";
import { ClienteNaoEncontrado } from "../components/ClienteNaoEncontrado";
import { PainelBacklog } from "../components/PainelBacklog";
import { PainelEquipamentos } from "../components/PainelEquipamentos";
import { PainelHistorico } from "../components/PainelHistorico";
import { PainelItensDoCliente } from "../components/PainelItensDoCliente";
import { PainelSistemasCliente } from "../components/PainelSistemasCliente";
import { MOTIVO_ASSESSMENT_LABEL } from "../domain/assessment";
import {
  PREFERENCIAS_CONTATO,
  type PreferenciaContato,
  type ResponsavelCliente,
} from "../domain/cliente-responsaveis";
import type { AlocacaoFerramentaCliente } from "../domain/ferramenta-alocacao-cliente";
import { supabaseCliente360Adapter } from "../infrastructure/supabase-cliente-360-adapter";
import { supabaseClienteAlmaAdapter } from "../infrastructure/supabase-cliente-alma-adapter";
import { supabaseClienteResponsaveisAdapter } from "../infrastructure/supabase-cliente-responsaveis-adapter";
import { supabaseFerramentaAlocacaoClienteAdapter } from "../infrastructure/supabase-ferramenta-alocacao-cliente-adapter";
import { EstruturaClientePage } from "./EstruturaClientePage";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; visao: VisaoCliente };

type Aba360 =
  | "resumo"
  | "timeline"
  | "os"
  | "qualidade"
  | "assessment"
  | "ativos"
  | "estrutura"
  | "sistemas"
  | "board"
  | "financeiro"
  | "comercial"
  | "comunicacao";

// E01-S111: rótulos de exibição da preferência de contato de um responsável do cliente.
const PREFERENCIA_CONTATO_LABEL: Record<PreferenciaContato, string> = {
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  email: "E-mail",
  outro: "Outro",
};

const ABAS: Array<{ id: Aba360; label: string; icon: LucideIcon }> = [
  { id: "resumo", label: "Resumo", icon: Activity },
  { id: "timeline", label: "Timeline", icon: RefreshCw },
  { id: "os", label: "OS", icon: ClipboardList },
  { id: "qualidade", label: "Inspeções", icon: Calendar },
  // E01-S90 AC-4: assessment vigente do cliente (documento de estado, distinto de Inspeções ABNT).
  { id: "assessment", label: "Assessment", icon: ClipboardCheck },
  { id: "ativos", label: "Ativos", icon: Layers },
  // E01-S76: Área>Local (árvore) — onde os Itens estão instalados.
  { id: "estrutura", label: "Estrutura", icon: FolderTree },
  // E01-S86 AC-2: compor Sistema (checkbox+filtro), mesmo componente do PCM.
  { id: "sistemas", label: "Sistemas", icon: Link2 },
  // E01-S78: board visual dos ativos por Local (fase 1 do "mapa do andar").
  { id: "board", label: "Board", icon: LayoutGrid },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  // E03-S01 AC-9: funil da Conta. Só aparece quando o shell injeta `painelComercial` — sem o
  // módulo Comercial, a aba nem existe.
  { id: "comercial", label: "Comercial", icon: Briefcase },
  { id: "comunicacao", label: "Comunicação", icon: MessageCircle },
];

export function VisaoClientePage({
  clienteId,
  onAbrirOs,
  periodo,
  painelComercial,
}: {
  clienteId: string;
  onAbrirOs?: (osId: string) => void;
  /** E03-S01 AC-9: conteúdo da aba Comercial, injetado pelo shell (`HomePage`).
   * Vem por composição e não por import porque `features/pcm` não pode importar
   * `features/comercial` (regra de fronteira do CLAUDE.md — features de domínios diferentes não
   * se conhecem). Ausente (ex.: usuário sem o módulo), a aba simplesmente não aparece. */
  painelComercial?: ReactNode;
  /** E01-S75 AC-5: vindo do Apontamento de Horas — abre direto na aba "OS" filtrando backlog e
   * histórico ao período por `createdAt` (client-side, sobre o dado já carregado; o gateway não
   * tem parâmetro de data). `createdAt` é o campo disponível em `OrdemServicoResumo` — não é
   * exatamente a data agendada usada no relatório de horas, por isso o rótulo diz "criadas". */
  periodo?: { inicio: string; fim: string };
}) {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [aba, setAba] = useState<Aba360>(periodo ? "os" : "resumo");
  const [editandoCadastro, setEditandoCadastro] = useState(false);
  const [criandoAcesso, setCriandoAcesso] = useState(false);

  // AC-1: só carrega/renderiza o conteúdo com leitura no módulo pcm (mesma checagem das demais
  // telas do PCM; superadmin já é bypass dentro de podeAcessarModulo). Sem permissão nova.
  const temAcesso = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const visao = await obterVisaoCliente(supabaseCliente360Adapter, clienteId);
      setEstado({ fase: "pronto", visao });
    } catch {
      // AC-8/AC-5 são estados de retorno (não exceções); aqui só cai erro inesperado de
      // infra (rede/permissão de banco) — mensagem neutra, sem vazar detalhe de implementação.
      setEstado({ fase: "erro", mensagem: "Não foi possível carregar a visão do cliente." });
    }
  }, [clienteId]);

  useEffect(() => {
    if (!permissoesCarregando && temAcesso) carregar();
  }, [permissoesCarregando, temAcesso, carregar]);

  if (permissoesCarregando) {
    return (
      <div className="flex flex-col gap-3 p-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    );
  }

  // AC-1: sem leitura no módulo pcm, a tela não é acessível.
  if (!temAcesso) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="text-body text-ink-3 mt-1">
          Você não tem permissão de leitura no módulo PCM para ver esta tela.
        </p>
      </div>
    );
  }

  if (estado.fase === "carregando") {
    return (
      <div className="flex flex-col gap-3 p-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    );
  }

  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="text-body text-ink-3 mt-1">{estado.mensagem}</p>
        <button
          type="button"
          onClick={carregar}
          className="mt-4 text-body font-semibold text-orange hover:text-orange-deep cursor-pointer"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // AC-8: cliente inexistente/soft-deleted.
  if (estado.visao.tipo === "nao_encontrado") {
    return <ClienteNaoEncontrado />;
  }

  const {
    cliente,
    metricas,
    eventos,
    backlog,
    historico,
    equipamentos,
    qualidade,
    grupos,
    assessment,
  } = estado.visao;

  return (
    <div className="flex flex-col gap-5">
      <CabecalhoCliente cliente={cliente} />
      {(user?.papel === "superadmin" || user?.papel === "supervisor") && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCriandoAcesso(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-orange px-4 py-2 text-body font-semibold text-white hover:bg-orange-deep"
          >
            <UserPlus size={16} /> Criar acesso ao portal
          </button>
        </div>
      )}
      {criandoAcesso && (
        <CriarAcessoPortalModal
          clienteId={cliente.id}
          clienteNome={cliente.nome}
          onClose={() => setCriandoAcesso(false)}
        />
      )}
      <PainelCadastroAuvo
        cliente={cliente}
        temEscrita={temEscrita}
        onEditar={() => setEditandoCadastro(true)}
      />
      {editandoCadastro && (
        <ClienteFormModal
          cliente={cliente}
          onCancel={() => setEditandoCadastro(false)}
          onSalvar={async (dados) => {
            if (!user) return;
            await editarCliente(supabaseCliente360Adapter, {
              ...dados,
              id: cliente.id,
              userId: user.id,
            });
            setEditandoCadastro(false);
            await carregar();
          }}
        />
      )}

      <div className="border-b border-line-soft overflow-x-auto">
        <div className="flex min-w-max gap-2">
          {ABAS.filter((item) => item.id !== "comercial" || painelComercial).map((item) => {
            const Icon = item.icon;
            const ativo = aba === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setAba(item.id)}
                className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-body font-semibold transition-colors ${
                  ativo ? "border-orange text-ink" : "border-transparent text-ink-3 hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {aba === "resumo" && (
        <Resumo360
          cliente={cliente}
          metricas={metricas}
          eventos={eventos}
          equipamentos={equipamentos}
          qualidade={qualidade}
          grupos={grupos}
          onAbrirOs={onAbrirOs}
          temEscrita={temEscrita}
        />
      )}

      {aba === "timeline" && <TimelineCliente eventos={eventos} onAbrirOs={onAbrirOs} />}

      {aba === "os" && (
        <div className="flex flex-col gap-3">
          {periodo && (
            <p className="text-caption text-ink-3">
              Filtrado por período (OS criadas entre{" "}
              {new Date(`${periodo.inicio}T00:00:00`).toLocaleDateString("pt-BR")} e{" "}
              {new Date(`${periodo.fim}T00:00:00`).toLocaleDateString("pt-BR")}) — vindo do
              Apontamento de Horas.
            </p>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PainelBacklog
              ordens={periodo ? filtrarPorPeriodo(backlog, periodo) : backlog}
              onSelecionar={onAbrirOs}
            />
            <PainelHistorico
              ordens={periodo ? filtrarPorPeriodo(historico, periodo) : historico}
              onSelecionar={onAbrirOs}
            />
          </div>
        </div>
      )}

      {aba === "qualidade" && <PainelQualidade qualidade={qualidade} />}

      {aba === "assessment" && <PainelAssessment assessment={assessment} />}

      {aba === "ativos" && (
        <div className="flex flex-col gap-4">
          {user && (
            <PainelItensDoCliente clienteId={cliente.id} temEscrita={temEscrita} userId={user.id} />
          )}
          <PainelEquipamentos equipamentos={equipamentos} />
        </div>
      )}

      {aba === "estrutura" && user && (
        <EstruturaClientePage clienteId={cliente.id} temEscrita={temEscrita} userId={user.id} />
      )}

      {aba === "sistemas" && user && (
        <PainelSistemasCliente clienteId={cliente.id} temEscrita={temEscrita} userId={user.id} />
      )}

      {aba === "board" && (
        <BoardAtivos clienteId={cliente.id} onIrParaEstrutura={() => setAba("estrutura")} />
      )}

      {aba === "financeiro" && (
        <PainelFinanceiro cliente={cliente} backlog={backlog} historico={historico} />
      )}

      {aba === "comercial" && painelComercial}

      {aba === "comunicacao" && (
        <PainelComunicacao cliente={cliente} eventos={eventos} temEscrita={temEscrita} />
      )}
    </div>
  );
}

function CriarAcessoPortalModal({
  clienteId,
  clienteNome,
  onClose,
}: {
  clienteId: string;
  clienteNome: string;
  onClose: () => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useFormularioSujo({ nome: "", email: "", senha: "" }, { nome, email, senha });

  const criar = async () => {
    setErro(null);
    setSalvando(true);
    try {
      await supabaseConfigAdapter.criarUsuario({
        nome,
        email,
        senha,
        papel: "cliente-sindico",
        clienteId,
        modo: { tipo: "individual", permissoes: [] },
      });
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o acesso.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <dialog open className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-modal">
        <h2 className="text-lg font-semibold text-ink">Criar acesso ao Portal do Cliente</h2>
        <p className="mt-1 text-body text-ink-3">Condomínio: {clienteNome}</p>
        <div className="mt-5 grid gap-3">
          <label className="text-body text-ink-2">
            Nome
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <label className="text-body text-ink-2">
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <label className="text-body text-ink-2">
            Senha inicial
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              minLength={8}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
        </div>
        {erro && <p className="mt-3 text-body text-red-600">{erro}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-body"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando || !nome.trim() || !email.trim() || senha.length < 8}
            onClick={criar}
            className="rounded-lg bg-orange px-4 py-2 text-body font-semibold text-white disabled:opacity-50"
          >
            {salvando ? "Criando…" : "Criar acesso"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function filtrarPorPeriodo(
  ordens: OrdemServicoResumo[],
  periodo: { inicio: string; fim: string },
): OrdemServicoResumo[] {
  return ordens.filter((ordem) => {
    if (!ordem.createdAt) return false;
    const data = ordem.createdAt.slice(0, 10);
    return data >= periodo.inicio && data <= periodo.fim;
  });
}

function Resumo360({
  cliente,
  metricas,
  eventos,
  equipamentos,
  qualidade,
  grupos,
  onAbrirOs,
  temEscrita,
}: {
  cliente: ClienteHeader;
  metricas: Cliente360Metricas;
  eventos: Cliente360Evento[];
  equipamentos: ResultadoEquipamentos;
  qualidade: QualidadeClienteResumo;
  grupos: GrupoClienteResumo[];
  onAbrirOs?: (osId: string) => void;
  temEscrita: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard icon={ClipboardList} label="OS abertas" value={String(metricas.osAbertas)} />
        <MetricCard
          icon={TrendingUp}
          label="Sinal Auvo"
          value={metricas.slaPercentual === null ? "—" : `${metricas.slaPercentual}%`}
        />
        <MetricCard icon={Wrench} label="Backlog" value={String(metricas.backlogTotal)} />
        <MetricCard
          icon={Package}
          label="Ativos"
          value={metricas.equipamentosAtivos === null ? "—" : String(metricas.equipamentosAtivos)}
        />
      </div>

      {/* E01-S51: "liga alguém, quem é essa pessoa" — contatos múltiplos + grupos, hoje só o
       * contato principal aparecia (em Comunicação) e grupos não apareciam em lugar nenhum. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <PainelContatos cliente={cliente} />
        <PainelGrupos grupos={grupos} />
      </div>

      <PainelResponsaveis clienteId={cliente.id} temEscrita={temEscrita} />
      <PainelFerramentasCliente clienteId={cliente.id} temEscrita={temEscrita} />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <TimelineCliente eventos={eventos} compacta onAbrirOs={onAbrirOs} />
        <ResumoOperacional equipamentos={equipamentos} qualidade={qualidade} />
      </div>
    </div>
  );
}

interface ContatoAuvo {
  name?: string;
  phoneNumber?: string;
  email?: string;
}

function PainelContatos({ cliente }: { cliente: ClienteHeader }) {
  const contatos = Array.isArray(cliente.detalhes?.contacts)
    ? (cliente.detalhes?.contacts as ContatoAuvo[])
    : [];

  return (
    <section className="rounded-lg border border-line bg-card">
      <div className="border-b border-line-soft px-4 py-3">
        <h3 className="text-body font-semibold text-ink">Contatos</h3>
        <p className="mt-0.5 text-caption text-ink-3">Todos os contatos cadastrados no Auvo</p>
      </div>
      {contatos.length === 0 ? (
        <div className="px-5 py-6 text-center text-body text-ink-3">
          {cliente.contatoNome || cliente.contatoTelefone || cliente.contatoEmail
            ? "Só o contato principal está sincronizado (ver Comunicação)."
            : "Nenhum contato cadastrado."}
        </div>
      ) : (
        <div className="divide-y divide-line-soft">
          {contatos.map((contato, index) => (
            <div key={`${contato.name ?? "contato"}-${index}`} className="px-5 py-3">
              <p className="text-body font-medium text-ink">{contato.name ?? "Sem nome"}</p>
              <p className="mt-0.5 text-caption text-ink-3">
                {[contato.phoneNumber, contato.email].filter(Boolean).join(" · ") || "Sem contato"}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PainelGrupos({ grupos }: { grupos: GrupoClienteResumo[] }) {
  return (
    <section className="rounded-lg border border-line bg-card">
      <div className="border-b border-line-soft px-4 py-3">
        <h3 className="text-body font-semibold text-ink">Grupos</h3>
        <p className="mt-0.5 text-caption text-ink-3">
          Grupos de clientes (PCM) que incluem este cliente
        </p>
      </div>
      <div className="p-4">
        {grupos.length === 0 ? (
          <p className="text-body text-ink-3">Não pertence a nenhum grupo.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {grupos.map((grupo) => (
              <span
                key={grupo.id}
                className="rounded-full bg-line-soft px-3 py-1 text-caption font-semibold text-ink-2"
              >
                {grupo.nome}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** E01-S103: responsável/representante do cliente (síndico, gerente predial…) — cadastro local
 * editável, distinto de `PainelContatos` (read-only, sincronizado do Auvo). Pode ter mais de um. */
function PainelResponsaveis({
  clienteId,
  temEscrita,
}: {
  clienteId: string;
  temEscrita: boolean;
}) {
  const [responsaveis, setResponsaveis] = useState<ResponsavelCliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<ResponsavelCliente | "novo" | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setResponsaveis(await listarResponsaveis(supabaseClienteResponsaveisAdapter, clienteId));
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function remover(id: string) {
    await removerResponsavel(supabaseClienteResponsaveisAdapter, id);
    await carregar();
  }

  return (
    <section className="rounded-lg border border-line bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
        <div>
          <h3 className="text-body font-semibold text-ink">Responsáveis</h3>
          <p className="mt-0.5 text-caption text-ink-3">
            Representantes do cliente (síndico, gerente predial…) — cadastro local
          </p>
        </div>
        {temEscrita && (
          <button type="button" onClick={() => setEditando("novo")} className="btn-secondary">
            <UserPlus className="h-4 w-4" />
            Adicionar
          </button>
        )}
      </div>
      {carregando ? (
        <Skeleton className="h-4 w-40" />
      ) : responsaveis.length === 0 ? (
        <div className="px-5 py-6 text-center text-body text-ink-3">
          Nenhum responsável cadastrado.
        </div>
      ) : (
        <div className="divide-y divide-line-soft">
          {responsaveis.map((responsavel) => (
            <div key={responsavel.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-body font-medium text-ink">
                  {responsavel.nome}
                  {responsavel.papel && (
                    <span className="ml-1.5 text-caption font-normal text-ink-3">
                      · {responsavel.papel}
                    </span>
                  )}
                </p>
                {(responsavel.telefone || responsavel.email) && (
                  <p className="mt-0.5 text-caption text-ink-3">
                    {[responsavel.telefone, responsavel.email].filter(Boolean).join(" · ")}
                    {responsavel.preferenciaContato && (
                      <span className="text-ink-3">
                        {" "}
                        (prefere {PREFERENCIA_CONTATO_LABEL[responsavel.preferenciaContato]})
                      </span>
                    )}
                  </p>
                )}
              </div>
              {temEscrita && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditando(responsavel)}
                    className="rounded-md px-2 py-1 text-caption font-semibold text-ink-2 hover:bg-line-soft"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => remover(responsavel.id)}
                    className="rounded-md px-2 py-1 text-caption font-semibold text-danger hover:bg-danger-soft"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {editando && (
        <ResponsavelModal
          clienteId={clienteId}
          responsavel={editando === "novo" ? null : editando}
          onCancel={() => setEditando(null)}
          onSalvar={async (dados) => {
            if (editando === "novo") {
              await criarResponsavel(supabaseClienteResponsaveisAdapter, dados);
            } else {
              await editarResponsavel(supabaseClienteResponsaveisAdapter, editando.id, dados);
            }
            setEditando(null);
            await carregar();
          }}
        />
      )}
    </section>
  );
}

function ResponsavelModal({
  clienteId,
  responsavel,
  onCancel,
  onSalvar,
}: {
  clienteId: string;
  responsavel: ResponsavelCliente | null;
  onCancel: () => void;
  onSalvar: (dados: {
    clienteId: string;
    nome: string;
    papel: string | null;
    email: string | null;
    telefone: string | null;
    preferenciaContato: PreferenciaContato | null;
  }) => Promise<void>;
}) {
  const [nome, setNome] = useState(responsavel?.nome ?? "");
  const [papel, setPapel] = useState(responsavel?.papel ?? "");
  const [email, setEmail] = useState(responsavel?.email ?? "");
  const [telefone, setTelefone] = useState(responsavel?.telefone ?? "");
  const [preferenciaContato, setPreferenciaContato] = useState<PreferenciaContato | "">(
    responsavel?.preferenciaContato ?? "",
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useFormularioSujo(
    {
      nome: responsavel?.nome ?? "",
      papel: responsavel?.papel ?? "",
      email: responsavel?.email ?? "",
      telefone: responsavel?.telefone ?? "",
      preferenciaContato: responsavel?.preferenciaContato ?? "",
    },
    { nome, papel, email, telefone, preferenciaContato },
  );

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({
        clienteId,
        nome,
        papel: papel || null,
        email: email || null,
        telefone: telefone || null,
        preferenciaContato: preferenciaContato || null,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o responsável.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <dialog open className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-modal">
        <h2 className="text-lg font-semibold text-ink">
          {responsavel ? "Editar responsável" : "Adicionar responsável"}
        </h2>
        <div className="mt-4 grid gap-3">
          <label className="text-body text-ink-2">
            Nome *
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <label className="text-body text-ink-2">
            Papel
            <input
              value={papel}
              onChange={(e) => setPapel(e.target.value)}
              placeholder="Ex: Síndico, Gerente predial"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <label className="text-body text-ink-2">
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <label className="text-body text-ink-2">
            Telefone
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <label className="text-body text-ink-2">
            Preferência de contato
            <select
              value={preferenciaContato}
              onChange={(e) => setPreferenciaContato(e.target.value as PreferenciaContato | "")}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            >
              <option value="">Sem preferência</option>
              {PREFERENCIAS_CONTATO.map((preferencia) => (
                <option key={preferencia} value={preferencia}>
                  {PREFERENCIA_CONTATO_LABEL[preferencia]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {erro && <p className="mt-3 text-body text-red-600">{erro}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line px-4 py-2 text-body"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando || !nome.trim()}
            onClick={salvar}
            className="rounded-lg bg-orange px-4 py-2 text-body font-semibold text-white disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** E01-S106: ferramenta da Sinérgica alocada temporariamente a um cliente — distinto da alocação
 * ferramenta→técnico já existente (E01-S65, tela Ferramentas). Uma alocação ativa por ferramenta. */
function PainelFerramentasCliente({
  clienteId,
  temEscrita,
}: {
  clienteId: string;
  temEscrita: boolean;
}) {
  const { user } = useAuth();
  const [alocacoes, setAlocacoes] = useState<AlocacaoFerramentaCliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [alocando, setAlocando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setAlocacoes(
        await listarAlocacoesCliente(supabaseFerramentaAlocacaoClienteAdapter, clienteId),
      );
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function devolver(alocacaoId: string) {
    if (!temEscrita || !user) return;
    await devolverFerramenta(supabaseFerramentaAlocacaoClienteAdapter, alocacaoId, user.id);
    await carregar();
  }

  const ativas = alocacoes.filter((a) => a.devolvidaEm === null);
  const historico = alocacoes.filter((a) => a.devolvidaEm !== null);

  return (
    <section className="rounded-lg border border-line bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
        <div>
          <h3 className="text-body font-semibold text-ink">Ferramentas alocadas</h3>
          <p className="mt-0.5 text-caption text-ink-3">
            Ferramentas da Sinérgica emprestadas/em uso neste cliente
          </p>
        </div>
        {temEscrita && (
          <button type="button" onClick={() => setAlocando(true)} className="btn-secondary">
            <Wrench className="h-4 w-4" />
            Alocar ferramenta
          </button>
        )}
      </div>
      {carregando ? (
        <Skeleton className="h-4 w-40" />
      ) : ativas.length === 0 && historico.length === 0 ? (
        <div className="px-5 py-6 text-center text-body text-ink-3">
          Nenhuma ferramenta alocada.
        </div>
      ) : (
        <div className="divide-y divide-line-soft">
          {ativas.map((alocacao) => (
            <div key={alocacao.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-body font-medium text-ink">{alocacao.ferramentaNome}</p>
                <p className="mt-0.5 text-caption text-ink-3">
                  Alocada em {new Date(alocacao.alocadaEm).toLocaleDateString("pt-BR")}
                </p>
              </div>
              {temEscrita && (
                <button
                  type="button"
                  onClick={() => devolver(alocacao.id)}
                  className="shrink-0 rounded-md px-2 py-1 text-caption font-semibold text-ink-2 hover:bg-line-soft"
                >
                  Devolver
                </button>
              )}
            </div>
          ))}
          {historico.slice(0, 5).map((alocacao) => (
            <div key={alocacao.id} className="px-5 py-3 opacity-60">
              <p className="truncate text-body text-ink-2">{alocacao.ferramentaNome}</p>
              <p className="mt-0.5 text-caption text-ink-3">
                {new Date(alocacao.alocadaEm).toLocaleDateString("pt-BR")} até{" "}
                {alocacao.devolvidaEm && new Date(alocacao.devolvidaEm).toLocaleDateString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      )}
      {alocando && (
        <AlocarFerramentaModal
          onCancel={() => setAlocando(false)}
          onErro={setErro}
          onAlocar={async (ferramentaId, userId) => {
            await alocarFerramenta(
              supabaseFerramentaAlocacaoClienteAdapter,
              ferramentaId,
              clienteId,
              userId,
            );
            setAlocando(false);
            await carregar();
          }}
        />
      )}
      {erro && <p className="px-5 pb-3 text-body text-red-600">{erro}</p>}
    </section>
  );
}

function AlocarFerramentaModal({
  onCancel,
  onAlocar,
  onErro,
}: {
  onCancel: () => void;
  onAlocar: (ferramentaId: string, userId: string) => Promise<void>;
  onErro: (mensagem: string) => void;
}) {
  const { user } = useAuth();
  const [opcoes, setOpcoes] = useState<Array<{ id: string; nome: string }>>([]);
  const [ferramentaId, setFerramentaId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // `carregando` como chave de reset: o valor inicial só fica pronto após o fetch (1º item da
  // lista), então a linha de base do formulário precisa recapturar nesse momento — senão o
  // auto-select dispararia o aviso de "alterações não salvas" sem o operador ter feito nada.
  useFormularioSujo({ ferramentaId: opcoes[0]?.id ?? "" }, { ferramentaId }, carregando);

  useEffect(() => {
    listarFerramentasDisponiveis(supabaseFerramentaAlocacaoClienteAdapter).then((lista) => {
      setOpcoes(lista);
      setFerramentaId(lista[0]?.id ?? "");
      setCarregando(false);
    });
  }, []);

  async function confirmar() {
    if (!user) return;
    setSalvando(true);
    try {
      await onAlocar(ferramentaId, user.id);
    } catch (e) {
      onErro(e instanceof Error ? e.message : "Não foi possível alocar a ferramenta.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <dialog open className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-modal">
        <h2 className="text-lg font-semibold text-ink">Alocar ferramenta</h2>
        <div className="mt-4">
          {carregando ? (
            <Skeleton className="h-4 w-40" />
          ) : opcoes.length === 0 ? (
            <p className="text-body text-ink-3">
              Nenhuma ferramenta disponível (todas já estão alocadas em algum cliente).
            </p>
          ) : (
            <label className="text-body text-ink-2">
              Ferramenta
              <select
                value={ferramentaId}
                onChange={(e) => setFerramentaId(e.target.value)}
                className="input mt-1 w-full"
              >
                {opcoes.map((opcao) => (
                  <option key={opcao.id} value={opcao.id}>
                    {opcao.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line px-4 py-2 text-body"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando || !ferramentaId}
            onClick={confirmar}
            className="rounded-lg bg-orange px-4 py-2 text-body font-semibold text-white disabled:opacity-50"
          >
            {salvando ? "Alocando…" : "Alocar"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <div className="flex items-center gap-2 text-micro font-semibold uppercase tracking-wider text-ink-3">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-3 font-brand text-3xl font-bold text-ink tabular-nums">{value}</p>
    </div>
  );
}

function PainelCadastroAuvo({
  cliente,
  temEscrita,
  onEditar,
}: {
  cliente: ClienteHeader;
  temEscrita: boolean;
  onEditar: () => void;
}) {
  const itens = [
    { label: "Vínculo Auvo", ok: cliente.auvoId !== null },
    { label: "Endereço", ok: Boolean(cliente.endereco || cliente.cidade || cliente.estado) },
    { label: "Contato", ok: Boolean(cliente.contatoTelefone || cliente.contatoEmail) },
    { label: "CNPJ", ok: Boolean(cliente.cnpj) },
  ];

  async function copiarAuvoId() {
    if (cliente.auvoId === null) return;
    await navigator.clipboard?.writeText(String(cliente.auvoId));
  }

  return (
    <section className="rounded-lg border border-line bg-card px-4 py-3">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-orange" />
            <h3 className="text-body font-semibold text-ink">Cadastro sincronizado do Auvo</h3>
          </div>
          <p className="mt-1 text-caption text-ink-3">
            Edições feitas aqui são enviadas ao Auvo automaticamente. Se a sincronização falhar, o
            status da OS e a saúde do sync no dashboard indicam a pendência para nova tentativa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {temEscrita && (
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={onEditar}>
              Editar cadastro
            </Button>
          )}
          <button
            type="button"
            onClick={copiarAuvoId}
            disabled={cliente.auvoId === null}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Copy className="h-4 w-4" />
            Copiar ID Auvo
          </button>
          <button
            type="button"
            onClick={() => window.open("https://app.auvo.com.br", "_blank", "noopener,noreferrer")}
            className="inline-flex items-center gap-2 rounded-md bg-navy px-3 py-2 text-body font-semibold text-white hover:bg-navy-deep"
          >
            <ExternalLink className="h-4 w-4" />
            Editar no Auvo
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {itens.map((item) => (
          <div
            key={item.label}
            className={`rounded-md border px-3 py-2 text-caption font-semibold ${
              item.ok
                ? "border-success-line bg-success-soft text-success"
                : "border-warning-line bg-warning-soft text-warning"
            }`}
          >
            {item.label}: {item.ok ? "ok" : "pendente"}
          </div>
        ))}
      </div>
    </section>
  );
}

function TimelineCliente({
  eventos,
  compacta = false,
  onAbrirOs,
}: {
  eventos: Cliente360Evento[];
  compacta?: boolean;
  onAbrirOs?: (osId: string) => void;
}) {
  const [filtro, setFiltro] = useState<Cliente360Evento["tipo"] | "todos">("todos");
  const eventosFiltrados =
    filtro === "todos" ? eventos : eventos.filter((evento) => evento.tipo === filtro);
  const eventosVisiveis = compacta ? eventosFiltrados.slice(0, 6) : eventosFiltrados;

  return (
    <section className="rounded-lg border border-line bg-card">
      <div className="border-b border-line-soft px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-body font-semibold text-ink">
              {compacta ? "Eventos recentes" : "Timeline do cliente"}
            </h3>
            <p className="mt-0.5 text-caption text-ink-3">
              OS, inspeções, laudos e sinais de sincronização Auvo em ordem cronológica
            </p>
          </div>
          {!compacta && (
            <select
              value={filtro}
              onChange={(event) =>
                setFiltro(event.target.value as Cliente360Evento["tipo"] | "todos")
              }
              className="input h-9 w-[170px] bg-card text-caption"
              aria-label="Filtrar timeline"
            >
              <option value="todos">Todos os eventos</option>
              <option value="os">OS</option>
              <option value="inspecao">Inspeções</option>
              <option value="laudo">Laudos</option>
              <option value="auvo">Auvo</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          )}
        </div>
      </div>
      {eventos.length === 0 ? (
        <div className="px-5 py-8 text-center text-body text-ink-3">Sem eventos recentes</div>
      ) : eventosVisiveis.length === 0 ? (
        <div className="px-5 py-8 text-center text-body text-ink-3">
          Nenhum evento para o filtro selecionado.
        </div>
      ) : (
        <div className="px-4 py-3">
          <div className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-line-soft">
            {eventosVisiveis.map((evento) => {
              const clicavel = evento.tipo === "os" && Boolean(onAbrirOs);
              const conteudo = (
                <>
                  <span
                    className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card ${corEvento(evento.criticidade)}`}
                  >
                    <EventoIcone tipo={evento.tipo} />
                  </span>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate text-body font-medium text-ink">{evento.titulo}</p>
                      <span className="shrink-0 text-caption tabular-nums text-ink-3">
                        {formatarData(evento.data)}
                      </span>
                    </div>
                    {evento.subtitulo && (
                      <p className="mt-0.5 line-clamp-2 text-caption text-ink-3">
                        {evento.subtitulo}
                      </p>
                    )}
                    {evento.tecnicoNome && (
                      <p className="mt-0.5 text-micro font-medium text-ink-2">
                        Técnico: {evento.tecnicoNome}
                      </p>
                    )}
                    {evento.descricao && (
                      <p className="mt-0.5 line-clamp-2 text-caption text-ink-3">
                        {evento.descricao}
                      </p>
                    )}
                  </div>
                </>
              );
              if (clicavel) {
                return (
                  <button
                    key={evento.id}
                    type="button"
                    onClick={() => onAbrirOs?.(evento.id.replace(/^os-/, ""))}
                    className="relative flex w-full gap-3 text-left hover:opacity-80"
                  >
                    {conteudo}
                  </button>
                );
              }
              return (
                <div key={evento.id} className="relative flex gap-3">
                  {conteudo}
                </div>
              );
            })}
          </div>
          {compacta && eventosFiltrados.length > eventosVisiveis.length && (
            <div className="mt-3 border-t border-line-soft pt-3 text-caption text-ink-3">
              Mais {eventosFiltrados.length - eventosVisiveis.length} evento(s) na aba Timeline.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function EventoIcone({ tipo }: { tipo: Cliente360Evento["tipo"] }) {
  const icons: Record<Cliente360Evento["tipo"], LucideIcon> = {
    os: ClipboardList,
    inspecao: Calendar,
    laudo: ShieldCheck,
    whatsapp: MessageCircle,
    auvo: RefreshCw,
  };
  const Icon = icons[tipo];
  return <Icon className="h-4 w-4" />;
}

function corEvento(criticidade: Cliente360Evento["criticidade"]): string {
  if (criticidade === "critica") return "border-danger-line text-danger";
  if (criticidade === "sucesso") return "border-success-line text-success";
  if (criticidade === "atencao") return "border-warning-line text-warning";
  return "border-line text-ink-3";
}

function ResumoOperacional({
  equipamentos,
  qualidade,
}: {
  equipamentos: ResultadoEquipamentos;
  qualidade: QualidadeClienteResumo;
}) {
  const totalEquipamentos = equipamentos === "indisponivel" ? null : equipamentos.length;
  const pendencias =
    qualidade.inspecoes.reduce((acc, item) => acc + item.itensNaoConformes, 0) +
    qualidade.laudos.filter((laudo) => !["concluido", "assinado"].includes(laudo.status)).length;

  return (
    <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
      <h3 className="text-body font-semibold text-ink">Operação</h3>
      <div className="mt-4 grid gap-3">
        <ResumoLinha
          label="Equipamentos Auvo"
          value={totalEquipamentos === null ? "Indisponível" : String(totalEquipamentos)}
        />
        <ResumoLinha label="Inspeções recentes" value={String(qualidade.inspecoes.length)} />
        <ResumoLinha label="Laudos SPDA" value={String(qualidade.laudos.length)} />
        <ResumoLinha
          label="Pendências técnicas"
          value={String(pendencias)}
          destaque={pendencias > 0}
        />
      </div>
    </section>
  );
}

function ResumoLinha({
  label,
  value,
  destaque = false,
}: {
  label: string;
  value: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-soft pb-3 last:border-0 last:pb-0">
      <span className="text-body text-ink-3">{label}</span>
      <span className={`text-body font-semibold ${destaque ? "text-orange-deep" : "text-ink"}`}>
        {value}
      </span>
    </div>
  );
}

function PainelAssessment({ assessment }: { assessment: AssessmentClienteResumo | null }) {
  return (
    <section className="rounded-lg border border-line bg-card">
      <div className="border-b border-line-soft px-4 py-3">
        <h3 className="text-body font-semibold text-ink">Assessment</h3>
        <p className="mt-0.5 text-caption text-ink-3">Documento de estado vigente do cliente</p>
      </div>
      {!assessment ? (
        <div className="px-5 py-8 text-center text-body text-ink-3">
          Nenhum assessment cadastrado ainda — crie um em PCM → Assessment.
        </div>
      ) : (
        <div className="p-4">
          <p className="text-body text-ink-2">
            {MOTIVO_ASSESSMENT_LABEL[assessment.motivo ?? "inicio"]} ·{" "}
            {new Date(`${assessment.dataInspecao}T00:00:00`).toLocaleDateString("pt-BR")}
          </p>
          <p className="mt-1 text-caption text-ink-3">
            {`${assessment.itensDerivados} de ${assessment.totalItens} ${
              assessment.totalItens === 1 ? "item" : "itens"
            } já derivado${assessment.itensDerivados === 1 ? "" : "s"} (Chamado/Backlog/OS)`}
          </p>
        </div>
      )}
    </section>
  );
}

function PainelQualidade({ qualidade }: { qualidade: QualidadeClienteResumo }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section className="rounded-lg border border-line bg-card">
        <div className="border-b border-line-soft px-4 py-3">
          <h3 className="text-body font-semibold text-ink">Inspeções</h3>
        </div>
        {qualidade.inspecoes.length === 0 ? (
          <div className="px-5 py-8 text-center text-body text-ink-3">Nenhuma inspeção criada</div>
        ) : (
          <div className="divide-y divide-line-soft">
            {qualidade.inspecoes.map((inspecao) => (
              <div key={inspecao.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-body font-medium text-ink">{inspecao.titulo}</p>
                  <span className="text-caption tabular-nums text-ink-3">
                    {formatarData(inspecao.dataInspecao)}
                  </span>
                </div>
                <p className="mt-1 text-caption text-ink-3">
                  {inspecao.status} · {inspecao.totalItens} itens · {inspecao.itensNaoConformes} não
                  conformes
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-line bg-card">
        <div className="border-b border-line-soft px-4 py-3">
          <h3 className="text-body font-semibold text-ink">Laudos SPDA</h3>
        </div>
        {qualidade.laudos.length === 0 ? (
          <div className="px-5 py-8 text-center text-body text-ink-3">Nenhum laudo criado</div>
        ) : (
          <div className="divide-y divide-line-soft">
            {qualidade.laudos.map((laudo) => (
              <div key={laudo.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-body font-medium text-ink">{laudo.numero}</p>
                  <span className="text-caption tabular-nums text-ink-3">
                    {formatarData(laudo.dataVistoria)}
                  </span>
                </div>
                <p className="mt-1 text-caption text-ink-3">
                  {laudo.status}
                  {laudo.nivelProtecao ? ` · Nível ${laudo.nivelProtecao}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PainelComunicacao({
  cliente,
  eventos,
  temEscrita,
}: {
  cliente: ClienteHeader;
  eventos: Cliente360Evento[];
  temEscrita: boolean;
}) {
  const comunicacao = eventos.filter((evento) => evento.tipo === "whatsapp");
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <h3 className="text-body font-semibold text-ink">Comunicação</h3>
        <div className="mt-4 grid gap-3 text-body">
          <ResumoLinha label="Telefone" value={cliente.contatoTelefone ?? "Não informado"} />
          <ResumoLinha label="Email" value={cliente.contatoEmail ?? "Não informado"} />
          <ResumoLinha label="Mensagens vinculadas" value={String(comunicacao.length)} />
        </div>
        {cliente.observacoes && (
          <div className="mt-4 rounded-md border border-warning-line bg-orange-soft px-3 py-2 text-body text-warning">
            {cliente.observacoes}
          </div>
        )}
      </section>
      <PainelAlmaCliente clienteId={cliente.id} temEscrita={temEscrita} />
    </div>
  );
}

const STATUS_COMERCIAL_LABEL_360: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  prospecto: "Prospecto",
};

/** E01-S51: substitui o placeholder por um proxy operacional honesto — `status_comercial` (coluna
 * local já existe) + OS por categoria nos últimos 12 meses (dado 100% local, já carregado pela
 * 360). Não inventa contrato/faturamento: `pcm.servicos` não tem vínculo com `ordens_servico` nem
 * cliente hoje, então esse dado real não existe — dito explicitamente na tela em vez de omitido. */
function PainelFinanceiro({
  cliente,
  backlog,
  historico,
}: {
  cliente: ClienteHeader;
  backlog: OrdemServicoResumo[];
  historico: OrdemServicoResumo[];
}) {
  const dozeMesesAtras = new Date();
  dozeMesesAtras.setFullYear(dozeMesesAtras.getFullYear() - 1);
  const corte = dozeMesesAtras.toISOString();

  const porCategoria = new Map<string, number>();
  for (const os of [...backlog, ...historico]) {
    if (os.createdAt && os.createdAt < corte) continue;
    porCategoria.set(os.categoria, (porCategoria.get(os.categoria) ?? 0) + 1);
  }
  const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <h3 className="text-body font-semibold text-ink">Status comercial</h3>
        <p className="mt-2 inline-flex rounded-full bg-line-soft px-3 py-1 text-body font-semibold text-ink-2">
          {cliente.statusComercial
            ? (STATUS_COMERCIAL_LABEL_360[cliente.statusComercial] ?? cliente.statusComercial)
            : "Não informado"}
        </p>
      </section>

      <section className="rounded-lg border border-line bg-card">
        <div className="border-b border-line-soft px-4 py-3">
          <h3 className="text-body font-semibold text-ink">OS por categoria — últimos 12 meses</h3>
          <p className="mt-0.5 text-caption text-ink-3">
            Volume de atendimento por tipo de serviço (baseado nas 50 OS mais recentes) — não é
            faturamento
          </p>
        </div>
        {categorias.length === 0 ? (
          <div className="px-5 py-8 text-center text-body text-ink-3">
            Nenhuma OS nos últimos 12 meses.
          </div>
        ) : (
          <div className="divide-y divide-line-soft">
            {categorias.map(([categoria, total]) => (
              <div key={categoria} className="flex items-center justify-between px-5 py-3">
                <span className="text-body capitalize text-ink-2">{categoria}</span>
                <span className="text-body font-semibold tabular-nums text-ink">{total}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-dashed border-line bg-card px-5 py-6 text-center">
        <p className="text-body text-ink-3">
          Contrato, faturamento e inadimplência ainda não têm dado real vinculado ao cliente — o
          catálogo de preços não está ligado às OS. Sai do ar assim que o módulo Financeiro existir.
        </p>
      </section>
    </div>
  );
}

/** E02-S24: "alma" do cliente — particularidades de comunicação que o Zé consome como contexto
 * (ex.: "síndico prefere áudio, é direto"). Texto livre, editável; isolado por `clienteId`. */
function PainelAlmaCliente({
  clienteId,
  temEscrita,
}: {
  clienteId: string;
  temEscrita: boolean;
}) {
  const { user } = useAuth();
  const [conteudo, setConteudo] = useState("");
  const [editando, setEditando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterAlma(supabaseClienteAlmaAdapter, clienteId)
      .then(setConteudo)
      .finally(() => setCarregando(false));
  }, [clienteId]);

  async function salvar() {
    if (!user) return;
    setSalvando(true);
    setErro(null);
    try {
      await salvarAlma(supabaseClienteAlmaAdapter, clienteId, conteudo, user.id);
      setEditando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-body font-semibold text-ink">Alma do cliente</h3>
          <p className="mt-0.5 text-caption text-ink-3">
            Particularidades de comunicação que o Zé usa como contexto (ex.: "prefere áudio, é
            direto")
          </p>
        </div>
        {temEscrita && !editando && (
          <button type="button" onClick={() => setEditando(true)} className="btn-secondary">
            Editar
          </button>
        )}
      </div>
      <div className="mt-3">
        {carregando ? (
          <Skeleton className="h-4 w-40" />
        ) : editando ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="input min-h-24 w-full resize-y"
              placeholder="Ex: Síndico prefere áudio a texto, é direto e não gosta de rodeio."
            />
            {erro && <p className="text-body text-red-600">{erro}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditando(false)} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={salvar}
                className="h-9 rounded-md bg-navy px-3 text-body font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
              >
                {salvando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-body text-ink-2">{conteudo || "Nenhuma alma cadastrada ainda."}</p>
        )}
      </div>
    </section>
  );
}

function formatarData(data: string): string {
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return data;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}
