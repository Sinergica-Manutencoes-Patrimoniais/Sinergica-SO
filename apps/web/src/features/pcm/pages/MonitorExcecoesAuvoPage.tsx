// E01-S201 — Monitor consolidado de exceções do Auvo (T−24).
//
// BL 004 do Pacote Consolidado (13/11/2026) pede "Módulo e tela: Integrações, Planejamento e
// monitor de exceções" e, nos critérios, "registrar ID externo, tentativas e erro". As três
// famílias já existiam no banco, SEPARADAS — esta tela é o lugar onde elas finalmente aparecem
// juntas, por Cliente, sem ninguém precisar cruzar três consultas na cabeça.
//
// SÓ LEITURA nesta fatia: reprocessar uma falha é ação (escrita, auditoria, idempotência) e fica
// para a fatia seguinte — ver tasks.md. Botão que não faz nada seria pior que botão nenhum.
import { Skeleton } from "@sinergica/ui";
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

      {ligada && clienteId && excecoes.isPending ? <Skeleton className="h-4 w-48" /> : null}

      {lista.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-body">
            <caption className="sr-only">Exceções do Auvo em T−24 do Cliente selecionado</caption>
            <thead className="bg-card text-ink-3">
              <tr>
                <th scope="col" className="p-2 text-left">
                  Exceção
                </th>
                <th scope="col" className="p-2 text-left">
                  Cliente
                </th>
                <th scope="col" className="p-2 text-left">
                  OS
                </th>
                <th scope="col" className="p-2 text-left">
                  Visita
                </th>
                <th scope="col" className="p-2 text-left">
                  Tarefa Auvo
                </th>
                <th scope="col" className="p-2 text-right">
                  Tentativas
                </th>
                <th scope="col" className="p-2 text-left">
                  Último erro
                </th>
                <th scope="col" className="p-2 text-left">
                  Quando
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.map((excecao) => (
                <tr key={`${excecao.tipo}-${excecao.osId}`} className="border-line border-t">
                  <td className="p-2 text-ink">{rotuloTipoExcecao(excecao.tipo)}</td>
                  <td className="p-2 text-ink-3">{excecao.clienteNome}</td>
                  <td className="p-2 text-ink">{excecao.osNumero}</td>
                  <td className="p-2 text-ink-3">{formatarInstante(excecao.visitaInicioEm)}</td>
                  {/* Sem tarefa no Auvo é o achado, não um buraco: o travessão é deliberado. */}
                  <td className="p-2 text-ink-3">{excecao.taskId ?? "—"}</td>
                  <td className="p-2 text-right text-ink-3">{excecao.tentativas}</td>
                  <td className="p-2 text-ink-3">{rotuloErroExcecao(excecao.ultimoErro)}</td>
                  <td className="p-2 text-ink-3">{formatarInstante(excecao.ocorridoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
