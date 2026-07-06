import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  Snowflake,
  Users,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import type { EventoAgendaPcm, EventoAgendaTipo } from "../domain/planejamento-pcm";
import {
  adicionarDiasIso,
  agruparEventosPorData,
  diasSemanaIso,
  filtrarEventosPeriodo,
  hojeLocalIso,
  inicioSemanaIso,
} from "../domain/planejamento-pcm";
import { carregarDadosPlanejamentoPcm } from "./planejamento-pcm-data";
import type { DadosPlanejamentoPcm } from "./planejamento-pcm-data";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; dados: DadosPlanejamentoPcm };

const TIPO_LABEL: Record<EventoAgendaTipo, string> = {
  os: "OS",
  inspecao: "Inspeção",
  laudo_spda: "SPDA",
  pmoc: "PMOC",
};

const TIPO_ICON: Record<EventoAgendaTipo, typeof ClipboardList> = {
  os: ClipboardList,
  inspecao: ShieldCheck,
  laudo_spda: Zap,
  pmoc: Snowflake,
};

function formatarDataCurta(dataIso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
    new Date(`${dataIso}T00:00:00`),
  );
}

function formatarSemana(inicioIso: string): string {
  return `${formatarDataCurta(inicioIso)} a ${formatarDataCurta(adicionarDiasIso(inicioIso, 6))}`;
}

function nomeDia(dataIso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(new Date(`${dataIso}T00:00:00`))
    .replace(".", "");
}

