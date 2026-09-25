import { Skeleton } from "@sinergica/ui";
import { Download, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { criarRelatorioPdf } from "../../../lib/pdf/relatorio-pdf";
import type { ClienteResumo } from "../application/cliente-360-gateway";
import { obterRelatorioCliente } from "../application/relatorio-cliente";
import { type RelatorioCliente, formatarTextoRelatorioCliente } from "../domain/relatorio-cliente";
import { supabaseAgendaTecnicoAdapter } from "../infrastructure/supabase-agenda-tecnico-adapter";
import { supabaseCliente360Adapter } from "../infrastructure/supabase-cliente-360-adapter";
import { supabaseHubOsAdapter } from "../infrastructure/supabase-hub-os-adapter";
import { supabasePmocAdapter } from "../infrastructure/supabase-pmoc-adapter";
import { supabaseQualidadeAdapter } from "../infrastructure/supabase-qualidade-adapter";
import { supabaseRelatorioClienteAdapter } from "../infrastructure/supabase-relatorio-cliente-adapter";

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function inicioDoMes(): string {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().slice(0, 10);
}

export function RelatorioClientePage() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [inicio, setInicio] = useState(inicioDoMes);
  const [fim, setFim] = useState(hoje);
  const [relatorio, setRelatorio] = useState<RelatorioCliente | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [publicando, setPublicando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [publicado, setPublicado] = useState(false);

  useEffect(() => {
    void supabaseCliente360Adapter
      .listarClientes()
      .then((itens) => setClientes(itens.filter((cliente) => cliente.ativo)))
      .catch((causa) =>
        setErro(causa instanceof Error ? causa.message : "Não foi possível carregar clientes."),
      )
      .finally(() => setCarregando(false));
  }, []);

  const gerar = useCallback(async () => {
    const cliente = clientes.find((item) => item.id === clienteId);
    if (!cliente) {
      setRelatorio(null);
      return;
    }
    setCarregando(true);
    setErro(null);
    setPublicado(false);
    try {
      setRelatorio(
        await obterRelatorioCliente(
          supabaseHubOsAdapter,
          supabaseAgendaTecnicoAdapter,
          supabasePmocAdapter,
          supabaseQualidadeAdapter,
          cliente,
          { inicio, fim },
        ),
      );
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível gerar o relatório.");
    } finally {
      setCarregando(false);
    }
  }, [clienteId, clientes, fim, inicio]);

  async function baixarPdf() {
    if (!relatorio) return;
    setBaixando(true);
    try {
      const pdf = await criarRelatorioPdf({
        titulo: "Relatório de Atividades",
        subtitulo: `${relatorio.clienteNome} · ${relatorio.inicio} a ${relatorio.fim}`,
      });
      pdf.escreverTexto(formatarTextoRelatorioCliente(relatorio));
      const url = URL.createObjectURL(
        new Blob([Uint8Array.from(await pdf.finalizar()).buffer], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio-${relatorio.clienteNome.toLowerCase().replaceAll(/[^a-z0-9]+/gi, "-")}-${fim}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setErro("Não foi possível gerar o PDF do relatório.");
    } finally {
      setBaixando(false);
    }
  }

  async function publicar() {
    if (!relatorio || !user) return;
    setPublicando(true);
    setErro(null);
    try {
      await supabaseRelatorioClienteAdapter.publicar(relatorio, user.id);
      setPublicado(true);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível publicar no Portal.");
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
          onChange={(event) => setClienteId(event.target.value)}
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
          onChange={(event) => setInicio(event.target.value)}
        />
        <input
          aria-label="Fim"
          type="date"
          className="input"
          value={fim}
          onChange={(event) => setFim(event.target.value)}
        />
        <button
          type="button"
          className="btn-primary"
          onClick={() => void gerar()}
          disabled={!clienteId || carregando}
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
      {erro ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-body text-danger">
          {erro}
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
    </div>
  );
}
