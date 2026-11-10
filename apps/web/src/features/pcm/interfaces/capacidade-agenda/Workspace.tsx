import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { semanaCapacidade } from "../../domain/semana-capacidade";
import { agruparCapacidadePorTecnico } from "../../domain/capacidade-por-tecnico";
import {
  type DisponibilidadeDeclarada,
  listarDisponibilidades,
  listarVinculosCapacidade,
} from "../../infrastructure/supabase-capacidade-agenda-adapter";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { ConflitosInterclientes } from "./ConflitosInterclientes";
import { AgendaTecnicoContexto } from "./AgendaTecnicoContexto";
import { DiagnosticoConflitos } from "./DiagnosticoConflitos";
import { FontesDemanda } from "./FontesDemanda";
import { FormularioDisponibilidade } from "./Formulario";
import { HorizonteCapacidade } from "./HorizonteCapacidade";
import { IntervalosDeclarados } from "./IntervalosDeclarados";
import { OcorrenciasSemOs } from "./OcorrenciasSemOs";
import { SnapshotCapacidade } from "./SnapshotCapacidade";
import { SimulacaoManual } from "./SimulacaoManual";

/** Consulta parcial de declarações; não calcula demanda nem confirma capacidade efetiva. */
export function CapacidadeAgendaWorkspace({
  userId,
  clienteId,
}: { userId: string; clienteId: string }) {
  const [entrada, setEntrada] = useState("");
  const [semana, setSemana] = useState("");
  const [erro, setErro] = useState("");
  const [formulario, setFormulario] = useState<DisponibilidadeDeclarada | "novo" | null>(null);
  const intervalo = semanaCapacidade(entrada);
  const semanaSelecionada = Boolean(semana && intervalo?.inicio === semana);
  async function conferirSessao(signal?: AbortSignal) {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
  }
  const permissao = useQuery({
    queryKey: ["capacidade-agenda", userId, clienteId, "permissao"],
    queryFn: async ({ signal }) => {
      await conferirSessao(signal);
      const resultado = await supabaseCapacidadesSsoAdapter.autorizarAcao("capacidade.gerir", clienteId);
      await conferirSessao(signal);
      return resultado;
    },
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const lista = useInfiniteQuery({
    queryKey: ["capacidade-agenda", userId, clienteId, semana],
    enabled: permitido && Boolean(semana),
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const pagina = await listarDisponibilidades(clienteId, semana, pageParam, signal);
      await conferirSessao(signal);
      return pagina;
    },
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.id : undefined),
  });
  const vinculos = useInfiniteQuery({
    queryKey: ["capacidade-agenda", userId, clienteId, semana, "vinculos"],
    enabled: permitido && Boolean(semana),
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const pagina = await listarVinculosCapacidade(clienteId, semana, pageParam, signal);
      await conferirSessao(signal);
      return pagina;
    },
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.id : undefined),
  });
  let porTecnico: ReturnType<typeof agruparCapacidadePorTecnico> | null = null;
  let agrupamentoInconsistente = false;
  if (lista.data && vinculos.data && !lista.isFetching && !vinculos.isFetching && !lista.isError && !vinculos.isError && !lista.hasNextPage && !vinculos.hasNextPage) {
    try { porTecnico = agruparCapacidadePorTecnico(lista.data.pages.flat(), vinculos.data.pages.flat()); } catch { agrupamentoInconsistente = true; }
  }
  if (permissao.isPending || permissao.isFetching)
    return <output>Verificando acesso à capacidade…</output>;
  if (permissao.isError)
    return (
      <p role="alert">
        Não foi possível verificar acesso.{" "}
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (!permitido) return null;
  return (
    <section aria-label="Disponibilidade declarada">
      <h2>Disponibilidade declarada</h2>
      <p>
        Dados parciais: a sobreposição de reservas e ausências não foi verificada. Demanda e saldo
        consolidado ainda não estão disponíveis.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!intervalo) {
            setErro("Informe uma data válida.");
            return;
          }
          setErro("");
          setFormulario(null);
          setSemana(intervalo.inicio);
        }}
      >
        <label>
          Data da semana{" "}
          <input
            required
            type="date"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
          />
        </label>
        <button type="submit">Consultar</button>
      </form>
      {erro && <p role="alert">{erro}</p>}
      {semanaSelecionada && intervalo && (
        <p>
          Semana: {intervalo.inicio} a {intervalo.fim} (segunda a domingo).
        </p>
      )}
      {semanaSelecionada && lista.isFetching && <output>Carregando disponibilidade…</output>}
      {semanaSelecionada && lista.isError && (
        <p role="alert">
          Não foi possível carregar disponibilidade.{" "}
          <button type="button" onClick={() => void lista.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {semanaSelecionada && !lista.isFetching && !lista.isError && (
        <>
          <button type="button" onClick={() => setFormulario("novo")}>
            Declarar disponibilidade
          </button>
          {formulario && (
            <FormularioDisponibilidade
              key={`${semana}:${formulario === "novo" ? "novo" : formulario.id}`}
              userId={userId}
              clienteId={clienteId}
              semana={semana}
              item={formulario === "novo" ? null : formulario}
              fechar={() => setFormulario(null)}
            />
          )}
          {lista.data?.pages.flat().length === 0 && (
            <p>Não há disponibilidade declarada para esta semana; isso não significa zero.</p>
          )}
          <ul>
            {lista.data?.pages.flat().map((item) => (
              <li key={item.id}>
                Técnico {item.funcionarioId}: {item.destinadosMinutos} min destinados,{" "}
                {item.reservasMinutos} min reservados, {item.ausenciasMinutos} min de ausência;{" "}
                {item.disponiveisMinutos === null ? "disponibilidade não informada" : `${item.disponiveisMinutos} min disponíveis declarados`}.
                <button type="button" onClick={() => setFormulario(item)}>
                  Revisar
                </button>
                {import.meta.env.VITE_SSO_INTERVALOS_CAPACIDADE_ENABLED === "true" && (
                  <IntervalosDeclarados
                    userId={userId}
                    clienteId={clienteId}
                    disponibilidadeId={item.id}
                    revision={item.revisao}
                  />
                )}
                {import.meta.env.VITE_SSO_CONFLITOS_CAPACIDADE_ENABLED === "true" && (
                  <DiagnosticoConflitos
                    userId={userId}
                    clienteId={clienteId}
                    disponibilidadeId={item.id}
                    revision={item.revisao}
                  />
                )}
                {import.meta.env.VITE_SSO_CONFLITOS_INTERCLIENTES_ENABLED === "true" && (
                  <ConflitosInterclientes
                    userId={userId}
                    clienteId={clienteId}
                    disponibilidadeId={item.id}
                    revision={item.revisao}
                  />
                )}
              </li>
            ))}
          </ul>
          {lista.hasNextPage && (
            <button type="button" onClick={() => void lista.fetchNextPage()}>
              Mais técnicos
            </button>
          )}
        </>
      )}
      {semanaSelecionada && (
        <section>
          {import.meta.env.VITE_SSO_SIMULACAO_MANUAL_CAPACIDADE_ENABLED === "true" && (
            <SimulacaoManual key={`${userId}:${clienteId}`} userId={userId} clienteId={clienteId} />
          )}
          <h3>Disponibilidade e Visitas por técnico</h3>
          <p>Comparação de registros carregados em consultas independentes; não comprova execução, simultaneidade, cobertura integral nem saldo operacional.</p>
          {(lista.hasNextPage || vinculos.hasNextPage) && <p>Carregue todas as páginas de disponibilidade e vínculos para relacionar por técnico.</p>}
          {agrupamentoInconsistente && <p role="alert">Os registros carregados são inconsistentes ou duplicados. A comparação foi suspensa. <button type="button" onClick={() => { void lista.refetch(); void vinculos.refetch(); }}>Atualizar fontes</button></p>}
          {porTecnico && <ul>{porTecnico.map((t) => <li key={t.funcionarioId}>Técnico {t.funcionarioId} · disponibilidade declarada {t.disponibilidade === null ? "não informada" : `${t.disponibilidade} min`} · {t.participacoes} participação(ões) em Visitas · {t.estimativaCompleta === null ? "estimativa incompleta ou não informada" : `${t.estimativaCompleta} min estimados`} · {t.estimativasPendentes} estimativa(s) pendente(s)</li>)}</ul>}
          {import.meta.env.VITE_SSO_SNAPSHOT_CAPACIDADE_ENABLED === "true" && (
            <SnapshotCapacidade userId={userId} clienteId={clienteId} semana={semana} />
          )}
          {import.meta.env.VITE_SSO_AGENDA_TECNICO_CAPACIDADE_ENABLED === "true" && (
            <AgendaTecnicoContexto userId={userId} clienteId={clienteId} semana={semana} />
          )}
          {import.meta.env.VITE_SSO_HORIZONTE_CAPACIDADE_ENABLED === "true" && (
            <HorizonteCapacidade userId={userId} clienteId={clienteId} semana={semana} />
          )}
          {import.meta.env.VITE_SSO_FONTES_DEMANDA_ENABLED === "true" && (
            <FontesDemanda userId={userId} clienteId={clienteId} semana={semana} />
          )}
          {import.meta.env.VITE_SSO_OCORRENCIAS_SEM_OS_ENABLED === "true" && (
            <OcorrenciasSemOs userId={userId} clienteId={clienteId} semana={semana} />
          )}
          <h3>Vínculos de equipe em Visitas</h3>
          <p>Vínculos parciais: estimativas de equipe não equivalem à demanda consolidada.</p>
          {vinculos.isFetching && <output>Carregando vínculos…</output>}
          {vinculos.isError && (
            <p role="alert">
              Não foi possível carregar vínculos.{" "}
              <button type="button" onClick={() => void vinculos.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {!vinculos.isFetching && !vinculos.isError && (
            <>
              <ul>
                {vinculos.data?.pages.flat().map((v) => (
                  <li key={v.id}>
                    Visita {v.visitaId}, técnico {v.funcionarioId}:{" "}
                    {v.estimativaMinutos === null
                      ? "estimativa não informada"
                      : `${v.estimativaMinutos} minutos informados`}
                  </li>
                ))}
              </ul>
              {vinculos.hasNextPage && (
                <button type="button" onClick={() => void vinculos.fetchNextPage()}>
                  Mais vínculos
                </button>
              )}
            </>
          )}
        </section>
      )}
    </section>
  );
}
