// Página da Visão 360 do Cliente (E01-S12) — sub-tela read-only do PCM.
// Recebe `clienteId` por prop (o app ainda não tem roteamento por id — ver OPEN-QUESTION #3 em
// tasks.md; a página é testável/integrável isoladamente). Orquestra o gate AC-1 + o caso de uso.
//
// A tela não grava cadastro nem operação localmente: dados de cliente são governados pelo Auvo e
// OS/qualidade continuam nas telas de origem. A ação de edição só leva o usuário para o alvo.
import {
  Activity,
  Calendar,
  ClipboardList,
  Copy,
  DollarSign,
  ExternalLink,
  Layers,
  MessageCircle,
  Package,
  Pencil,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import type {
  Cliente360Evento,
  Cliente360Metricas,
  ClienteHeader,
  GrupoClienteResumo,
  OrdemServicoResumo,
  QualidadeClienteResumo,
  ResultadoEquipamentos,
} from "../application/cliente-360-gateway";
import { editarCliente } from "../application/clientes-crud";
import { type VisaoCliente, obterVisaoCliente } from "../application/obter-visao-cliente";
import { CabecalhoCliente } from "../components/CabecalhoCliente";
import { ClienteFormModal } from "../components/ClienteFormModal";
import { ClienteNaoEncontrado } from "../components/ClienteNaoEncontrado";
import { PainelBacklog } from "../components/PainelBacklog";
import { PainelEquipamentos } from "../components/PainelEquipamentos";
import { PainelHistorico } from "../components/PainelHistorico";
import { supabaseCliente360Adapter } from "../infrastructure/supabase-cliente-360-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; visao: VisaoCliente };

type Aba360 = "resumo" | "timeline" | "os" | "qualidade" | "ativos" | "financeiro" | "comunicacao";

const ABAS: Array<{ id: Aba360; label: string; icon: LucideIcon }> = [
  { id: "resumo", label: "Resumo", icon: Activity },
  { id: "timeline", label: "Timeline", icon: RefreshCw },
  { id: "os", label: "OS", icon: ClipboardList },
  { id: "qualidade", label: "Inspeções", icon: Calendar },
  { id: "ativos", label: "Ativos", icon: Layers },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "comunicacao", label: "Comunicação", icon: MessageCircle },
];

export function VisaoClientePage({
  clienteId,
  onAbrirOs,
}: {
  clienteId: string;
  onAbrirOs?: (osId: string) => void;
}) {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [aba, setAba] = useState<Aba360>("resumo");
  const [editandoCadastro, setEditandoCadastro] = useState(false);

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
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }

  // AC-1: sem leitura no módulo pcm, a tela não é acessível.
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
        <p className="text-sm text-ink-3 mt-1">{estado.mensagem}</p>
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

  // AC-8: cliente inexistente/soft-deleted.
  if (estado.visao.tipo === "nao_encontrado") {
    return <ClienteNaoEncontrado />;
  }

  const { cliente, metricas, eventos, backlog, historico, equipamentos, qualidade, grupos } =
    estado.visao;

  return (
    <div className="flex flex-col gap-5">
      <CabecalhoCliente cliente={cliente} />
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
          {ABAS.map((item) => {
            const Icon = item.icon;
            const ativo = aba === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setAba(item.id)}
                className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${
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
        />
      )}

      {aba === "timeline" && <TimelineCliente eventos={eventos} onAbrirOs={onAbrirOs} />}

      {aba === "os" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PainelBacklog ordens={backlog} onSelecionar={onAbrirOs} />
          <PainelHistorico ordens={historico} onSelecionar={onAbrirOs} />
        </div>
      )}

      {aba === "qualidade" && <PainelQualidade qualidade={qualidade} />}

      {aba === "ativos" && <PainelEquipamentos equipamentos={equipamentos} />}

      {aba === "financeiro" && (
        <PainelFinanceiro cliente={cliente} backlog={backlog} historico={historico} />
      )}

      {aba === "comunicacao" && <PainelComunicacao cliente={cliente} eventos={eventos} />}
    </div>
  );
}

