// E01-S201 — Monitor consolidado de exceções do Auvo (T−24).
//
// BL 004 do Pacote Consolidado (13/11/2026) pede "Módulo e tela: Integrações, Planejamento e
// monitor de exceções" e, nos critérios, "registrar ID externo, tentativas e erro". As três
// famílias já existiam no banco, SEPARADAS — esta tela é o lugar onde elas finalmente aparecem
// juntas, por Cliente, sem ninguém precisar cruzar três consultas na cabeça.
//
// SÓ LEITURA nesta fatia: reprocessar uma falha é ação (escrita, auditoria, idempotência) e fica
// para a fatia seguinte — ver tasks.md. Botão que não faz nada seria pior que botão nenhum.
import { DataTable } from "@sinergica/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { flagLigada } from "../../../config/flags-sso";
import { operacaoQueryKeys } from "../application/operacao-queries";
import {
  TIPO_EXCECAO_EXPLICACAO,
  type TipoExcecaoAuvo,
  avisoMonitorExcecoes,
  contarPorTipo,
  rotuloErroExcecao,
  rotuloTipoExcecao,
} from "../domain/excecoes-auvo";
import { supabaseAgendaTecnicoAdapter } from "../infrastructure/supabase-agenda-tecnico-adapter";
import { listarExcecoesAuvoT24 } from "../infrastructure/supabase-operacao-adapter";

const TIPOS: readonly TipoExcecaoAuvo[] = ["falha_envio", "visita_nao_confirmada", "tarefa_orfa"];

function formatarInstante(iso: string | null): string {
  if (!iso) return "—";
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleString("pt-BR");
}

export function MonitorExcecoesAuvoPage() {
  const { user } = useAuth();
  // `useState` aqui é estado local de UI (qual Cliente está filtrado), não dado de servidor —
  // é o único uso permitido pela convenção do projeto.
  const [clienteId, setClienteId] = useState("");
  const ligada = flagLigada("VITE_SSO_MONITOR_EXCECOES_AUVO_ENABLED");

  const clientes = useQuery({
    queryKey: ["pcm", "clientes-monitor-excecoes"],
    queryFn: () => supabaseAgendaTecnicoAdapter.listarClientes(),
    enabled: ligada,
    staleTime: 5 * 60 * 1000,
  });

  // `retry: false` de propósito: gate fechado e falta de capacidade são erros PERMANENTES —
  // repetir só atrasaria a frase certa na tela.
  const excecoes = useQuery({
    queryKey: operacaoQueryKeys.excecoesAuvo(clienteId),
    queryFn: ({ signal }) => listarExcecoesAuvoT24(user?.id as string, clienteId, signal),
    enabled: Boolean(ligada && user?.id && clienteId),
    retry: false,
    staleTime: 30_000,
  });

  const lista = excecoes.data ?? [];
  const contagem = contarPorTipo(lista);
  const aviso = avisoMonitorExcecoes({
    flagLigada: ligada,
    clienteSelecionado: Boolean(clienteId),
    carregando: excecoes.isPending && Boolean(clienteId),
    erro: excecoes.isError ? excecoes.error : null,
    total: lista.length,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading font-semibold text-ink">Monitor de exceções do Auvo (T−24)</h1>
        <p className="text-body text-ink-3">
          Falha de envio, Visita não confirmada e tarefa órfã no mesmo lugar. Leitura apenas — o
          planejamento local nunca é apagado por falha de integração.
        </p>
      </div>

      {ligada ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-card p-3">
          <select
            aria-label="Cliente"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="input"
          >
            <option value="">Selecione um Cliente</option>
            {(clientes.data ?? []).map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
          {TIPOS.map((tipo) => (
            <span
              key={tipo}
              title={TIPO_EXCECAO_EXPLICACAO[tipo]}
              className="rounded-md border border-line px-2 py-1 text-body text-ink-3"
            >
              {rotuloTipoExcecao(tipo)}: <strong className="text-ink">{contagem[tipo]}</strong>
            </span>
          ))}
        </div>
      ) : null}

      {aviso ? (
        // `<output>` é o elemento semântico com `role="status"`: a frase muda conforme o estado
        // (desligado, sem Cliente, gate fechado, sem capacidade, zero exceções) e precisa ser
        // anunciada por leitor de tela, não só aparecer.
        <output className="block rounded-lg border border-line p-5 text-body text-ink-3">
          {aviso}
        </output>
      ) : null}

      {lista.length > 0 || (ligada && clienteId && excecoes.isPending) ? (
        <div className="rounded-lg border border-line">
          <DataTable
            carregando={excecoes.isPending}
            itens={lista}
            chaveLinha={(excecao) => `${excecao.tipo}-${excecao.osId}`}
            vazio="Nenhuma exceção do Auvo neste Cliente."
            colunas={[
              {
                chave: "tipo",
                cabecalho: "Exceção",
                render: (excecao) => rotuloTipoExcecao(excecao.tipo),
              },
              { chave: "cliente", cabecalho: "Cliente", render: (excecao) => excecao.clienteNome },
              {
                chave: "os",
                cabecalho: "OS",
                cabecalhoLinha: true,
                render: (excecao) => excecao.osNumero,
              },
              {
                chave: "visita",
                cabecalho: "Visita",
                render: (excecao) => formatarInstante(excecao.visitaInicioEm),
              },
              {
                chave: "tarefa",
                cabecalho: "Tarefa Auvo",
                // Sem tarefa no Auvo é o achado, não um buraco: o travessão é deliberado.
                render: (excecao) => excecao.taskId ?? "—",
              },
              {
                chave: "tentativas",
                cabecalho: "Tentativas",
                numerica: true,
                render: (excecao) => excecao.tentativas,
              },
              {
                chave: "erro",
                cabecalho: "Último erro",
                render: (excecao) => rotuloErroExcecao(excecao.ultimoErro),
              },
              {
                chave: "quando",
                cabecalho: "Quando",
                render: (excecao) => formatarInstante(excecao.ocorridoEm),
              },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