export function CronogramaPage() {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [semanaInicio, setSemanaInicio] = useState(() => inicioSemanaIso(hojeLocalIso()));
  const [clienteId, setClienteId] = useState("");
  const [termo, setTermo] = useState("");

  const temLeitura = podeAcessar("pcm", "leitura");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      setEstado({ fase: "pronto", dados: await carregarDadosPlanejamentoPcm() });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar cronograma.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) void carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  const dias = useMemo(() => diasSemanaIso(semanaInicio), [semanaInicio]);
  const fimSemana = dias[6] ?? semanaInicio;

  const eventos = useMemo(() => {
    if (estado.fase !== "pronto") return [];
    return filtrarEventosPeriodo(estado.dados.eventos, {
      inicioIso: semanaInicio,
      fimIso: fimSemana,
      clienteId,
      termo,
    });
  }, [estado, semanaInicio, fimSemana, clienteId, termo]);

  const eventosPorData = useMemo(() => agruparEventosPorData(eventos), [eventos]);
  const resumo = useMemo(
    () => ({
      total: eventos.length,
      os: eventos.filter((evento) => evento.tipo === "os").length,
      pmoc: eventos.filter((evento) => evento.tipo === "pmoc").length,
      qualidade: eventos.filter(
        (evento) => evento.tipo === "inspecao" || evento.tipo === "laudo_spda",
      ).length,
    }),
    [eventos],
  );

  if (permissoesCarregando || estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando cronograma…</div>;
  }

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
      <div className="rounded-[10px] border border-line bg-card p-8 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Cronograma indisponível</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button type="button" onClick={carregar} className="mt-4 text-sm font-semibold text-orange">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Cronograma operacional</h2>
          <p className="text-sm text-ink-3">
            Semana consolidada de OS, inspeções, laudos SPDA e próximas visitas PMOC
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSemanaInicio((atual) => adicionarDiasIso(atual, -7))}
            className="rounded-[6px] border border-line p-2 text-ink-2 hover:bg-line-soft"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSemanaInicio(inicioSemanaIso(hojeLocalIso()))}
            className="rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setSemanaInicio((atual) => adicionarDiasIso(atual, 7))}
            className="rounded-[6px] border border-line p-2 text-ink-2 hover:bg-line-soft"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={carregar}
            className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Semana" value={formatarSemana(semanaInicio)} icon={Calendar} compact />
        <Kpi label="Eventos" value={String(resumo.total)} icon={ClipboardList} />
        <Kpi label="PMOC" value={String(resumo.pmoc)} icon={Snowflake} />
        <Kpi label="Qualidade" value={String(resumo.qualidade)} icon={ShieldCheck} />
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-[10px] border border-line bg-card p-4 lg:grid-cols-[1fr_220px_220px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            className="input !pl-9"
            placeholder="Buscar cliente, título ou status"
            value={termo}
            onChange={(event) => setTermo(event.target.value)}
          />
        </label>
        <select
          className="input"
          value={clienteId}
          onChange={(event) => setClienteId(event.target.value)}
        >
          <option value="">Todos os clientes</option>
          {estado.dados.clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nome}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 rounded-[6px] border border-line-soft px-3 py-2 text-sm text-ink-3">
          <Users className="h-4 w-4 text-orange" />
          {estado.dados.tecnicos.length} técnicos Auvo
        </div>
      </div>

      <section className="overflow-hidden rounded-[10px] border border-line bg-card">
        <div className="grid grid-cols-1 divide-y divide-line-soft lg:grid-cols-7 lg:divide-x lg:divide-y-0">
          {dias.map((dia) => (
            <DiaCronograma key={dia} dataIso={dia} eventos={eventosPorData.get(dia) ?? []} />
          ))}
        </div>
      </section>

      <section className="rounded-[10px] border border-line bg-card">
        <div className="border-b border-line-soft px-5 py-4">
          <h3 className="text-sm font-semibold text-ink">Equipe Auvo sincronizada</h3>
          <p className="mt-0.5 text-xs text-ink-3">
            Base real para planejamento e distribuição futura
          </p>
        </div>
        {estado.dados.tecnicos.length === 0 ? (
          <div className="px-5 py-8 text-sm text-ink-3">Nenhum técnico ativo no cache Auvo.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
            {estado.dados.tecnicos.map((tecnico) => (
              <div key={tecnico.id} className="rounded-[8px] border border-line-soft px-4 py-3">
                <p className="truncate text-sm font-semibold text-ink">{tecnico.nome}</p>
                <p className="mt-1 text-xs text-ink-3">
                  {tecnico.equipe || "Sem equipe"} · Auvo #{tecnico.auvoUserId}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DiaCronograma({ dataIso, eventos }: { dataIso: string; eventos: EventoAgendaPcm[] }) {
  const hoje = dataIso === hojeLocalIso();
  return (
    <div className={hoje ? "bg-orange-soft/20" : ""}>
      <div className="border-b border-line-soft px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          {nomeDia(dataIso)}
        </p>
        <p className="mt-1 text-sm font-semibold text-ink">{formatarDataCurta(dataIso)}</p>
      </div>
      <div className="min-h-[260px] space-y-2 p-3">
        {eventos.length === 0 ? (
          <p className="pt-8 text-center text-xs text-ink-3">Sem agenda</p>
        ) : (
          eventos.map((evento) => <EventoCard key={evento.id} evento={evento} />)
        )}
      </div>
    </div>
  );
}

function EventoCard({ evento }: { evento: EventoAgendaPcm }) {
  const Icon = TIPO_ICON[evento.tipo];
  return (
    <div className="rounded-[8px] border border-line-soft bg-paper px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange">
          <Icon className="h-3.5 w-3.5" />
          {TIPO_LABEL[evento.tipo]}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs font-semibold text-ink">{evento.titulo}</p>
      <p className="mt-1 truncate text-[11px] text-ink-3">{evento.clienteNome}</p>
      <p className="mt-2 truncate text-[11px] text-ink-3">{evento.status}</p>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  compact = false,
}: {
  label: string;
  value: string;
  icon: typeof Calendar;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[8px] border border-line bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</p>
        <Icon className="h-4 w-4 text-orange" />
      </div>
      <p className={`mt-2 font-brand font-bold text-ink ${compact ? "text-lg" : "text-2xl"}`}>
        {value}
      </p>
    </div>
  );
}
