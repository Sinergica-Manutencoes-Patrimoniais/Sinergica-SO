import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  buscarValorHoraTecnico,
  obterApontamentoHoras,
  obterTendenciaTecnico,
} from "../application/apontamento-horas";
import type {
  ClienteOpcaoHoras,
  TecnicoOpcaoHoras,
} from "../application/apontamento-horas-gateway";
import {
  calcularCusto,
  formatarHorasMinutos,
  gerarCsvApontamento,
  horaLocal,
} from "../domain/apontamento-horas";
import type {
  AgregadoHoras,
  ApontamentoHorasItem,
  DiaTecnico,
  SinalJornada,
  TendenciaSemana,
} from "../domain/apontamento-horas";
import { supabaseApontamentoHorasAdapter } from "../infrastructure/supabase-apontamento-horas-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | {
      fase: "pronto";
      itens: ApontamentoHorasItem[];
      clientes: ClienteOpcaoHoras[];
      tecnicos: TecnicoOpcaoHoras[];
      porCliente: AgregadoHoras[];
      porTecnico: AgregadoHoras[];
      porDia: DiaTecnico[];
    };

type Aba = "periodo" | "dia";

function inicioDoMes(): string {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().slice(0, 10);
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ApontamentoHorasPage({
  onAbrirCliente,
  onAbrirTecnico,
}: {
  /** AC-5 (E01-S75): clique numa linha de "Horas por cliente" abre a visão 360 já filtrada ao
   * mesmo período. `chave === "sem-vinculo"` nunca chama isto (não tem cliente pra abrir). */
  onAbrirCliente?: (clienteId: string, periodo: { inicio: string; fim: string }) => void;
  /** Clique numa linha de "Horas por técnico" abre Ordens de Serviço filtrada por ele+período. */
  onAbrirTecnico?: (tecnicoFuncionarioId: string, periodo: { inicio: string; fim: string }) => void;
}) {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [inicio, setInicio] = useState(inicioDoMes());
  const [fim, setFim] = useState(hoje());
  const [tecnicoFuncionarioId, setTecnicoFuncionarioId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [custosPorTecnico, setCustosPorTecnico] = useState<Map<string, number | null>>(new Map());
  const [aba, setAba] = useState<Aba>("periodo");

  const temLeitura = podeAcessar("pcm", "leitura");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const resultado = await obterApontamentoHoras(supabaseApontamentoHorasAdapter, {
        inicio,
        fim,
        tecnicoFuncionarioId: tecnicoFuncionarioId || null,
        clienteId: clienteId || null,
      });
      setEstado({ fase: "pronto", ...resultado });
      const custos = await Promise.all(
        resultado.porTecnico
          .filter((item) => item.chave !== "sem-vinculo")
          .map(
            async (item) =>
              [
                item.chave,
                await buscarValorHoraTecnico(supabaseApontamentoHorasAdapter, item.chave),
              ] as const,
          ),
      );
      setCustosPorTecnico(new Map(custos));
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar apontamento.",
      });
    }
  }, [inicio, fim, tecnicoFuncionarioId, clienteId]);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  const temAlgumCusto = useMemo(
    () => [...custosPorTecnico.values()].some((v) => v != null),
    [custosPorTecnico],
  );

  if (permissoesCarregando)
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
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
        <h3 className="text-base font-semibold text-ink">Apontamento de Horas</h3>
        <p className="mt-0.5 text-sm text-ink-3">
          Horas por OS derivadas do Auvo (check-in/out) — liga tarefa, técnico e cliente
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">De</span>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="input h-9 w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Até</span>
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="input h-9 w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Técnico</span>
            <select
              value={tecnicoFuncionarioId}
              onChange={(e) => setTecnicoFuncionarioId(e.target.value)}
              className="input h-9 w-full"
            >
              <option value="">Todos</option>
              {estado.tecnicos.map((tecnico) => (
                <option key={tecnico.id} value={tecnico.id}>
                  {tecnico.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Cliente</span>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="input h-9 w-full"
            >
              <option value="">Todos</option>
              {estado.clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="flex gap-1 border-b border-line">
        <button
          type="button"
          onClick={() => setAba("periodo")}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
            aba === "periodo"
              ? "border-orange text-ink"
              : "border-transparent text-ink-3 hover:text-ink-2"
          }`}
        >
          Por período
        </button>
        <button
          type="button"
          onClick={() => setAba("dia")}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
            aba === "dia"
              ? "border-orange text-ink"
              : "border-transparent text-ink-3 hover:text-ink-2"
          }`}
        >
          Por dia
        </button>
      </div>

      {aba === "dia" && (
        <VisaoPorDia
          dias={estado.porDia}
          tecnicoFuncionarioId={tecnicoFuncionarioId || null}
          periodo={{ inicio, fim }}
        />
      )}

      <div hidden={aba !== "periodo"} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <AgregadoPainel
            titulo="Horas por cliente"
            itens={estado.porCliente}
            custosPorChave={null}
            onSelecionar={
              onAbrirCliente ? (chave) => onAbrirCliente(chave, { inicio, fim }) : undefined
            }
          />
          <AgregadoPainel
            titulo="Horas por técnico"
            itens={estado.porTecnico}
            custosPorChave={custosPorTecnico}
            onSelecionar={
              onAbrirTecnico ? (chave) => onAbrirTecnico(chave, { inicio, fim }) : undefined
            }
          />
        </div>
        {!temAlgumCusto && (
          <p className="text-xs text-ink-3">
            Custo disponível quando o módulo Financeiro estiver ativo (E04-S06).
          </p>
        )}

        <section className="rounded-[8px] border border-line bg-card overflow-hidden">
          <div className="border-b border-line-soft px-4 py-3">
            <h4 className="text-sm font-semibold text-ink">OS no período</h4>
            <p className="text-xs text-ink-3">{estado.itens.length} ordem(ns) de serviço</p>
          </div>
          {estado.itens.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Clock className="mx-auto h-9 w-9 text-ink-3" />
              <p className="mt-3 text-sm text-ink-3">Nenhuma OS com apontamento neste período.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-line bg-line-soft text-xs uppercase text-ink-3">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">OS</th>
                    <th className="px-4 py-2.5 font-semibold">Cliente</th>
                    <th className="px-4 py-2.5 font-semibold">Técnico</th>
                    <th className="px-4 py-2.5 font-semibold">Data</th>
                    <th className="px-4 py-2.5 font-semibold">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {estado.itens.map((item) => (
                    <tr key={item.osId} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-2.5 font-brand text-xs tabular-nums text-ink-3">
                        {item.osNumero}
                      </td>
                      <td className="px-4 py-2.5 text-ink-2">{item.clienteNome}</td>
                      <td className="px-4 py-2.5 text-ink-2">{item.tecnicoNome}</td>
                      <td className="px-4 py-2.5 text-ink-3">
                        {item.dataAgendada
                          ? new Date(item.dataAgendada).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-ink">
                        {item.horas > 0 ? `${item.horas}h` : "sem apontamento"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AgregadoPainel({
  titulo,
  itens,
  custosPorChave,
  onSelecionar,
}: {
  titulo: string;
  itens: AgregadoHoras[];
  custosPorChave: Map<string, number | null> | null;
  /** AC-5: ausente = linhas não clicáveis (mantém o painel utilizável sem callback de navegação). */
  onSelecionar?: (chave: string) => void;
}) {
  return (
    <section className="rounded-[8px] border border-line bg-card overflow-hidden">
      <div className="border-b border-line-soft px-4 py-3">
        <h4 className="text-sm font-semibold text-ink">{titulo}</h4>
      </div>
      {itens.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-3">Sem dados no período.</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {itens.map((item) => {
            const valorHora = custosPorChave?.get(item.chave) ?? null;
            const custo = calcularCusto(item.totalHoras, valorHora);
            // "sem-vinculo" (OS sem cliente/técnico) não tem destino de navegação nenhum.
            const clicavel = Boolean(onSelecionar) && item.chave !== "sem-vinculo";
            const linha = (
              <>
                <span className="min-w-0 truncate text-ink-2">{item.nome}</span>
                <span className="shrink-0 font-semibold text-ink">
                  {item.totalHoras}h · {item.totalOs} OS
                  {custo != null && (
                    <span className="ml-2 text-xs font-normal text-ink-3">
                      R$ {custo.toFixed(2)}
                    </span>
                  )}
                </span>
              </>
            );
            if (clicavel) {
              return (
                <li key={item.chave}>
                  <button
                    type="button"
                    onClick={() => onSelecionar?.(item.chave)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-line-soft/60"
                  >
                    {linha}
                  </button>
                </li>
              );
            }
            return (
              <li
                key={item.chave}
                className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
              >
                {linha}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatarDiaBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function VisaoPorDia({
  dias,
  tecnicoFuncionarioId,
  periodo,
}: {
  dias: DiaTecnico[];
  tecnicoFuncionarioId: string | null;
  periodo: { inicio: string; fim: string };
}) {
  function exportarCsv() {
    // BOM (﻿) pra o Excel pt-BR ler os acentos; separador `;` já vem do domínio.
    const blob = new Blob([`﻿${gerarCsvApontamento(dias)}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apontamento-horas_${periodo.inicio}_a_${periodo.fim}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-[8px] border border-line bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
          <div>
            <h4 className="text-sm font-semibold text-ink">Por dia</h4>
            <p className="text-xs text-ink-3">
              {dias.length} dia(s) · diferença do dia (1º check-in → último check-out) vs soma das
              OS
            </p>
          </div>
          <button
            type="button"
            onClick={exportarCsv}
            disabled={dias.length === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-line px-3 text-xs font-semibold text-ink-2 hover:bg-line-soft disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        </div>
        {dias.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Clock className="mx-auto h-9 w-9 text-ink-3" />
            <p className="mt-3 text-sm text-ink-3">
              Nenhum apontamento com check-in/out neste período.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line bg-line-soft text-xs uppercase text-ink-3">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Técnico</th>
                  <th className="px-4 py-2.5 font-semibold">Dia</th>
                  <th className="px-4 py-2.5 font-semibold">Check-in</th>
                  <th className="px-4 py-2.5 font-semibold">Check-out</th>
                  <th className="px-4 py-2.5 font-semibold">Diferença do dia</th>
                  <th className="px-4 py-2.5 font-semibold">Soma das OS</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {dias.map((dia) => (
                  <LinhaDia key={dia.chave} dia={dia} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <TendenciaTecnico tecnicoFuncionarioId={tecnicoFuncionarioId} />
    </div>
  );
}

function LinhaDia({ dia }: { dia: DiaTecnico }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <tr className="border-b border-line last:border-b-0">
        <td className="px-4 py-2.5">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="inline-flex items-center gap-1.5 text-left font-semibold text-ink hover:text-orange"
          >
            {aberto ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            {dia.tecnicoNome}
          </button>
        </td>
        <td className="px-4 py-2.5 text-ink-2">{formatarDiaBr(dia.dia)}</td>
        <td className="px-4 py-2.5 tabular-nums text-ink-3">{horaLocal(dia.primeiroCheckIn)}</td>
        <td className="px-4 py-2.5 tabular-nums text-ink-3">{horaLocal(dia.ultimoCheckOut)}</td>
        <td className="px-4 py-2.5 font-semibold tabular-nums text-ink">
          {formatarHorasMinutos(dia.diferencaDiaHoras)}
        </td>
        <td className="px-4 py-2.5 tabular-nums text-ink-2">
          {formatarHorasMinutos(dia.somaOsHoras)} · {dia.quantidadeOs} OS
        </td>
        <td className="px-4 py-2.5">
          <BadgeStatus dia={dia} />
        </td>
      </tr>
      {aberto && (
        <tr className="bg-line-soft/40">
          <td colSpan={7} className="px-4 py-2">
            <ul className="divide-y divide-line-soft">
              {dia.ordens.map((os) => (
                <li
                  key={os.osId}
                  className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs"
                >
                  <span className="font-brand tabular-nums text-ink-3">{os.osNumero}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-2">{os.clienteNome}</span>
                  <span className="tabular-nums text-ink-3">
                    {horaLocal(os.checkInAt)}–{horaLocal(os.checkOutAt)}
                  </span>
                  <span className="font-semibold tabular-nums text-ink">
                    {formatarHorasMinutos(os.horas)}
                  </span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

function BadgeStatus({ dia }: { dia: DiaTecnico }) {
  if (dia.incompleto) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3E7] px-2 py-0.5 text-[11px] font-semibold text-[#8A4B00]">
        <AlertTriangle className="h-3 w-3" />
        Incompleto
      </span>
    );
  }
  const mapa: Record<Exclude<SinalJornada, null>, { label: string; cls: string }> = {
    falta: { label: "Abaixo da jornada", cls: "bg-[#FCE9E6] text-[#A23B25]" },
    "hora-extra": { label: "Hora extra", cls: "bg-[#EAF3FF] text-[#1F5FA6]" },
    ok: { label: "Completo", cls: "bg-[#E7F6EC] text-[#1E8E45]" },
  };
  if (dia.sinalJornada) {
    const s = mapa[dia.sinalJornada];
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
        {s.label}
      </span>
    );
  }
  return <span className="text-[11px] text-ink-3">—</span>;
}

type EstadoTendencia =
  | { fase: "inicial" }
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; semanas: TendenciaSemana[] };

function TendenciaTecnico({ tecnicoFuncionarioId }: { tecnicoFuncionarioId: string | null }) {
  const [estado, setEstado] = useState<EstadoTendencia>({ fase: "inicial" });

  const carregar = useCallback(async () => {
    if (!tecnicoFuncionarioId) return;
    setEstado({ fase: "carregando" });
    try {
      const semanas = await obterTendenciaTecnico(
        supabaseApontamentoHorasAdapter,
        tecnicoFuncionarioId,
        8,
      );
      setEstado({ fase: "pronto", semanas });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar a tendência.",
      });
    }
  }, [tecnicoFuncionarioId]);

  if (!tecnicoFuncionarioId) {
    return (
      <section className="rounded-[8px] border border-dashed border-line bg-card px-4 py-3 text-xs text-ink-3">
        <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
        Selecione um técnico no filtro acima para ver a tendência semanal (últimas 8 semanas).
      </section>
    );
  }

  const maxHoras =
    estado.fase === "pronto" ? Math.max(1, ...estado.semanas.map((s) => s.totalHoras)) : 1;

  return (
    <section className="rounded-[8px] border border-line bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
        <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
          <TrendingUp className="h-4 w-4" />
          Tendência semanal (8 semanas)
        </h4>
        <button
          type="button"
          onClick={carregar}
          disabled={estado.fase === "carregando"}
          className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-line px-3 text-xs font-semibold text-ink-2 hover:bg-line-soft disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {estado.fase === "carregando" ? "Carregando..." : "Carregar"}
        </button>
      </div>
      {estado.fase === "inicial" && (
        <p className="px-4 py-6 text-sm text-ink-3">
          Clique em "Carregar" para ver as horas de OS por semana.
        </p>
      )}
      {estado.fase === "erro" && (
        <p className="px-4 py-6 text-sm text-[#A23B25]">{estado.mensagem}</p>
      )}
      {estado.fase === "pronto" &&
        (estado.semanas.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-3">Sem horas nas últimas 8 semanas.</p>
        ) : (
          <ul className="flex flex-col gap-2 px-4 py-3">
            {estado.semanas.map((semana) => (
              <li key={semana.semanaInicio} className="flex items-center gap-3 text-xs">
                <span className="w-24 shrink-0 tabular-nums text-ink-3">
                  {formatarDiaBr(semana.semanaInicio)}
                </span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-line-soft">
                  <span
                    className="block h-full rounded-full bg-orange"
                    style={{ width: `${(semana.totalHoras / maxHoras) * 100}%` }}
                  />
                </span>
                <span className="w-28 shrink-0 text-right font-semibold tabular-nums text-ink">
                  {formatarHorasMinutos(semana.totalHoras)} · {semana.quantidadeOs} OS
                </span>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
