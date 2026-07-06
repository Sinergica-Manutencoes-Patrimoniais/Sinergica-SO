import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
  Snowflake,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  PRIORIDADE_LABEL,
  prioridadeColor,
  rotuloStatusOs,
  statusOsColor,
} from "../domain/ordens-servico";
import { hojeLocalIso } from "../domain/planejamento-pcm";
import { STATUS_CONTRATO_LABEL, statusContratoColor } from "../domain/pmoc";
import { carregarDadosPlanejamentoPcm } from "./planejamento-pcm-data";
import type { DadosPlanejamentoPcm } from "./planejamento-pcm-data";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; dados: DadosPlanejamentoPcm };

function formatarData(dataIso: string | null): string {
  if (!dataIso) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${dataIso}T00:00:00`));
}

export function PreventivasPage({ onNovaOs }: { onNovaOs: () => void }) {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [clienteId, setClienteId] = useState("");

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      setEstado({ fase: "pronto", dados: await carregarDadosPlanejamentoPcm() });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar preventivas.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) void carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  const dadosFiltrados = useMemo(() => {
    if (estado.fase !== "pronto") return null;
    const ordensPreventivas = estado.dados.ordens.filter(
      (ordem) => ordem.categoria === "preventiva" && (!clienteId || ordem.clientId === clienteId),
    );
    const pmoc = estado.dados.pmoc.filter(
      (contrato) => !clienteId || contrato.clientId === clienteId,
    );
    const hoje = hojeLocalIso();
    return {
      ordensPreventivas,
      pmoc,
      pmocAtrasados: pmoc.filter(
        (contrato) => contrato.proximaVisita && contrato.proximaVisita < hoje,
      ).length,
      pmocRenovar: pmoc.filter((contrato) => contrato.status === "renovar").length,
      proximasPmoc: [...pmoc]
        .filter((contrato) => contrato.proximaVisita)
        .sort((a, b) => (a.proximaVisita ?? "").localeCompare(b.proximaVisita ?? ""))
        .slice(0, 8),
    };
  }, [estado, clienteId]);

  if (permissoesCarregando || estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando preventivas…</div>;
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
        <h2 className="text-lg font-semibold text-ink-2">Preventivas indisponíveis</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button type="button" onClick={carregar} className="mt-4 text-sm font-semibold text-orange">
          Tentar novamente
        </button>
      </div>
    );
  }

  const resumo = dadosFiltrados ?? {
    ordensPreventivas: [],
    pmoc: [],
    pmocAtrasados: 0,
    pmocRenovar: 0,
    proximasPmoc: [],
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Preventivas</h2>
          <p className="text-sm text-ink-3">
            Esteira de manutenção preventiva com OS recorrentes, PMOC e alertas de vencimento
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={carregar}
            className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          {temEscrita && (
            <button
              type="button"
              onClick={onNovaOs}
              className="inline-flex items-center gap-2 rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep"
            >
              <Wrench className="h-4 w-4" />
              Nova OS preventiva
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="OS preventivas" value={resumo.ordensPreventivas.length} icon={ClipboardList} />
        <Kpi label="Contratos PMOC" value={resumo.pmoc.length} icon={Snowflake} />
        <Kpi label="PMOC atrasados" value={resumo.pmocAtrasados} icon={AlertTriangle} danger />
        <Kpi label="Renovar ART" value={resumo.pmocRenovar} icon={ShieldCheck} danger />
      </div>

      <div className="rounded-[10px] border border-line bg-card p-4">
        <select
          className="input max-w-sm"
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
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <section className="overflow-hidden rounded-[10px] border border-line bg-card">
          <div className="border-b border-line-soft px-5 py-4">
            <h3 className="text-sm font-semibold text-ink">OS preventivas</h3>
            <p className="mt-0.5 text-xs text-ink-3">Chamados de categoria preventiva no PCM</p>
          </div>
          <div className="divide-y divide-line-soft">
            {resumo.ordensPreventivas.length === 0 ? (
              <div className="px-5 py-8 text-sm text-ink-3">Nenhuma OS preventiva encontrada.</div>
            ) : (
              resumo.ordensPreventivas.map((ordem) => (
                <div key={ordem.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-brand text-xs text-ink-3">{ordem.numero}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusOsColor(ordem.status)}`}
                    >
                      {rotuloStatusOs(ordem.status)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${prioridadeColor(ordem.prioridade)}`}
                    >
                      {PRIORIDADE_LABEL[ordem.prioridade] ?? ordem.prioridade}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink">{ordem.titulo}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    {ordem.clienteNome} · criada em {formatarData(ordem.createdAt.slice(0, 10))}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[10px] border border-line bg-card">
            <div className="border-b border-line-soft px-5 py-4">
              <h3 className="text-sm font-semibold text-ink">Próximas visitas PMOC</h3>
              <p className="mt-0.5 text-xs text-ink-3">Agenda legal de climatização</p>
            </div>
            <div className="divide-y divide-line-soft">
              {resumo.proximasPmoc.length === 0 ? (
                <div className="px-5 py-8 text-sm text-ink-3">Nenhuma visita PMOC prevista.</div>
              ) : (
                resumo.proximasPmoc.map((contrato) => (
                  <div key={contrato.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {contrato.imovelNome}
                        </p>
                        <p className="mt-1 text-xs text-ink-3">{contrato.clienteNome}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusContratoColor(contrato.status)}`}
                      >
                        {STATUS_CONTRATO_LABEL[contrato.status]}
                      </span>
                    </div>
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                      <CalendarClock className="h-3.5 w-3.5 text-orange" />
                      {formatarData(contrato.proximaVisita)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[10px] border border-line bg-card p-5">
            <h3 className="text-sm font-semibold text-ink">Leitura de gestor</h3>
            <div className="mt-3 space-y-2 text-sm text-ink-3">
              <p>
                Use as OS preventivas para rotinas de contrato fora do PMOC e o PMOC para obrigações
                legais de climatização.
              </p>
              <p>
                A próxima etapa natural é converter visitas PMOC em OS planejadas no Auvo quando o
                cronograma estiver aprovado.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  danger = false,
}: {
  label: string;
  value: number;
  icon: typeof ClipboardList;
  danger?: boolean;
}) {
  return (
    <div className="rounded-[8px] border border-line bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</p>
        <Icon className={`h-4 w-4 ${danger && value > 0 ? "text-orange" : "text-ink-3"}`} />
      </div>
      <p
        className={`mt-2 font-brand text-2xl font-bold ${danger && value > 0 ? "text-orange" : "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}
