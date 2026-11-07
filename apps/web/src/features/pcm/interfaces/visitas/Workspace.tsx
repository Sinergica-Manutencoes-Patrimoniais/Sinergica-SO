import { Button } from "@sinergica/ui";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { supabaseVisitasAdapter } from "../../infrastructure/supabase-visitas-adapter";
import { AcoesVisita } from "./AcoesVisita";
import { NovaVisita } from "./NovaVisita";
import { TransferirOs } from "./TransferirOs";
import { TransicaoVisita } from "./TransicaoVisita";
import { IntencaoOsEnviada } from "./IntencaoOsEnviada";
import { DespesasVisitaWorkspace } from "../despesas-visita/Workspace";
import { MateriaisDaOrdem } from "../chamados-os/MateriaisDaOrdem";
import { PublicarVisitaPortal } from "./PublicarVisitaPortal";
import { ConferenciaConfirmacaoCliente } from "./ConferenciaConfirmacaoCliente";
import { IntencaoLocalEnvio } from "./IntencaoLocalEnvio";
import { HistoricoIntencaoLocal } from "./HistoricoIntencaoLocal";
import { HistoricoAlertasReprogramacao } from "./HistoricoAlertasReprogramacao";
import { ConferirConteudoOs } from "./ConferirConteudoOs";
import { VincularOsRotina } from "./VincularOsRotina";
import { RetificarOsRotina } from "./RetificarOsRotina";
import { ConferirComposicao } from "./ConferirComposicao";
import { DiagnosticoSincronizacao } from "./DiagnosticoSincronizacao";
import { TriagemSyncEquipe } from "./TriagemSyncEquipe";

const limite = 20;
type Props = { userId: string; clienteId: string; clienteNome: string };
const estados: Record<string, string> = {
  rascunho: "Rascunho",
  planejada: "Planejada",
  confirmada: "Confirmada",
  enviada: "Enviada",
  em_execucao: "Em execução",
  parcial: "Parcial",
  concluida: "Concluída",
  reprogramada: "Reprogramada",
  cancelada: "Cancelada",
};

function periodoInicial() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  const data = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { inicio: data(inicio), fim: data(fim) };
}
function horario(tempo: string, fuso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: fuso,
    }).format(new Date(tempo));
  } catch {
    return tempo;
  }
}

