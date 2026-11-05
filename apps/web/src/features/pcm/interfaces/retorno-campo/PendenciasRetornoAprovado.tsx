import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
type Pedido = {
  requestId: string;
  clienteId: string;
  retornoId: string;
  condicaoId: string;
  revisaoDecisao: number;
};

export function PendenciasRetornoAprovado({
  userId,
  clienteId,
  retornoId,
}: { userId: string; clienteId: string; retornoId: string }) {
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const cache = useQueryClient();
  const storageKey = `sso-pendencias-retorno:${JSON.stringify([userId, clienteId, retornoId])}`;
  const [condicao, setCondicao] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const trava = useRef(false);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const p = JSON.parse(raw) as Pedido;
      return p.clienteId === clienteId &&
        p.retornoId === retornoId &&
        typeof p.requestId === "string" &&
        typeof p.condicaoId === "string" &&
        Number.isSafeInteger(p.revisaoDecisao)
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const condicoes = useInfiniteQuery({
    queryKey: ["retorno-condicoes", userId, clienteId, retornoId],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_condicoes_retorno_mediado", {
          p_cliente_id: clienteId,
          p_retorno_id: retornoId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Condições inválidas.");
      return data as {
        id: string;
        revisao_evidencias: number;
        revisao_decisao: number;
        criado_em: string;
      }[];
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.id : undefined),
  });
  const decisoes = useInfiniteQuery({
    queryKey: ["retorno-decisoes", userId, clienteId, retornoId],
    gcTime: 0,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_decisoes_retorno_mediado", {
          p_cliente_id: clienteId,
          p_retorno_id: retornoId,
          p_antes: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Decisões inválidas.");
      return data as {
        revisao: number;
        decisao: string;
        motivo: string | null;
        ator_id: string;
        criado_em: string;
      }[];
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.revisao : undefined),
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      if (sessionStorage.getItem(storageKey) !== JSON.stringify(p))
        throw new Error("Tentativa divergente.");
      const antes = await supabase.auth.getUser();
      if (
        antes.error ||
        antes.data.user?.id !== userId ||
        !montado.current ||
        sessionStorage.getItem(storageKey) !== JSON.stringify(p)
      )
        throw new Error("Sessão ou tentativa alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_preparar_pendencias_retorno_mediado", {
          p_request_id: p.requestId,
          p_cliente_id: p.clienteId,
          p_retorno_id: p.retornoId,
          p_condicao_id: p.condicaoId,
          p_expected_decisao: p.revisaoDecisao,
        });
      if (error) throw error;
      if (
        !data ||
        data.osEncerrada !== false ||
        data.requestId !== p.requestId ||
        data.retornoId !== p.retornoId ||
        !Number.isSafeInteger(data.pendenciasProcessadas) ||
        data.pendenciasProcessadas < 0
      )
        throw new Error("Resposta inválida.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || !montado.current)
        throw new Error("Sessão alterada.");
      return data as { pendenciasProcessadas: number };
    },
    onSuccess: async (r, p) => {
      await cache.invalidateQueries({ queryKey: ["pendencias-tecnicas", userId, clienteId] });
      await cache.invalidateQueries({
        queryKey: ["retorno-condicoes", userId, clienteId, retornoId],
      });
      try {
        const atual = await supabase.auth.getUser();
        if (atual.error || atual.data.user?.id !== userId || !montado.current)
          throw new Error("Sessão alterada.");
        if (sessionStorage.getItem(storageKey) !== JSON.stringify(p))
          throw new Error("Tentativa divergente.");
        sessionStorage.removeItem(storageKey);
      } catch {
        setAviso(
          "Processamento confirmado, mas tentativa local mudou ou não pôde ser removida; procure suporte.",
        );
        return;
      }
      setPendente(null);
      setConfirmado(null);
      setAviso(
        `${r.pendenciasProcessadas} resposta(s) Não OK processada(s). OS e Chamado não foram encerrados.`,
      );
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado ou requisitos mudaram. Repita a mesma tentativa; procure suporte em conflito.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  const enviar = (p: Pedido) => {
    if (trava.current) return;
    try {
      const salvo = sessionStorage.getItem(storageKey);
      if (pendente ? salvo !== JSON.stringify(p) : salvo !== null)
        throw new Error("Tentativa divergente.");
      if (!pendente) sessionStorage.setItem(storageKey, JSON.stringify(p));
    } catch {
      setAviso("Não foi possível conferir ou guardar tentativa; nada enviado.");
      return;
    }
    trava.current = true;
    setPendente(p);
    envio.mutate(p);
  };
  const ultima = decisoes.data?.pages[0]?.[0];
  const escolhida = condicoes.data?.pages.flat().find((c) => c.id === condicao);
  const elegivel =
    ultima?.decisao === "aprovar" && escolhida?.revisao_decisao === ultima.revisao - 1;
  const identidadeConfirmacao =
    elegivel && escolhida && ultima
      ? JSON.stringify([
          escolhida.id,
          escolhida.revisao_evidencias,
          escolhida.revisao_decisao,
          ultima.revisao,
        ])
      : null;
  return (
    <section aria-label="Pendências de retorno aprovado">
      <h4>Pendências de respostas Não OK</h4>
      <p>
        Somente retorno com aprovação versionada e condição estrutural correspondente. O servidor
        revalida tudo; isso não encerra OS ou Chamado nem aciona Auvo.
      </p>
      {(condicoes.isError || decisoes.isError) && (
        <p role="alert">
          Condições ou decisões indisponíveis.{" "}
          <button
            type="button"
            onClick={() => {
              void condicoes.refetch();
              void decisoes.refetch();
            }}
          >
            Tentar novamente
          </button>
        </p>
      )}
      <p>
        Última decisão carregada:{" "}
        {ultima ? `${ultima.decisao} · revisão ${ultima.revisao}` : "nenhuma"}.
      </p>
      <label>
        Condição estrutural{" "}
        <select
          value={condicao}
          disabled={!!pendente}
          onChange={(e) => {
            setCondicao(e.target.value);
            setConfirmado(null);
          }}
        >
          <option value="">Selecione</option>
          {condicoes.data?.pages.flat().map((c) => (
            <option key={c.id} value={c.id}>
              {c.id} · decisão anterior {c.revisao_decisao} · evidências {c.revisao_evidencias} ·{" "}
              {c.criado_em}
            </option>
          ))}
        </select>
      </label>{" "}
      {condicoes.hasNextPage && (
        <button type="button" onClick={() => void condicoes.fetchNextPage()}>
          Mais condições
        </button>
      )}
      <label>
        <input
          type="checkbox"
          checked={!!identidadeConfirmacao && confirmado === identidadeConfirmacao}
          disabled={
            !elegivel ||
            !!pendente ||
            condicoes.isFetching ||
            decisoes.isFetching ||
            condicoes.isError ||
            decisoes.isError
          }
          onChange={(e) => setConfirmado(e.target.checked ? identidadeConfirmacao : null)}
        />{" "}
        Conferi o retorno e autorizo preparar pendências Não OK
      </label>{" "}
      <button
        type="button"
        disabled={
          !elegivel ||
          !identidadeConfirmacao ||
          confirmado !== identidadeConfirmacao ||
          !!pendente ||
          envio.isPending ||
          condicoes.isFetching ||
          decisoes.isFetching ||
          condicoes.isError ||
          decisoes.isError
        }
        onClick={() =>
          ultima &&
          enviar({
            requestId: crypto.randomUUID(),
            clienteId,
            retornoId,
            condicaoId: condicao,
            revisaoDecisao: ultima.revisao,
          })
        }
      >
        Preparar pendências
      </button>
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}
