import { Skeleton } from "@sinergica/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Send } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { flagLigada } from "../../../config/flags-sso";
import { criarRelatorioPdf } from "../../../lib/pdf/relatorio-pdf";
import {
  erroPeriodoRelatorioCliente,
  obterRelatorioCliente,
} from "../application/relatorio-cliente";
import {
  relatorioClienteQueryKeys,
  useClientesRelatorioQuery,
} from "../application/relatorio-cliente-queries";
import { type RelatorioCliente, formatarTextoRelatorioCliente } from "../domain/relatorio-cliente";
import { supabaseAgendaTecnicoAdapter } from "../infrastructure/supabase-agenda-tecnico-adapter";
import { supabaseCliente360Adapter } from "../infrastructure/supabase-cliente-360-adapter";
import { supabaseHubOsAdapter } from "../infrastructure/supabase-hub-os-adapter";
import { supabasePmocAdapter } from "../infrastructure/supabase-pmoc-adapter";
import { supabaseQualidadeAdapter } from "../infrastructure/supabase-qualidade-adapter";
import { supabaseRelatorioClienteAdapter } from "../infrastructure/supabase-relatorio-cliente-adapter";
import { RelatorioClienteDespesas } from "../interfaces/despesas-visita/RelatorioClienteDespesas";

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function inicioDoMes(): string {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().slice(0, 10);
}

