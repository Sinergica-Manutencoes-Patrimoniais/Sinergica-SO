import { Clipboard, Download, FileText, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import type { EventoAgendaPcm } from "../domain/planejamento-pcm";
import {
  filtrarEventosPeriodo,
  hojeLocalIso,
  montarTextoRelatorio,
} from "../domain/planejamento-pcm";
import { carregarDadosPlanejamentoPcm } from "./planejamento-pcm-data";
import type { DadosPlanejamentoPcm } from "./planejamento-pcm-data";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; dados: DadosPlanejamentoPcm };

function baixarTexto(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

function formatarData(dataIso: string): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${dataIso}T00:00:00`));
}

export function RelatorioDiarioPage() {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [data, setData] = useState(hojeLocalIso());
  const [clienteId, setClienteId] = useState("");
  const [termo, setTermo] = useState("");
  const [copiado, setCopiado] = useState(false);

  const temLeitura = podeAcessar("pcm", "leitura");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      setEstado({ fase: "pronto", dados: await carregarDadosPlanejamentoPcm() });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem:
          error instanceof Error ? error.message : "Não foi possível carregar relatório diário.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) void carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  const eventos = useMemo(() => {
    if (estado.fase !== "pronto") return [];
    return filtrarEventosPeriodo(estado.dados.eventos, {
      inicioIso: data,
      fimIso: data,
      clienteId,
      termo,
    });
  }, [estado, data, clienteId, termo]);

  const texto = useMemo(
    () =>
      montarTextoRelatorio({
        titulo: "Relatório Diário PCM",
        periodo: `Data: ${formatarData(data)}`,
        eventos,
      }),
    [data, eventos],
  );

  async function copiar() {
    await navigator.clipboard?.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (permissoesCarregando || estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando relatório diário…</div>;
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
        <h2 className="text-lg font-semibold text-ink-2">Relatório indisponível</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button type="button" onClick={carregar} className="mt-4 text-sm font-semibold text-orange">
          Tentar novamente
        </button>
      </div>
    );
  }

  const resumo = {
    os: eventos.filter((evento) => evento.tipo === "os").length,
    qualidade: eventos.filter(
      (evento) => evento.tipo === "inspecao" || evento.tipo === "laudo_spda",
    ).length,
    pmoc: eventos.filter((evento) => evento.tipo === "pmoc").length,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Relatório Diário</h2>
          <p className="text-sm text-ink-3">Resumo operacional do dia para coordenação e cliente</p>
        </div>
        <button
          type="button"
          onClick={carregar}
          className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Registros" value={eventos.length} />
        <Kpi label="OS" value={resumo.os} />
        <Kpi label="Qualidade" value={resumo.qualidade} />
        <Kpi label="PMOC" value={resumo.pmoc} />
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-[10px] border border-line bg-card p-4 lg:grid-cols-[180px_240px_1fr]">
        <input
          className="input"
          type="date"
          value={data}
          onChange={(event) => setData(event.target.value)}
        />
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
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            className="input !pl-9"
            placeholder="Buscar no relatório"
            value={termo}
            onChange={(event) => setTermo(event.target.value)}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <section className="overflow-hidden rounded-[10px] border border-line bg-card">
          <div className="border-b border-line-soft px-5 py-4">
            <h3 className="text-sm font-semibold text-ink">Registros do dia</h3>
            <p className="mt-0.5 text-xs text-ink-3">{formatarData(data)}</p>
          </div>
          <div className="divide-y divide-line-soft">
            {eventos.length === 0 ? (
              <div className="px-5 py-8 text-sm text-ink-3">Nenhum registro para os filtros.</div>
            ) : (
              eventos.map((evento) => <EventoLinha key={evento.id} evento={evento} />)
            )}
          </div>
        </section>

        <aside className="rounded-[10px] border border-line bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">Prévia do relatório</h3>
              <p className="mt-0.5 text-xs text-ink-3">Texto pronto para copiar ou baixar</p>
            </div>
            <FileText className="h-4 w-4 text-orange" />
          </div>
          <div className="p-5">
            <textarea className="input min-h-[300px] font-mono text-xs" readOnly value={texto} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copiar}
                className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
              >
                <Clipboard className="h-4 w-4" />
                {copiado ? "Copiado" : "Copiar"}
              </button>
              <button
                type="button"
                onClick={() => baixarTexto(`relatorio-diario-${data}.txt`, texto)}
                className="inline-flex items-center gap-2 rounded-[6px] bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-deep"
              >
                <Download className="h-4 w-4" />
                Baixar TXT
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EventoLinha({ evento }: { evento: EventoAgendaPcm }) {
  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-orange-soft px-2 py-0.5 text-[11px] font-semibold text-orange-deep">
          {evento.tipo}
        </span>
        <span className="text-xs text-ink-3">{evento.status}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-ink">{evento.titulo}</p>
      <p className="mt-1 text-xs text-ink-3">
        {evento.clienteNome}
        {evento.responsavel ? ` · ${evento.responsavel}` : ""}
      </p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] border border-line bg-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</p>
      <p className="mt-2 font-brand text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
