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
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import type {
  Cliente360Evento,
  Cliente360Metricas,
  ClienteHeader,
  QualidadeClienteResumo,
  ResultadoEquipamentos,
} from "../application/cliente-360-gateway";
import { type VisaoCliente, obterVisaoCliente } from "../application/obter-visao-cliente";
import { CabecalhoCliente } from "../components/CabecalhoCliente";
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

export function VisaoClientePage({ clienteId }: { clienteId: string }) {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [aba, setAba] = useState<Aba360>("resumo");

  // AC-1: só carrega/renderiza o conteúdo com leitura no módulo pcm (mesma checagem das demais
  // telas do PCM; superadmin já é bypass dentro de podeAcessarModulo). Sem permissão nova.
  const temAcesso = podeAcessar("pcm", "leitura");

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

  const { cliente, metricas, eventos, backlog, historico, equipamentos, qualidade } = estado.visao;

  return (
    <div className="flex flex-col gap-5">
      <CabecalhoCliente cliente={cliente} />
      <PainelCadastroAuvo cliente={cliente} />

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
          metricas={metricas}
          eventos={eventos}
          equipamentos={equipamentos}
          qualidade={qualidade}
        />
      )}

      {aba === "timeline" && <TimelineCliente eventos={eventos} />}

      {aba === "os" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PainelBacklog ordens={backlog} />
          <PainelHistorico ordens={historico} />
        </div>
      )}

      {aba === "qualidade" && <PainelQualidade qualidade={qualidade} />}

      {aba === "ativos" && <PainelEquipamentos equipamentos={equipamentos} />}

      {aba === "financeiro" && <PainelPlanejado titulo="Financeiro" />}

      {aba === "comunicacao" && <PainelComunicacao cliente={cliente} eventos={eventos} />}
    </div>
  );
}

function Resumo360({
  metricas,
  eventos,
  equipamentos,
  qualidade,
}: {
  metricas: Cliente360Metricas;
  eventos: Cliente360Evento[];
  equipamentos: ResultadoEquipamentos;
  qualidade: QualidadeClienteResumo;
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

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <TimelineCliente eventos={eventos} compacta />
        <ResumoOperacional equipamentos={equipamentos} qualidade={qualidade} />
      </div>
    </div>
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

function PainelCadastroAuvo({ cliente }: { cliente: ClienteHeader }) {
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
            <h3 className="text-sm font-semibold text-ink">Cadastro governado pelo Auvo</h3>
          </div>
          <p className="mt-1 text-xs text-ink-3">
            O OS consome o cache sincronizado; alterações cadastrais devem nascer no Auvo e voltar
            no próximo import.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
}: {
  eventos: Cliente360Evento[];
  compacta?: boolean;
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
            {eventosVisiveis.map((evento) => (
              <div key={evento.id} className="relative flex gap-3">
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
                </div>
              </div>
            ))}
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

function PainelPlanejado({ titulo }: { titulo: string }) {
  return (
    <section className="rounded-[8px] border border-dashed border-line bg-card px-5 py-8 text-center">
      <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
      <p className="mt-1 text-sm text-ink-3">
        Dados contratuais e financeiros ainda não têm fonte canônica no OS.
      </p>
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
