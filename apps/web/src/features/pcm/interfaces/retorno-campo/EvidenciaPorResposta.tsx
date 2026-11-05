import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { GestaoReclassificacaoResposta } from "./GestaoReclassificacaoResposta";
import { PreviaReclassificacaoResposta } from "./PreviaReclassificacaoResposta";
type Pedido = {
  requestId: string;
  clienteId: string;
  retornoId: string;
  respostaId: string;
  evidenciaId: string;
  revision: number;
  motivo: string;
};

export function EvidenciaPorResposta({
  userId,
  clienteId,
  retornoId,
  revision,
  evidencias,
}: {
  userId: string;
  clienteId: string;
  retornoId: string;
  revision: number;
  evidencias: { id: string; referencia: string }[];
}) {
  const cache = useQueryClient();
  const storageKey = `sso-evidencia-resposta:${JSON.stringify([userId, clienteId, retornoId])}`;
  const trava = useRef(false);
  async function conferirSessao(signal?: AbortSignal) {
    const atual = await supabase.auth.getUser();
    if (atual.error || atual.data.user?.id !== userId || signal?.aborted)
      throw new Error("Sessão alterada.");
  }
  const [resposta, setResposta] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [motivo, setMotivo] = useState("");
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
        typeof p.evidenciaId === "string" &&
        Number.isSafeInteger(p.revision) &&
        typeof p.motivo === "string"
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
      await conferirSessao(signal);
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
      if (!Array.isArray(data) || data.length > 20) throw new Error("Respostas inválidas.");
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const item of data) {
        if (typeof item.id !== "string" || item.id.toLowerCase() <= anterior)
          throw new Error("Página divergente.");
        anterior = item.id.toLowerCase();
      }
      await conferirSessao(signal);
      return data as {
        id: string;
        chave_pergunta: string;
        resultado: string;
        observacao: string | null;
      }[];
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.id : undefined),
  });
  const historico = useInfiniteQuery({
    queryKey: ["retorno-evidencias-respostas", userId, clienteId, retornoId],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_evidencias_resposta_mediada", {
          p_cliente_id: clienteId,
          p_retorno_id: retornoId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data) || data.length > 20) throw new Error("Histórico inválido.");
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const item of data) {
        if (typeof item.id !== "string" || item.id.toLowerCase() <= anterior)
          throw new Error("Página divergente.");
        anterior = item.id.toLowerCase();
      }
      await conferirSessao(signal);
      return data as {
        id: string;
        resposta_id: string;
        evidencia_id: string;
        revisao_evidencias: number;
        motivo: string;
        ator_id: string;
        criado_em: string;
      }[];
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.id : undefined),
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessao();
      if (sessionStorage.getItem(storageKey) !== JSON.stringify(p))
        throw new Error("Tentativa alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_vincular_evidencia_resposta_mediada", {
          p_request_id: p.requestId,
          p_cliente_id: p.clienteId,
          p_retorno_id: p.retornoId,
          p_resposta_id: p.respostaId,
          p_evidencia_id: p.evidenciaId,
          p_expected_evidencias: p.revision,
          p_motivo: p.motivo,
        });
      if (error) throw error;
      if (!data || data.requestId !== p.requestId || data.evidenciaAutenticada !== false)
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
      setAviso("Associação declarada; anexo não foi autenticado.");
      await cache.invalidateQueries({
        queryKey: ["retorno-evidencias-respostas", userId, clienteId, retornoId],
      });
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado ou revisão obsoleta. Repita a mesma tentativa; procure suporte em conflito.",
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
  return (
    <section aria-label="Evidência por resposta">
      <h4>Evidência por resposta</h4>
      <p>
        Associação expressa do PCM: referência declarada, não anexo autenticado nem prova de
        execução. Não se aplica automaticamente às outras perguntas.
      </p>
      {respostas.isError && (
        <p role="alert">
          Respostas indisponíveis.{" "}
          <button type="button" onClick={() => void respostas.refetch()}>
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
            !evidencia ||
            !motivo.trim() ||
            respostas.isFetching ||
            respostas.isError
          )
            return;
          enviar({
            requestId: crypto.randomUUID(),
            clienteId,
            retornoId,
            respostaId: resposta,
            evidenciaId: evidencia,
            revision,
            motivo: motivo.trim(),
          });
        }}
      >
        <fieldset
          disabled={!!pendente || envio.isPending || respostas.isFetching || respostas.isError}
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
            Evidência declarada{" "}
            <select required value={evidencia} onChange={(e) => setEvidencia(e.target.value)}>
              <option value="">Selecione</option>
              {evidencias.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.referencia}
                </option>
              ))}
            </select>
          </label>{" "}
          <label>
            Motivo{" "}
            <textarea
              required
              maxLength={2000}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <button type="submit">Registrar associação</button>
        </fieldset>
      </form>
      {resposta && (
        <PreviaReclassificacaoResposta
          userId={userId}
          clienteId={clienteId}
          respostaId={resposta}
        />
      )}
      {resposta && (
        <GestaoReclassificacaoResposta
          userId={userId}
          clienteId={clienteId}
          retornoId={retornoId}
          respostaId={resposta}
        />
      )}
      {respostas.hasNextPage && (
        <button type="button" onClick={() => void respostas.fetchNextPage()}>
          Mais respostas
        </button>
      )}
      {historico.isError && (
        <p role="alert">
          Histórico indisponível.{" "}
          <button type="button" onClick={() => void historico.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {historico.data && (
        <ul>
          {historico.data.pages.flat().map((v) => (
            <li key={v.id}>
              Resposta {v.resposta_id} · evidência {v.evidencia_id} · revisão {v.revisao_evidencias}{" "}
              · {v.motivo} · {v.ator_id} · {v.criado_em}
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