export function RelatorioClientePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const consultaClientes = useClientesRelatorioQuery(supabaseCliente360Adapter, user?.id);
  const clientes = consultaClientes.data ?? [];
  const revisaoFiltros = useRef(0);
  const [clienteId, setClienteId] = useState("");
  const [inicio, setInicio] = useState(inicioDoMes);
  const [fim, setFim] = useState(hoje);
  const [relatorio, setRelatorio] = useState<RelatorioCliente | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [publicado, setPublicado] = useState(false);

  const erroPeriodo = erroPeriodoRelatorioCliente({ inicio, fim });
  const carregando = consultaClientes.isLoading || gerando;

  function alterarFiltro(setValor: (valor: string) => void, valor: string) {
    revisaoFiltros.current += 1;
    setValor(valor);
    setRelatorio(null);
    setPublicado(false);
    setErro(null);
  }

  async function gerar() {
    const cliente = clientes.find((item) => item.id === clienteId);
    if (!cliente || !user || erroPeriodo || gerando) return;

    revisaoFiltros.current += 1;
    const revisao = revisaoFiltros.current;
    setGerando(true);
    setRelatorio(null);
    setErro(null);
    setPublicado(false);
    try {
      const resultado = await queryClient.fetchQuery({
        queryKey: relatorioClienteQueryKeys.periodo(user.id, clienteId, inicio, fim),
        staleTime: 0,
        queryFn: () =>
          obterRelatorioCliente(
            supabaseHubOsAdapter,
            supabaseAgendaTecnicoAdapter,
            supabasePmocAdapter,
            supabaseQualidadeAdapter,
            cliente,
            { inicio, fim },
          ),
      });
      if (revisao === revisaoFiltros.current) setRelatorio(resultado);
    } catch (causa) {
      if (revisao === revisaoFiltros.current) {
        setErro(causa instanceof Error ? causa.message : "Não foi possível gerar o relatório.");
      }
    } finally {
      setGerando(false);
    }
  }

  async function baixarPdf() {
    if (!relatorio || erroPeriodo || baixando) return;
    const revisao = revisaoFiltros.current;
    setBaixando(true);
    try {
      const pdf = await criarRelatorioPdf({
        titulo: "Relatório de Atividades",
        subtitulo: `${relatorio.clienteNome} · ${relatorio.inicio} a ${relatorio.fim}`,
      });
      pdf.escreverTexto(formatarTextoRelatorioCliente(relatorio));
      const bytes = await pdf.finalizar();
      if (revisao !== revisaoFiltros.current) return;
      const url = URL.createObjectURL(
        new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio-${relatorio.clienteNome.toLowerCase().replaceAll(/[^a-z0-9]+/gi, "-")}-${relatorio.fim}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      if (revisao === revisaoFiltros.current) setErro("Não foi possível gerar o PDF do relatório.");
    } finally {
      setBaixando(false);
    }
  }

  async function publicar() {
    if (!relatorio || !user || erroPeriodo || publicando || publicado) return;
    const revisao = revisaoFiltros.current;
    setPublicando(true);
    setErro(null);
    try {
      await supabaseRelatorioClienteAdapter.publicar(relatorio, user.id);
      if (revisao === revisaoFiltros.current) setPublicado(true);
    } catch (causa) {
      if (revisao === revisaoFiltros.current) {
        setErro(causa instanceof Error ? causa.message : "Não foi possível publicar no Portal.");
      }
    } finally {
      setPublicando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-heading font-semibold text-ink">Relatório do Cliente</h1>
        <p className="text-body text-ink-3">
          Apresentação de atividades e próximos passos para o condomínio
        </p>
      </div>
      <div className="flex flex-wrap gap-2 rounded-lg border border-line bg-card p-3">
        <select
          aria-label="Cliente"
          className="input"
          value={clienteId}
          onChange={(event) => alterarFiltro(setClienteId, event.target.value)}
        >
          <option value="">Selecione o cliente</option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nome}
            </option>
          ))}
        </select>
        <input
          aria-label="Início"
          type="date"
          className="input"
          value={inicio}
          onChange={(event) => alterarFiltro(setInicio, event.target.value)}
        />
        <input
          aria-label="Fim"
          type="date"
          className="input"
          value={fim}
          onChange={(event) => alterarFiltro(setFim, event.target.value)}
        />
        <button
          type="button"
          className="btn-primary"
          onClick={() => void gerar()}
          disabled={!clienteId || carregando || Boolean(erroPeriodo)}
        >
          Gerar relatório
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void baixarPdf()}
          disabled={!relatorio || baixando}
        >
          <Download className="h-4 w-4" /> {baixando ? "Gerando PDF…" : "Exportar PDF"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void publicar()}
          disabled={!relatorio || publicando || publicado}
        >
          <Send className="h-4 w-4" />{" "}
          {publicado ? "Publicado" : publicando ? "Publicando…" : "Publicar no Portal"}
        </button>
      </div>
      {erroPeriodo || erro || consultaClientes.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-body text-danger"
        >
          {erroPeriodo ?? erro ?? consultaClientes.error?.message}
        </p>
      ) : null}
      {carregando ? <Skeleton className="h-4 w-40" /> : null}
      {relatorio ? (
        <article className="rounded-lg border border-line bg-card p-6">
          <p className="text-caption font-semibold uppercase tracking-widest text-orange">
            Sinérgica
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-ink">Relatório de Atividades</h3>
          <p className="mt-1 text-ink-2">
            {relatorio.clienteNome} · {relatorio.inicio} a {relatorio.fim}
          </p>
          <section className="mt-6">
            <h4 className="font-semibold text-ink">Resumo executivo</h4>
            <p className="mt-2 text-body text-ink-2">
              Foram realizados {relatorio.atividades.length} atendimento(s), incluindo{" "}
              {relatorio.preventivasRealizadas} preventiva(s).
            </p>
          </section>
          <section className="mt-6">
            <h4 className="font-semibold text-ink">Trabalho realizado</h4>
            {relatorio.atividades.length ? (
              <ul className="mt-2 divide-y divide-line">
                {relatorio.atividades.map((item) => (
                  <li key={`${item.numero}-${item.data}`} className="py-3 text-body">
                    <p className="font-medium text-ink">
                      {item.data} · {item.titulo}
                    </p>
                    {item.descricao ? <p className="text-ink-3">{item.descricao}</p> : null}
                    {item.evidenciaUrl ? (
                      <a
                        className="text-orange"
                        href={item.evidenciaUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver evidência no Auvo
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-body text-ink-3">Sem atividades concluídas no período.</p>
            )}
          </section>
          <section className="mt-6">
            <h4 className="font-semibold text-ink">Cronograma futuro</h4>
            {relatorio.cronograma.length ? (
              <ul className="mt-2 divide-y divide-line">
                {relatorio.cronograma.map((item) => (
                  <li key={`${item.numero}-${item.data}`} className="py-3 text-body text-ink">
                    {item.data} · {item.titulo}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-body text-ink-3">
                Sem preventivas ou visitas agendadas no momento.
              </p>
            )}
          </section>
        </article>
      ) : null}
      {flagLigada("VITE_SSO_RELATORIO_DESPESAS_CLIENTE_ENABLED") &&
        relatorio &&
        relatorio.clienteId === clienteId &&
        user?.id && (
          <aside
            className="rounded-lg border border-line bg-card p-6"
            aria-label="Dados financeiros internos"
          >
            <RelatorioClienteDespesas
              userId={user.id}
              clienteId={relatorio.clienteId}
              periodoInicial={{ inicio: relatorio.inicio, fim: relatorio.fim }}
            />
          </aside>
        )}
    </div>
  );
}