function Resumo360({
  cliente,
  metricas,
  eventos,
  equipamentos,
  qualidade,
  grupos,
  onAbrirOs,
}: {
  cliente: ClienteHeader;
  metricas: Cliente360Metricas;
  eventos: Cliente360Evento[];
  equipamentos: ResultadoEquipamentos;
  qualidade: QualidadeClienteResumo;
  grupos: GrupoClienteResumo[];
  onAbrirOs?: (osId: string) => void;
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
    <section className="rounded-[8px] border border-line bg-card">
      <div className="border-b border-line-soft px-5 py-4">
        <h3 className="text-sm font-semibold text-ink">Contatos</h3>
        <p className="mt-0.5 text-xs text-ink-3">Todos os contatos cadastrados no Auvo</p>
      </div>
      {contatos.length === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-ink-3">
          {cliente.contatoNome || cliente.contatoTelefone || cliente.contatoEmail
            ? "Só o contato principal está sincronizado (ver Comunicação)."
            : "Nenhum contato cadastrado."}
        </div>
      ) : (
        <div className="divide-y divide-line-soft">
          {contatos.map((contato, index) => (
            <div key={`${contato.name ?? "contato"}-${index}`} className="px-5 py-3">
              <p className="text-sm font-medium text-ink">{contato.name ?? "Sem nome"}</p>
              <p className="mt-0.5 text-xs text-ink-3">
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
    <section className="rounded-[8px] border border-line bg-card">
      <div className="border-b border-line-soft px-5 py-4">
        <h3 className="text-sm font-semibold text-ink">Grupos</h3>
        <p className="mt-0.5 text-xs text-ink-3">
          Grupos de clientes (PCM) que incluem este cliente
        </p>
      </div>
      <div className="p-5">
        {grupos.length === 0 ? (
          <p className="text-sm text-ink-3">Não pertence a nenhum grupo.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {grupos.map((grupo) => (
              <span
                key={grupo.id}
                className="rounded-full bg-line-soft px-3 py-1 text-xs font-semibold text-ink-2"
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
    <div className="rounded-[8px] border border-line bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
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
    <section className="rounded-[8px] border border-line bg-card px-5 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-orange" />
            <h3 className="text-sm font-semibold text-ink">Cadastro sincronizado do Auvo</h3>
          </div>
          <p className="mt-1 text-xs text-ink-3">
            Edições feitas aqui são enviadas ao Auvo automaticamente. Se a sincronização falhar, o
            status da OS e a saúde do sync no dashboard indicam a pendência para nova tentativa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {temEscrita && (
            <button
              type="button"
              onClick={onEditar}
              className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
            >
              <Pencil className="h-4 w-4" />
              Editar cadastro
            </button>
          )}
          <button
            type="button"
            onClick={copiarAuvoId}
            disabled={cliente.auvoId === null}
            className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Copy className="h-4 w-4" />
            Copiar ID Auvo
          </button>
          <button
            type="button"
            onClick={() => window.open("https://app.auvo.com.br", "_blank", "noopener,noreferrer")}
            className="inline-flex items-center gap-2 rounded-[6px] bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-deep"
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
            className={`rounded-[6px] border px-3 py-2 text-xs font-semibold ${
              item.ok
                ? "border-[#BFE9CC] bg-[#E7F6EC] text-[#1E8E45]"
                : "border-[#F3D8AD] bg-[#FDF1DF] text-[#9A5A00]"
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
    <section className="rounded-[8px] border border-line bg-card">
      <div className="border-b border-line-soft px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {compacta ? "Eventos recentes" : "Timeline do cliente"}
            </h3>
            <p className="mt-0.5 text-xs text-ink-3">
              OS, inspeções, laudos e sinais de sincronização Auvo em ordem cronológica
            </p>
          </div>
          {!compacta && (
            <select
              value={filtro}
              onChange={(event) =>
                setFiltro(event.target.value as Cliente360Evento["tipo"] | "todos")
              }
              className="input h-9 w-[170px] bg-card text-xs"
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
        <div className="px-5 py-8 text-center text-sm text-ink-3">Sem eventos recentes</div>
      ) : eventosVisiveis.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-ink-3">
          Nenhum evento para o filtro selecionado.
        </div>
      ) : (
        <div className="px-5 py-4">
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
                      <p className="truncate text-sm font-medium text-ink">{evento.titulo}</p>
                      <span className="shrink-0 text-xs tabular-nums text-ink-3">
                        {formatarData(evento.data)}
                      </span>
                    </div>
                    {evento.subtitulo && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-3">{evento.subtitulo}</p>
                    )}
                    {evento.tecnicoNome && (
                      <p className="mt-0.5 text-[11px] font-medium text-ink-2">
                        Técnico: {evento.tecnicoNome}
                      </p>
                    )}
                    {evento.descricao && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-3">{evento.descricao}</p>
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
            <div className="mt-3 border-t border-line-soft pt-3 text-xs text-ink-3">
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
  if (criticidade === "critica") return "border-[#F2B8B0] text-[#C4271A]";
  if (criticidade === "sucesso") return "border-[#BFE9CC] text-[#1E8E45]";
  if (criticidade === "atencao") return "border-[#F3D8AD] text-[#B26A00]";
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
    <section className="rounded-[8px] border border-line bg-card p-5">
      <h3 className="text-sm font-semibold text-ink">Operação</h3>
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
      <span className="text-sm text-ink-3">{label}</span>
      <span className={`text-sm font-semibold ${destaque ? "text-orange-deep" : "text-ink"}`}>
        {value}
      </span>
    </div>
  );
}

function PainelQualidade({ qualidade }: { qualidade: QualidadeClienteResumo }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section className="rounded-[8px] border border-line bg-card">
        <div className="border-b border-line-soft px-5 py-4">
          <h3 className="text-sm font-semibold text-ink">Inspeções</h3>
        </div>
        {qualidade.inspecoes.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-ink-3">Nenhuma inspeção criada</div>
        ) : (
          <div className="divide-y divide-line-soft">
            {qualidade.inspecoes.map((inspecao) => (
              <div key={inspecao.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-ink">{inspecao.titulo}</p>
                  <span className="text-xs tabular-nums text-ink-3">
                    {formatarData(inspecao.dataInspecao)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-3">
                  {inspecao.status} · {inspecao.totalItens} itens · {inspecao.itensNaoConformes} não
                  conformes
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[8px] border border-line bg-card">
        <div className="border-b border-line-soft px-5 py-4">
          <h3 className="text-sm font-semibold text-ink">Laudos SPDA</h3>
        </div>
        {qualidade.laudos.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-ink-3">Nenhum laudo criado</div>
        ) : (
          <div className="divide-y divide-line-soft">
            {qualidade.laudos.map((laudo) => (
              <div key={laudo.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-ink">{laudo.numero}</p>
                  <span className="text-xs tabular-nums text-ink-3">
                    {formatarData(laudo.dataVistoria)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-3">
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
}: {
  cliente: ClienteHeader;
  eventos: Cliente360Evento[];
}) {
  const comunicacao = eventos.filter((evento) => evento.tipo === "whatsapp");
  return (
    <section className="rounded-[8px] border border-line bg-card p-5">
      <h3 className="text-sm font-semibold text-ink">Comunicação</h3>
      <div className="mt-4 grid gap-3 text-sm">
        <ResumoLinha label="Telefone" value={cliente.contatoTelefone ?? "Não informado"} />
        <ResumoLinha label="Email" value={cliente.contatoEmail ?? "Não informado"} />
        <ResumoLinha label="Mensagens vinculadas" value={String(comunicacao.length)} />
      </div>
      {cliente.observacoes && (
        <div className="mt-4 rounded-[6px] border border-[#F0D4B0] bg-orange-soft px-3 py-2 text-sm text-[#7A3F00]">
          {cliente.observacoes}
        </div>
      )}
    </section>
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
      <section className="rounded-[8px] border border-line bg-card p-5">
        <h3 className="text-sm font-semibold text-ink">Status comercial</h3>
        <p className="mt-2 inline-flex rounded-full bg-line-soft px-3 py-1 text-sm font-semibold text-ink-2">
          {cliente.statusComercial
            ? (STATUS_COMERCIAL_LABEL_360[cliente.statusComercial] ?? cliente.statusComercial)
            : "Não informado"}
        </p>
      </section>

      <section className="rounded-[8px] border border-line bg-card">
        <div className="border-b border-line-soft px-5 py-4">
          <h3 className="text-sm font-semibold text-ink">OS por categoria — últimos 12 meses</h3>
          <p className="mt-0.5 text-xs text-ink-3">
            Volume de atendimento por tipo de serviço (baseado nas 50 OS mais recentes) — não é
            faturamento
          </p>
        </div>
        {categorias.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-ink-3">
            Nenhuma OS nos últimos 12 meses.
          </div>
        ) : (
          <div className="divide-y divide-line-soft">
            {categorias.map(([categoria, total]) => (
              <div key={categoria} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm capitalize text-ink-2">{categoria}</span>
                <span className="text-sm font-semibold tabular-nums text-ink">{total}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[8px] border border-dashed border-line bg-card px-5 py-6 text-center">
        <p className="text-sm text-ink-3">
          Contrato, faturamento e inadimplência ainda não têm dado real vinculado ao cliente — o
          catálogo de preços não está ligado às OS. Sai do ar assim que o módulo Financeiro existir.
        </p>
      </section>
    </div>
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
