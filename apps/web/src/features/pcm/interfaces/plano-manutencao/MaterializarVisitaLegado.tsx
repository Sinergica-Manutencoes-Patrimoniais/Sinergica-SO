import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
import { LoteVisitaLegado } from "./LoteVisitaLegado";
import { ReservaCicloLegado } from "./ReservaCicloLegado";
import { ReconciliarLegadaInerte } from "./ReconciliarLegadaInerte";
import { FilaAposPreparacao } from "./FilaAposPreparacao";
type Pedido = {
  requestId: string;
  clienteId: string;
  planoId: string;
  legadoId: string;
  relacaoId: string;
  preparadaId: string;
  motivo: string;
};

export function MaterializarVisitaLegado(props: Parameters<typeof Conteudo>[0]) {
  return (
    <Conteudo
      key={JSON.stringify([
        props.userId,
        props.clienteId,
        props.planoId,
        props.legadoId,
        props.relacaoId,
        props.preparadaInicial,
      ])}
      {...props}
    />
  );
}
function Conteudo({
  userId,
  clienteId,
  planoId,
  legadoId,
  relacaoId,
  preparadaInicial,
  revision,
}: {
  userId: string;
  clienteId: string;
  planoId: string;
  legadoId: string;
  relacaoId: string;
  preparadaInicial?: string;
  revision?: number;
}) {
  const trava = useRef(false);
  const cache = useQueryClient();
  const chave = `sso-materializar-visita-legado:${JSON.stringify([userId, clienteId, planoId, legadoId])}`;
  const [selecionada, setSelecionada] = useState(preparadaInicial ?? "");
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [integrada, setIntegrada] = useState<string | null>(null);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = JSON.parse(raw) as Pedido;
      return p.clienteId === clienteId &&
        p.planoId === planoId &&
        p.legadoId === legadoId &&
        typeof p.requestId === "string" &&
        typeof p.relacaoId === "string" &&
        typeof p.preparadaId === "string" &&
        typeof p.motivo === "string"
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const lista = useInfiniteQuery({
    queryKey: ["visitas-integracao-legado", userId, clienteId, planoId, legadoId, relacaoId],
    initialPageParam: null as string | null,
    gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_visitas_legadas_mediadas", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_legado_id: legadoId,
          p_relacao_request_id: relacaoId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Lista inválida.");
      await conferirSessaoDiagnostico(userId, signal);
      return data as {
        preparada_id: string;
        visita_id: string;
        serie_id: string;
        semana_origem: string;
        vencimento_original: string;
        alvo_tipo: string;
        alvo_id: string;
      }[];
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.preparada_id : undefined),
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa divergente.");
      const antes = await supabase.auth.getUser();
      if (
        antes.error ||
        antes.data.user?.id !== userId ||
        sessionStorage.getItem(chave) !== JSON.stringify(p)
      )
        throw new Error("Sessão ou tentativa alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_materializar_visita_legada_mediada", {
          p_ator_id: userId,
          p_request_id: p.requestId,
          p_cliente_id: p.clienteId,
          p_preparada_id: p.preparadaId,
          p_plano_legado_id: p.legadoId,
          p_relacao_request_id: p.relacaoId,
          p_motivo: p.motivo,
        });
      if (error) throw error;
      if (
        !data ||
        data.requestId !== p.requestId ||
        data.preparadaId !== p.preparadaId ||
        typeof data.ocorrenciaLegadaCriada !== "boolean" ||
        data.planoLegadoCriado !== false ||
        data.osCriada !== false ||
        data.tarefaAuvoCriada !== false ||
        data.filaOficialIntegrada !== false ||
        data.fonteFeriadosCompleta !== false
      )
        throw new Error("Resposta inválida.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      return data as { ocorrenciaLegadaCriada: boolean };
    },
    onSuccess: async (r, p) => {
      try {
        await conferirSessaoDiagnostico(userId);
        await cache.invalidateQueries({
          queryKey: ["visitas-integracao-legado", userId, clienteId, planoId, legadoId],
        });
        if (sessionStorage.getItem(chave) !== JSON.stringify(p))
          throw new Error("Tentativa divergente.");
        sessionStorage.removeItem(chave);
      } catch {
        setAviso("Vínculo confirmado, mas tentativa alterada ou não removida; procure suporte.");
        return;
      }
      setPendente(null);
      setConfirmado(null);
      setIntegrada(p.preparadaId);
      setAviso(
        r.ocorrenciaLegadaCriada
          ? "Ocorrência legada criada e vinculada; fila/execução continuam bloqueadas."
          : "Ocorrência legada reutilizada e vinculada; fila/execução continuam bloqueadas.",
      );
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado, vínculo mudou ou ciclo exige reconciliação. Repita a tentativa; procure suporte em conflito.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  const enviar = (p: Pedido) => {
    if (trava.current) return;
    try {
      const salvo = sessionStorage.getItem(chave);
      if (pendente ? salvo !== JSON.stringify(p) : salvo !== null)
        throw new Error("Tentativa divergente.");
      if (!pendente) sessionStorage.setItem(chave, JSON.stringify(p));
    } catch {
      setAviso("Não foi possível conferir ou guardar tentativa; nada enviado.");
      return;
    }
    trava.current = true;
    if (!pendente) setIntegrada(null);
    setPendente(p);
    envio.mutate(p);
  };
  const visitaSelecionada = lista.data?.pages.flat().find((v) => v.preparada_id === selecionada);
  const assinatura = visitaSelecionada
    ? JSON.stringify([clienteId, planoId, legadoId, relacaoId, visitaSelecionada, motivo.trim()])
    : null;
  const confirmacaoAtual = assinatura !== null && confirmado === assinatura;
  return (
    <section aria-label="Materialização de Visita no legado">
      <h5>Vincular ciclo de Visita ao legado existente</h5>
      <p>
        Usa somente Plano legado já existente e relacionado; servidor confere identidade, alvo,
        data, questionário, fuso e feriados declarados. Fontes de feriado são incompletas. Não cria
        Plano fictício, OS ou Auvo; fila e execução permanecem bloqueadas até integração e
        homologação.
      </p>
      {preparadaInicial && !lista.isFetching && !lista.isError && !visitaSelecionada && (
        <output className="block">
          Ocorrência {preparadaInicial} não está nas páginas carregadas.{" "}
          {lista.hasNextPage
            ? "Carregue mais Visitas para localizá-la."
            : "Pode já estar vinculada ou indisponível para esta relação."}
        </output>
      )}
      {lista.isError && (
        <p role="alert">
          Lista indisponível ou relação alterada.{" "}
          <button type="button" onClick={() => void lista.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            pendente ||
            !selecionada ||
            !motivo.trim() ||
            !confirmacaoAtual ||
            lista.isFetching ||
            lista.isError
          )
            return;
          enviar({
            requestId: crypto.randomUUID(),
            clienteId,
            planoId,
            legadoId,
            relacaoId,
            preparadaId: selecionada,
            motivo: motivo.trim(),
          });
        }}
      >
        <fieldset disabled={!!pendente || envio.isPending || lista.isFetching || lista.isError}>
          <label>
            Ocorrência preparada{" "}
            <select
              required
              disabled={!!preparadaInicial}
              value={selecionada}
              onChange={(e) => {
                setSelecionada(e.target.value);
                setConfirmado(null);
              }}
            >
              <option value="">Selecione</option>
              {lista.data?.pages.flat().map((v) => (
                <option key={v.preparada_id} value={v.preparada_id}>
                  Semana {v.semana_origem} · vencimento {v.vencimento_original} · Visita{" "}
                  {v.visita_id} · {v.alvo_tipo} {v.alvo_id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Motivo{" "}
            <textarea
              required
              maxLength={2000}
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setConfirmado(null);
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={confirmacaoAtual}
              disabled={!assinatura}
              onChange={(e) => setConfirmado(e.target.checked ? assinatura : null)}
            />{" "}
            Conferi a Visita e autorizo somente o vínculo
          </label>
          <button type="submit" disabled={!confirmacaoAtual}>Processar Visita</button>
        </fieldset>
      </form>
      {lista.hasNextPage && (
        <button type="button" onClick={() => void lista.fetchNextPage()}>
          Mais Visitas
        </button>
      )}
      {import.meta.env.VITE_SSO_LOTE_VISITA_LEGADO_ENABLED === "true" && (
        <LoteVisitaLegado
          userId={userId}
          clienteId={clienteId}
          planoId={planoId}
          legadoId={legadoId}
          relacaoId={relacaoId}
          visitas={lista.data?.pages.flat() ?? []}
          consultando={lista.isFetching || lista.isError}
        />
      )}
      {import.meta.env.VITE_SSO_APROVAR_REVISAO_ENABLED === "true" && revision !== undefined && (
        <ReservaCicloLegado
          userId={userId}
          clienteId={clienteId}
          planoId={planoId}
          legadoId={legadoId}
          revision={revision}
          modo="visita"
          consultando={lista.isFetching || lista.isError}
        />
      )}
      {import.meta.env.VITE_SSO_RECONCILIAR_LEGADA_INERTE_ENABLED === "true" && (
        <ReconciliarLegadaInerte userId={userId} clienteId={clienteId} planoId={planoId} />
      )}
      {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <output className="block">{aviso}</output>}
      {integrada && (
        <section aria-label="Fila da Visita integrada">
          <p>Ocorrência integrada {integrada}. A fila precisa de conferência independente.</p>
          <FilaAposPreparacao
            userId={userId}
            clienteId={clienteId}
            planoId={planoId}
            preparadaId={integrada}
            tipo="visita"
          />
        </section>
      )}
    </section>
  );
}
