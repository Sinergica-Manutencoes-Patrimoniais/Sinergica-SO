import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
type Pedido = {
  requestId: string;
  clienteId: string;
  retornoId: string;
  revision: number;
  respostaId: string;
  anexoId: string;
  justificativa: string;
};

export function FotoPorResposta({
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
  const storageKey = `sso-foto-resposta:${JSON.stringify([userId, clienteId, retornoId])}`;
  const trava = useRef(false);
  async function conferirSessao(signal?: AbortSignal) {
    const atual = await supabase.auth.getUser();
    if (atual.error || atual.data.user?.id !== userId || !montado.current || signal?.aborted)
      throw new Error("Sessão alterada.");
  }
  const [resposta, setResposta] = useState("");
  const [anexo, setAnexo] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const p = JSON.parse(raw) as Pedido;
      return p.clienteId === clienteId &&
        p.retornoId === retornoId &&
        typeof p.requestId === "string" &&
        typeof p.respostaId === "string" &&
        typeof p.anexoId === "string" &&
        Number.isSafeInteger(p.revision) &&
        typeof p.justificativa === "string"
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const respostas = useInfiniteQuery({
    queryKey: ["retorno-respostas", userId, clienteId, retornoId],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_respostas_retorno_mediada", {
          p_cliente_id: clienteId,
          p_retorno_id: retornoId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Respostas inválidas.");
      return data as { id: string; chave_pergunta: string; resultado: string }[];
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.id : undefined),
  });
  const fotos = useInfiniteQuery({
    queryKey: ["retorno-fotos-referenciadas", userId, clienteId, retornoId],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_fotos_referenciadas_mediada", {
          p_cliente_id: clienteId,
          p_retorno_id: retornoId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Fotos inválidas.");
      return data as { id: string; nota_id: string; mime_declarado: string; criado_em: string }[];
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.id : undefined),
  });
  const historico = useInfiniteQuery({
    queryKey: ["retorno-fotos-respostas", userId, clienteId, retornoId],
    gcTime: 0,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_fotos_resposta_mediada", {
          p_cliente_id: clienteId,
          p_retorno_id: retornoId,
          p_antes: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Histórico inválido.");
      return data as {
        id: string;
        resposta_id: string;
        anexo_id: string;
        revisao: number;
        justificativa: string;
        ator_id: string;
        criado_em: string;
      }[];
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.revisao : undefined),
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessao();
      if (sessionStorage.getItem(storageKey) !== JSON.stringify(p))
        throw new Error("Tentativa alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_associar_foto_resposta_mediada", {
          p_request_id: p.requestId,
          p_cliente_id: p.clienteId,
          p_retorno_id: p.retornoId,
          p_expected_revision: p.revision,
          p_resposta_id: p.respostaId,
          p_anexo_id: p.anexoId,
          p_justificativa: p.justificativa,
        });
      if (error) throw error;
      if (
        !data ||
        data.requestId !== p.requestId ||
        data.revision !== p.revision + 1 ||
        data.conteudoComprovado !== false
      )
        throw new Error("Resposta inválida.");
      await conferirSessao();
    },
    onSuccess: async (_, p) => {
      try {
        await conferirSessao();
        if (sessionStorage.getItem(storageKey) !== JSON.stringify(p))
          throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(storageKey);
      } catch {
        setAviso("Tentativa local não pôde ser removida; procure suporte.");
        return;
      }
      setPendente(null);
      setAviso("Associação registrada; conteúdo e execução não foram comprovados.");
      await cache.invalidateQueries({
        queryKey: ["retorno-fotos-respostas", userId, clienteId, retornoId],
      });
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado, foto indisponível ou revisão obsoleta. Repita a mesma tentativa; procure suporte em conflito.",
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
      setAviso("Não foi possível guardar tentativa; nada enviado.");
      return;
    }
    trava.current = true;
    setPendente(p);
    envio.mutate(p);
  };
  const revision = historico.data?.pages[0]?.[0]?.revisao ?? 0;
  return (
    <section aria-label="Foto por resposta">
      <h4>Associar foto a resposta</h4>
      <p>
        Associação declarada pelo PCM; objeto privado não comprova conteúdo, autoria, pertinência ou
        execução e não valida cobertura.
      </p>
      {(respostas.isError || fotos.isError || historico.isError) && (
        <p role="alert">
          Fontes ou histórico indisponíveis.{" "}
          <button
            type="button"
            onClick={() => {
              void respostas.refetch();
              void fotos.refetch();
              void historico.refetch();
            }}
          >
            Tentar novamente
          </button>
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            pendente ||
            !resposta ||
            !anexo ||
            !justificativa.trim() ||
            !historico.data ||
            historico.isFetching ||
            historico.isError ||
            respostas.isFetching ||
            respostas.isError ||
            fotos.isFetching ||
            fotos.isError
          )
            return;
          enviar({
            requestId: crypto.randomUUID(),
            clienteId,
            retornoId,
            revision,
            respostaId: resposta,
            anexoId: anexo,
            justificativa: justificativa.trim(),
          });
        }}
      >
        <fieldset
          disabled={
            !!pendente ||
            envio.isPending ||
            !historico.data ||
            historico.isFetching ||
            historico.isError ||
            respostas.isFetching ||
            respostas.isError ||
            fotos.isFetching ||
            fotos.isError
          }
        >
          <label>
            Resposta{" "}
            <select required value={resposta} onChange={(e) => setResposta(e.target.value)}>
              <option value="">Selecione</option>
              {respostas.data?.pages.flat().map((r) => (
                <option key={r.id} value={r.id}>
                  {r.chave_pergunta} · {r.resultado}
                </option>
              ))}
            </select>
          </label>{" "}
          <label>
            Foto referenciada{" "}
            <select required value={anexo} onChange={(e) => setAnexo(e.target.value)}>
              <option value="">Selecione</option>
              {fotos.data?.pages.flat().map((f) => (
                <option key={f.id} value={f.id}>
                  Nota {f.nota_id} · {f.mime_declarado}
                </option>
              ))}
            </select>
          </label>{" "}
          <label>
            Justificativa{" "}
            <textarea
              required
              maxLength={2000}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
            />
          </label>
          <button type="submit">Associar</button>
        </fieldset>
      </form>
      {respostas.hasNextPage && (
        <button type="button" onClick={() => void respostas.fetchNextPage()}>
          Mais respostas
        </button>
      )}
      {fotos.hasNextPage && (
        <button type="button" onClick={() => void fotos.fetchNextPage()}>
          Mais fotos
        </button>
      )}
      {historico.data && (
        <ul>
          {historico.data.pages.flat().map((a) => (
            <li key={a.id}>
              Revisão {a.revisao} · resposta {a.resposta_id} · foto {a.anexo_id} · {a.justificativa}{" "}
              · {a.ator_id} · {a.criado_em}
            </li>
          ))}
        </ul>
      )}
      {historico.hasNextPage && (
        <button type="button" onClick={() => void historico.fetchNextPage()}>
          Mais histórico
        </button>
      )}
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <output className="block">{aviso}</output>}
    </section>
  );
}