export function VisitasWorkspace(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}
function Conteudo({ userId, clienteId, clienteNome }: Props) {
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [inicio, setInicio] = useState(periodo.inicio);
  const [fim, setFim] = useState(periodo.fim);
  const [erroPeriodo, setErroPeriodo] = useState("");
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const acionador = useRef<HTMLButtonElement | null>(null);
  const raiz = ["visitas", userId, clienteId] as const;
  const permissao = useQuery({
    queryKey: [...raiz, "permissao"],
    queryFn: () => supabaseCapacidadesSsoAdapter.autorizarAcao("visita.confirmar", clienteId),
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const visitas = useInfiniteQuery({
    queryKey: [...raiz, "lista", periodo],
    initialPageParam: null as { inicio: string; id: string } | null,
    queryFn: ({ pageParam, signal }) =>
      supabaseVisitasAdapter.listar(
        {
          clienteId,
          inicio: new Date(`${periodo.inicio}T00:00:00`).toISOString(),
          fim: new Date(`${periodo.fim}T00:00:00`).toISOString(),
          limite,
          apos: pageParam,
        },
        signal,
      ),
    getNextPageParam: (pagina) =>
      pagina.length === limite
        ? { inicio: pagina[pagina.length - 1]!.inicioEm, id: pagina[pagina.length - 1]!.id }
        : undefined,
    enabled: permitido,
    gcTime: 0,
  });
  if (permissao.isPending || permissao.isFetching)
    return <output>Verificando acesso às Visitas…</output>;
  if (permissao.isError)
    return (
      <p role="alert">
        Não foi possível verificar acesso.{" "}
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (!permitido) return <p>Você está sem permissão para consultar Visitas deste Cliente.</p>;
  const itens = visitas.data?.pages.flat() ?? [];
  return (
    <section
      aria-label="Visitas"
      className="rounded-lg border border-line bg-surface p-4 space-y-3"
    >
      <div>
        <h2 className="text-body font-semibold text-ink">Visitas de {clienteNome}</h2>
        <p>Confira programação, OS e equipe do período.</p>
      </div>
      <NovaVisita userId={userId} clienteId={clienteId} />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            !inicio ||
            !fim ||
            inicio >= fim ||
            !Number.isFinite(Date.parse(`${inicio}T00:00:00`)) ||
            !Number.isFinite(Date.parse(`${fim}T00:00:00`))
          ) {
            setErroPeriodo("Informe um período válido; a data final é exclusiva.");
            return;
          }
          setErroPeriodo("");
          setSelecionada(null);
          setPeriodo({ inicio, fim });
        }}
      >
        <label>
          De{" "}
          <input
            className="input"
            type="date"
            required
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />
        </label>
        <label>
          Até (exclusivo){" "}
          <input
            className="input"
            type="date"
            required
            value={fim}
            onChange={(e) => setFim(e.target.value)}
          />
        </label>
        <Button type="submit" variant="secondary">
          Consultar período
        </Button>
      </form>
      {erroPeriodo && <p role="alert">{erroPeriodo}</p>}
      {import.meta.env.VITE_SSO_TRANSFERENCIA_VISITA_ENABLED === "true" && (
        <TransferirOs userId={userId} clienteId={clienteId} visitas={itens} bloqueado={visitas.isFetching || visitas.isError} />
      )}
      {import.meta.env.VITE_SSO_INTENCAO_OS_ENVIADA_ENABLED === "true" && <IntencaoOsEnviada userId={userId} clienteId={clienteId} visitas={itens} bloqueado={visitas.isFetching || visitas.isError} />}
      {(visitas.isPending || visitas.isFetching) && <output>Carregando Visitas…</output>}
      {visitas.isError && (
        <p role="alert">
          Não foi possível carregar Visitas.{" "}
          <button type="button" onClick={() => void visitas.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!visitas.isPending && !visitas.isFetching && !visitas.isError && itens.length === 0 && (
        <p>Nenhuma Visita neste período.</p>
      )}
      {!visitas.isFetching && !visitas.isError && (
        <ul className="space-y-2">
          {itens.map((visita) => (
            <li
              key={visita.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2"
            >
              <span>
                {horario(visita.inicioEm, visita.fuso)} a {horario(visita.fimEm, visita.fuso)} (
                {visita.fuso}) — {estados[visita.estado] ?? visita.estado} —{" "}
                {visita.natureza === "extra"
                  ? "Extra"
                  : visita.natureza === "regular"
                    ? "Regular"
                    : "Reposição manual"}
              </span>
              <Button
                variant="secondary"
                aria-label={`Abrir Visita de ${horario(visita.inicioEm, visita.fuso)}`}
                onClick={(e) => {
                  acionador.current = e.currentTarget;
                  setSelecionada(visita.id);
                }}
              >
                Abrir Visita
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!visitas.isFetching && !visitas.isError && visitas.hasNextPage && (
        <Button variant="secondary" onClick={() => void visitas.fetchNextPage()}>
          Mais Visitas
        </Button>
      )}
      {selecionada && (
        <div
          hidden={
            visitas.isFetching || visitas.isError || !itens.some((item) => item.id === selecionada)
          }
        >
          <Detalhe
            key={selecionada}
            userId={userId}
            clienteId={clienteId}
            visitaId={selecionada}
            bloqueado={
              visitas.isFetching ||
              visitas.isError ||
              !itens.some((item) => item.id === selecionada)
            }
            fechar={() => {
              setSelecionada(null);
              acionador.current?.focus();
            }}
          />
        </div>
      )}
    </section>
  );
}

function Detalhe({
  userId,
  clienteId,
  visitaId,
  fechar,
  bloqueado,
}: {
  userId: string;
  clienteId: string;
  visitaId: string;
  fechar: () => void;
  bloqueado: boolean;
}) {
  const raiz = ["visitas", userId, clienteId, "detalhe", visitaId] as const;
  const [historico, setHistorico] = useState(false);
  const detalhe = useQuery({
    queryKey: [...raiz, "dados"],
    queryFn: ({ signal }) => supabaseVisitasAdapter.detalhar(clienteId, visitaId, signal),
    gcTime: 0,
  });
  const ciencia = useQuery({
    queryKey: [...raiz, "ciencia"],
    queryFn: () => supabaseVisitasAdapter.conferirCiencia(visitaId),
    gcTime: 0,
  });
  const os = useInfiniteQuery({
    queryKey: [...raiz, "os", historico],
    initialPageParam: null as { sequencia: number; id: string } | null,
    queryFn: ({ pageParam, signal }) =>
      supabaseVisitasAdapter.listarOs(
        { clienteId, visitaId, incluirHistorico: historico, limite, apos: pageParam },
        signal,
      ),
    getNextPageParam: (pagina) =>
      pagina.length === limite
        ? { sequencia: pagina[pagina.length - 1]!.sequencia, id: pagina[pagina.length - 1]!.id }
        : undefined,
    gcTime: 0,
  });
  const equipe = useInfiniteQuery({
    queryKey: [...raiz, "equipe", historico],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      supabaseVisitasAdapter.listarEquipe(
        { clienteId, visitaId, incluirHistorico: historico, limite, aposId: pageParam },
        signal,
      ),
    getNextPageParam: (pagina) =>
      pagina.length === limite ? pagina[pagina.length - 1]!.id : undefined,
    gcTime: 0,
  });
  const situacoes: Record<string, string> = {
    pendente_pcm: "Confirmação PCM pendente",
    ciencia_pendente: "Ciência do Cliente pendente",
    ciencia_conferida: "Ciência do Cliente registrada",
    nao_exigida: "Ciência do Cliente não exigida",
  };
  return (
    <section aria-label="Detalhe da Visita" className="border-t border-line pt-3 space-y-3">
      <div className="flex justify-between gap-2">
        <h3 className="font-semibold">Detalhe da Visita</h3>
        <Button variant="secondary" onClick={fechar}>
          Fechar detalhe
        </Button>
      </div>
      {detalhe.isPending && <output>Carregando detalhe…</output>}
      {detalhe.isError && (
        <p role="alert">
          Não foi possível carregar o detalhe.{" "}
          <button type="button" onClick={() => void detalhe.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      <div hidden={detalhe.isFetching || detalhe.isError}>
        {detalhe.data && (
          <p>
            {estados[detalhe.data.estado]} — {detalhe.data.quantidadeOs} OS —{" "}
            {detalhe.data.quantidadeEquipe} pessoa(s) — deslocamento{" "}
            {detalhe.data.deslocamentoMinutos} min
          </p>
        )}
        {detalhe.data && (
          <AcoesVisita
            userId={userId}
            clienteId={clienteId}
            visita={detalhe.data}
            bloqueado={bloqueado || detalhe.isFetching || detalhe.isError}
          />
        )}
        {detalhe.data && import.meta.env.VITE_SSO_COMPOSICAO_VISITA_ENABLED === "true" && (
          <ConferirComposicao userId={userId} clienteId={clienteId} visitaId={visitaId} bloqueado={bloqueado || detalhe.isFetching || detalhe.isError} />
        )}
        {detalhe.data && !bloqueado && import.meta.env.VITE_SSO_DIAGNOSTICO_SYNC_VISITA_ENABLED === "true" && (
          <DiagnosticoSincronizacao userId={userId} clienteId={clienteId} visitaId={visitaId} />
        )}
        {detalhe.data && !bloqueado && import.meta.env.VITE_SSO_TRIAGEM_SYNC_EQUIPE_ENABLED === "true" && (
          <TriagemSyncEquipe userId={userId} clienteId={clienteId} visitaId={visitaId} revisaoVisita={detalhe.data.revisao} />
        )}
        {detalhe.data && import.meta.env.VITE_SSO_TRANSICAO_VISITA_ENABLED === "true" && (
          <TransicaoVisita key={detalhe.data.id} userId={userId} clienteId={clienteId} visita={detalhe.data}
            bloqueado={bloqueado || detalhe.isFetching || detalhe.isError} />
        )}
        {detalhe.data && !bloqueado && (
          <DespesasVisitaWorkspace
            userId={userId}
            clienteId={clienteId}
            visitaId={visitaId}
            habilitado={import.meta.env.VITE_SSO_DESPESAS_VISITA_ENABLED === "true"}
          />
        )}
        {(ciencia.isPending || ciencia.isFetching) && <output>Conferindo ciência…</output>}
        {ciencia.isError && !ciencia.isFetching && (
          <p role="alert">
            Não foi possível conferir a ciência.{" "}
            <button type="button" onClick={() => void ciencia.refetch()}>
              Tentar novamente
            </button>
          </p>
        )}
        {ciencia.data && !ciencia.isFetching && !ciencia.isError && (
          <p>{situacoes[ciencia.data.situacao]} (registro de ciência; não substitui confirmação explícita nem autoriza envio).</p>
        )}
        {detalhe.data && import.meta.env.VITE_SSO_CONFERIR_CONFIRMACAO_CLIENTE_ENABLED === "true" && <ConferenciaConfirmacaoCliente userId={userId} clienteId={clienteId} visitaId={visitaId} revisao={detalhe.data.revisao} />}
        {import.meta.env.VITE_SSO_HISTORICO_INTENCAO_LOCAL_ENABLED === "true" && <HistoricoIntencaoLocal userId={userId} clienteId={clienteId} visitaId={visitaId} />}
        <HistoricoAlertasReprogramacao userId={userId} clienteId={clienteId} visitaId={visitaId} />
        <Button
          variant="secondary"
          aria-pressed={historico}
          onClick={() => setHistorico(!historico)}
        >
          {historico ? "Mostrar somente vigentes" : "Mostrar histórico"}
        </Button>
        {historico && (
          <p>
            O histórico inclui vínculos vigentes e encerrados. Nomes e títulos atuais são exibidos;
            não representam necessariamente os dados da época.
          </p>
        )}
        <div>
          <h4 className="font-semibold">Ordens de Serviço</h4>
          {(os.isPending || os.isFetching) && <output>Carregando OS…</output>}
          {os.isError && !os.isFetching && (
            <p role="alert">
              Não foi possível carregar OS.{" "}
              <button type="button" onClick={() => void os.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {!os.isFetching && !os.isError && (
            <>
              {os.data && os.data.pages.flat().length === 0 && <p>Nenhuma OS vinculada.</p>}
              <ol>
                {os.data?.pages.flat().map((o) => (
                  <li key={o.id}>
                    {o.sequencia}. {o.numero} — {o.titulo} ({o.categoria})
                    {historico &&
                      (o.encerradoEm
                        ? ` — encerrado em ${horario(o.encerradoEm, detalhe.data?.fuso ?? "UTC")} — motivo: ${o.encerramentoMotivo ?? "não informado"}`
                        : " — vigente")}
                    {!o.encerradoEm && !bloqueado && !detalhe.isFetching && !detalhe.isError && <MateriaisDaOrdem
                      usuario={userId} cliente={clienteId} ordem={o.osId} numero={o.numero} />}
                    {import.meta.env.VITE_SSO_PORTAL_VISITAS_PUBLICACAO_ENABLED === "true" && !o.encerradoEm && detalhe.data &&
                      ["planejada", "confirmada", "enviada", "em_execucao", "parcial"].includes(detalhe.data.estado) &&
                      <PublicarVisitaPortal key={`${o.id}:${detalhe.data.revisao}`} userId={userId} clienteId={clienteId} visitaId={visitaId} osId={o.osId}
                        revisao={detalhe.data.revisao} bloqueado={bloqueado || detalhe.isFetching || detalhe.isError || os.isFetching || os.isError} />}
                    {import.meta.env.VITE_SSO_INTENCAO_LOCAL_ENVIO_ENABLED === "true" && !o.encerradoEm && detalhe.data?.estado === "confirmada" &&
                      <IntencaoLocalEnvio key={`${o.id}:${detalhe.data.revisao}`} userId={userId} clienteId={clienteId} visitaId={visitaId} osId={o.osId}
                        revisao={detalhe.data.revisao} bloqueado={bloqueado || detalhe.isFetching || detalhe.isError || os.isFetching || os.isError} />}
                    {import.meta.env.VITE_SSO_CONTEUDO_BASICO_OS_ENABLED === "true" && !o.encerradoEm && detalhe.data?.estado === "planejada" &&
                      <ConferirConteudoOs key={`${o.id}:${detalhe.data.revisao}`} userId={userId} clienteId={clienteId} visitaId={visitaId} osId={o.osId}
                        revisao={detalhe.data.revisao} bloqueado={bloqueado || detalhe.isFetching || detalhe.isError || os.isFetching || os.isError} />}
                    {import.meta.env.VITE_SSO_VINCULO_OS_ROTINA_ENABLED === "true" && !o.encerradoEm && <VincularOsRotina userId={userId} clienteId={clienteId} osId={o.osId} bloqueado={bloqueado || detalhe.isFetching || detalhe.isError || os.isFetching || os.isError} />}
                    {import.meta.env.VITE_SSO_RETIFICAR_OS_ROTINA_ENABLED === "true" && !o.encerradoEm && <RetificarOsRotina userId={userId} clienteId={clienteId} osId={o.osId} bloqueado={bloqueado || detalhe.isFetching || detalhe.isError || os.isFetching || os.isError} />}
                  </li>
                ))}
              </ol>
              {os.hasNextPage && (
                <Button
                  variant="secondary"
                  disabled={os.isFetchingNextPage}
                  onClick={() => void os.fetchNextPage()}
                >
                  Mais OS
                </Button>
              )}
            </>
          )}
        </div>
        <div>
          <h4 className="font-semibold">Equipe</h4>
          {(equipe.isPending || equipe.isFetching) && <output>Carregando equipe…</output>}
          {equipe.isError && !equipe.isFetching && (
            <p role="alert">
              Não foi possível carregar equipe.{" "}
              <button type="button" onClick={() => void equipe.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {!equipe.isFetching && !equipe.isError && (
            <>
              {equipe.data && equipe.data.pages.flat().length === 0 && (
                <p>Nenhuma pessoa vinculada.</p>
              )}
              <ul>
                {equipe.data?.pages.flat().map((p) => (
                  <li key={p.id}>
                    {p.nome} — {p.papel}
                    {p.estimativaMinutos === null
                      ? " — tempo a validar"
                      : ` — ${p.estimativaMinutos} min`}
                    {historico &&
                      (p.encerradoEm
                        ? ` — encerrada em ${horario(p.encerradoEm, detalhe.data?.fuso ?? "UTC")} — motivo: ${p.encerramentoMotivo ?? "não informado"}`
                        : " — vigente")}
                  </li>
                ))}
              </ul>
              {equipe.hasNextPage && (
                <Button
                  variant="secondary"
                  disabled={equipe.isFetchingNextPage}
                  onClick={() => void equipe.fetchNextPage()}
                >
                  Mais pessoas
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
