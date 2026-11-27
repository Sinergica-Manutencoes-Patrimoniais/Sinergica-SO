import { AvisoCarregando, Button, Card, EmptyState } from "@sinergica/ui";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { flagLigada } from "../../../../config/flags-sso";
import { supabase } from "../../../../lib/supabase-client";
import { agruparCapacidadePorTecnico } from "../../domain/capacidade-por-tecnico";
import { semanaCapacidade } from "../../domain/semana-capacidade";
import {
  type DisponibilidadeDeclarada,
  listarDisponibilidades,
  listarVinculosCapacidade,
} from "../../infrastructure/supabase-capacidade-agenda-adapter";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { AgendaTecnicoContexto } from "./AgendaTecnicoContexto";
import { ConflitosInterclientes } from "./ConflitosInterclientes";
import { DiagnosticoConflitos } from "./DiagnosticoConflitos";
import { FontesDemanda } from "./FontesDemanda";
import { FormularioDisponibilidade } from "./Formulario";
import { HorizonteCapacidade } from "./HorizonteCapacidade";
import { IntervalosDeclarados } from "./IntervalosDeclarados";
import { OcorrenciasSemOs } from "./OcorrenciasSemOs";
import { SimulacaoManual } from "./SimulacaoManual";
import { SnapshotCapacidade } from "./SnapshotCapacidade";
import "./Workspace.css";

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
      const resultado = await supabaseCapacidadesSsoAdapter.autorizarAcao(
        "capacidade.gerir",
        clienteId,
      );
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
  if (
    lista.data &&
    vinculos.data &&
    !lista.isFetching &&
    !vinculos.isFetching &&
    !lista.isError &&
    !vinculos.isError &&
    !lista.hasNextPage &&
    !vinculos.hasNextPage
  ) {
    try {
      porTecnico = agruparCapacidadePorTecnico(lista.data.pages.flat(), vinculos.data.pages.flat());
    } catch {
      agrupamentoInconsistente = true;
    }
  }
  if (permissao.isPending || permissao.isFetching)
    return <AvisoCarregando>Verificando acesso à capacidade…</AvisoCarregando>;
  if (permissao.isError)
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-danger-line bg-danger-soft p-3">
        <p role="alert" className="text-caption text-danger">
          Não foi possível verificar acesso.
        </p>
        <Button size="sm" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!permitido) return null;
  return (
    <section aria-label="Disponibilidade declarada" className="capacidade-agenda space-y-4">
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="space-y-1">
          <h2 className="text-heading font-semibold text-ink">Disponibilidade declarada</h2>
          <p className="text-body text-ink-2">
            Dados parciais: a sobreposição de reservas e ausências não foi verificada. Demanda e
            saldo consolidado ainda não estão disponíveis.
          </p>
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
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
          <label className="flex flex-col gap-1 text-caption font-semibold text-ink-2">
            Data da semana
            <input
              className="input"
              required
              type="date"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
            />
          </label>
          <Button type="submit" variant="primary">
            Consultar
          </Button>
        </form>
        {erro && (
          <p role="alert" className="text-caption text-danger">
            {erro}
          </p>
        )}
        {semanaSelecionada && intervalo && (
          <p className="text-caption font-semibold text-ink-2">
            Semana: {intervalo.inicio} a {intervalo.fim} (segunda a domingo).
          </p>
        )}
        {semanaSelecionada && lista.isFetching && (
          <AvisoCarregando>Carregando disponibilidade…</AvisoCarregando>
        )}
        {semanaSelecionada && lista.isError && (
          <div className="flex flex-wrap items-center gap-2">
            <p role="alert" className="text-caption text-danger">
              Não foi possível carregar disponibilidade.
            </p>
            <Button size="sm" onClick={() => void lista.refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}
        {semanaSelecionada && !lista.isFetching && !lista.isError && (
          <>
            <Button onClick={() => setFormulario("novo")}>Declarar disponibilidade</Button>
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
              <EmptyState titulo="Não há disponibilidade declarada para esta semana; isso não significa zero." />
            )}
            <ul className="space-y-2 empty:hidden">
              {lista.data?.pages.flat().map((item) => (
                <li key={item.id} className="space-y-2 rounded-md border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 wrap-break-word text-body text-ink-2">
                      Técnico {item.funcionarioId}: {item.destinadosMinutos} min destinados,{" "}
                      {item.reservasMinutos} min reservados, {item.ausenciasMinutos} min de
                      ausência;{" "}
                      {item.disponiveisMinutos === null
                        ? "disponibilidade não informada"
                        : `${item.disponiveisMinutos} min disponíveis declarados`}
                      .
                    </p>
                    <Button size="sm" onClick={() => setFormulario(item)}>
                      Revisar
                    </Button>
                  </div>
                  {flagLigada("VITE_SSO_INTERVALOS_CAPACIDADE_ENABLED") && (
                    <IntervalosDeclarados
                      userId={userId}
                      clienteId={clienteId}
                      disponibilidadeId={item.id}
                      revision={item.revisao}
                    />
                  )}
                  {flagLigada("VITE_SSO_CONFLITOS_CAPACIDADE_ENABLED") && (
                    <DiagnosticoConflitos
                      userId={userId}
                      clienteId={clienteId}
                      disponibilidadeId={item.id}
                      revision={item.revisao}
                    />
                  )}
                  {flagLigada("VITE_SSO_CONFLITOS_INTERCLIENTES_ENABLED") && (
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
              <Button onClick={() => void lista.fetchNextPage()}>Mais técnicos</Button>
            )}
          </>
        )}
      </Card>
      {semanaSelecionada && (
        <div className="capacidade-agenda-blocos space-y-4 text-body text-ink-2">
          {flagLigada("VITE_SSO_SIMULACAO_MANUAL_CAPACIDADE_ENABLED") && (
            <SimulacaoManual key={`${userId}:${clienteId}`} userId={userId} clienteId={clienteId} />
          )}
          <section>
            <h3>Disponibilidade e Visitas por técnico</h3>
            <p>
              Comparação de registros carregados em consultas independentes; não comprova execução,
              simultaneidade, cobertura integral nem saldo operacional.
            </p>
            {(lista.hasNextPage || vinculos.hasNextPage) && (
              <p>
                Carregue todas as páginas de disponibilidade e vínculos para relacionar por técnico.
              </p>
            )}
            {agrupamentoInconsistente && (
              <div className="flex flex-wrap items-center gap-2">
                <p role="alert" className="text-caption text-danger">
                  Os registros carregados são inconsistentes ou duplicados. A comparação foi
                  suspensa.
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    void lista.refetch();
                    void vinculos.refetch();
                  }}
                >
                  Atualizar fontes
                </Button>
              </div>
            )}
            {porTecnico && porTecnico.length > 0 && (
              <ul className="divide-y divide-line rounded-md border border-line">
                {porTecnico.map((t) => (
                  <li key={t.funcionarioId} className="wrap-break-word p-3">
                    Técnico {t.funcionarioId} · disponibilidade declarada{" "}
                    {t.disponibilidade === null ? "não informada" : `${t.disponibilidade} min`} ·{" "}
                    {t.participacoes} participação(ões) em Visitas ·{" "}
                    {t.estimativaCompleta === null
                      ? "estimativa incompleta ou não informada"
                      : `${t.estimativaCompleta} min estimados`}{" "}
                    · {t.estimativasPendentes} estimativa(s) pendente(s)
                  </li>
                ))}
              </ul>
            )}
            {porTecnico?.length === 0 && (
              <EmptyState titulo="Nenhum registro de disponibilidade ou Visita para comparar." />
            )}
          </section>
          {flagLigada("VITE_SSO_SNAPSHOT_CAPACIDADE_ENABLED") && (
            <SnapshotCapacidade userId={userId} clienteId={clienteId} semana={semana} />
          )}
          {flagLigada("VITE_SSO_AGENDA_TECNICO_CAPACIDADE_ENABLED") && (
            <AgendaTecnicoContexto userId={userId} clienteId={clienteId} semana={semana} />
          )}
          {flagLigada("VITE_SSO_HORIZONTE_CAPACIDADE_ENABLED") && (
            <HorizonteCapacidade userId={userId} clienteId={clienteId} semana={semana} />
          )}
          {flagLigada("VITE_SSO_FONTES_DEMANDA_ENABLED") && (
            <FontesDemanda userId={userId} clienteId={clienteId} semana={semana} />
          )}
          {flagLigada("VITE_SSO_OCORRENCIAS_SEM_OS_ENABLED") && (
            <OcorrenciasSemOs userId={userId} clienteId={clienteId} semana={semana} />
          )}
          <section>
            <h3>Vínculos de equipe em Visitas</h3>
            <p>Vínculos parciais: estimativas de equipe não equivalem à demanda consolidada.</p>
            {vinculos.isFetching && <AvisoCarregando>Carregando vínculos…</AvisoCarregando>}
            {vinculos.isError && (
              <div className="flex flex-wrap items-center gap-2">
                <p role="alert" className="text-caption text-danger">
                  Não foi possível carregar vínculos.
                </p>
                <Button size="sm" onClick={() => void vinculos.refetch()}>
                  Tentar novamente
                </Button>
              </div>
            )}
            {!vinculos.isFetching && !vinculos.isError && (
              <>
                {vinculos.data?.pages.flat().length === 0 && (
                  <EmptyState titulo="Nenhum vínculo de equipe em Visitas para esta semana." />
                )}
                <ul className="divide-y divide-line rounded-md border border-line empty:hidden">
                  {vinculos.data?.pages.flat().map((v) => (
                    <li key={v.id} className="wrap-break-word p-3">
                      Visita {v.visitaId}, técnico {v.funcionarioId}:{" "}
                      {v.estimativaMinutos === null
                        ? "estimativa não informada"
                        : `${v.estimativaMinutos} minutos informados`}
                    </li>
                  ))}
                </ul>
                {vinculos.hasNextPage && (
                  <Button onClick={() => void vinculos.fetchNextPage()}>Mais vínculos</Button>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
