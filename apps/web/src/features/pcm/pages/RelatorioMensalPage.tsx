import { Clipboard, Download, FileBarChart2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  filtrarEventosPeriodo,
  fimMesIso,
  inicioMesIso,
  montarTextoRelatorio,
  resumirClientesMensal,
} from "../domain/planejamento-pcm";
import { carregarDadosPlanejamentoPcm } from "./planejamento-pcm-data";
import type { DadosPlanejamentoPcm } from "./planejamento-pcm-data";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; dados: DadosPlanejamentoPcm };

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function baixarTexto(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

export function RelatorioMensalPage() {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const agora = new Date();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth());
  const [clienteId, setClienteId] = useState("");
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
          error instanceof Error ? error.message : "Não foi possível carregar relatório mensal.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) void carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  const inicio = inicioMesIso(ano, mes);
  const fim = fimMesIso(ano, mes);

  const eventos = useMemo(() => {
    if (estado.fase !== "pronto") return [];
    return filtrarEventosPeriodo(estado.dados.eventos, {
      inicioIso: inicio,
      fimIso: fim,
      clienteId,
    });
  }, [estado, inicio, fim, clienteId]);

  const clientesResumo = useMemo(() => resumirClientesMensal(eventos), [eventos]);
  const texto = useMemo(
    () =>
      montarTextoRelatorio({
        titulo: "Relatório Mensal PCM",
        periodo: `${MESES[mes]} de ${ano} · ${inicio} a ${fim}`,
        eventos,
      }),
    [ano, mes, inicio, fim, eventos],
  );

  async function copiar() {
    await navigator.clipboard?.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (permissoesCarregando || estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando relatório mensal…</div>;
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
    inspecoes: eventos.filter((evento) => evento.tipo === "inspecao").length,
    laudos: eventos.filter((evento) => evento.tipo === "laudo_spda").length,
    pmoc: eventos.filter((evento) => evento.tipo === "pmoc").length,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Relatório Mensal</h2>
          <p className="text-sm text-ink-3">
            Consolidação por cliente para acompanhamento gerencial e prestação de contas
          </p>
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Registros" value={eventos.length} />
        <Kpi label="OS" value={resumo.os} />
        <Kpi label="Inspeções" value={resumo.inspecoes} />
        <Kpi label="SPDA" value={resumo.laudos} />
        <Kpi label="PMOC" value={resumo.pmoc} />
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-[10px] border border-line bg-card p-4 md:grid-cols-3">
        <select
          className="input"
          value={mes}
          onChange={(event) => setMes(Number(event.target.value))}
        >
          {MESES.map((nome, index) => (
            <option key={nome} value={index}>
              {nome}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={ano}
          onChange={(event) => setAno(Number(event.target.value))}
        >
          {[agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
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
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <section className="overflow-hidden rounded-[10px] border border-line bg-card">
          <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">Resumo por cliente</h3>
              <p className="mt-0.5 text-xs text-ink-3">
                {MESES[mes]} de {ano}
              </p>
            </div>
            <FileBarChart2 className="h-4 w-4 text-orange" />
          </div>
          <div className="divide-y divide-line-soft">
            {clientesResumo.length === 0 ? (
              <div className="px-5 py-8 text-sm text-ink-3">Nenhum registro no período.</div>
            ) : (
              clientesResumo.map((cliente) => (
                <div
                  key={cliente.clienteNome}
                  className="grid grid-cols-2 gap-3 px-5 py-4 lg:grid-cols-[1fr_repeat(5,70px)]"
                >
                  <div className="col-span-2 min-w-0 lg:col-span-1">
                    <p className="truncate text-sm font-semibold text-ink">{cliente.clienteNome}</p>
                    <p className="mt-1 text-xs text-ink-3">{cliente.totalEventos} registros</p>
                  </div>
                  <Mini label="OS" value={cliente.ordens} />
                  <Mini label="INSP" value={cliente.inspecoes} />
                  <Mini label="SPDA" value={cliente.laudos} />
                  <Mini label="PMOC" value={cliente.pmoc} />
                  <Mini label="Total" value={cliente.totalEventos} strong />
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="rounded-[10px] border border-line bg-card">
          <div className="border-b border-line-soft px-5 py-4">
            <h3 className="text-sm font-semibold text-ink">Prévia do relatório</h3>
            <p className="mt-0.5 text-xs text-ink-3">Arquivo textual gerado localmente</p>
          </div>
          <div className="p-5">
            <textarea className="input min-h-[360px] font-mono text-xs" readOnly value={texto} />
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
                onClick={() =>
                  baixarTexto(
                    `relatorio-mensal-${ano}-${String(mes + 1).padStart(2, "0")}.txt`,
                    texto,
                  )
                }
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

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] border border-line bg-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</p>
      <p className="mt-2 font-brand text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function Mini({
  label,
  value,
  strong = false,
}: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="rounded-[6px] border border-line-soft px-2 py-1.5 text-center">
      <p className="text-[10px] font-semibold uppercase text-ink-3">{label}</p>
      <p className={`font-brand text-lg font-bold ${strong ? "text-orange" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}
