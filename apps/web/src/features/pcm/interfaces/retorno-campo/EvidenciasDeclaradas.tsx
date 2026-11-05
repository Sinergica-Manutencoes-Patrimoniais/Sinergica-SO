import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { ConferenciaCobertura } from "./ConferenciaCobertura";
import { DecisoesRetorno } from "./DecisoesRetorno";
import { EvidenciaPorResposta } from "./EvidenciaPorResposta";
import { FotosRetorno } from "./FotosRetorno";
import { PendenciasRetornoAprovado } from "./PendenciasRetornoAprovado";
import { PreviaCoberturaPerguntas } from "./PreviaCoberturaPerguntas";
import { PreviaEvidenciasResposta } from "./PreviaEvidenciasResposta";
import { UploadEvidenciaResposta } from "./UploadEvidenciaResposta";

type Retorno = {
  retorno_id: string;
  os_id: string;
  envelope_id: string;
  revisao_evidencias: number;
};
type Pedido = {
  requestId: string;
  clienteId: string;
  retornoId: string;
  evidenciaId: string;
  revision: number;
  tipo: string;
  referencia: string;
  descricao: string;
};
export function EvidenciasDeclaradas({ userId, clienteId }: { userId: string; clienteId: string }) {
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const chave = `sso-retorno-evidencia:${JSON.stringify([userId, clienteId])}`;
  const trava = useRef(false);
  async function conferirSessao(signal?: AbortSignal) {
    const atual = await supabase.auth.getUser();
    if (atual.error || atual.data.user?.id !== userId || !montado.current || signal?.aborted)
      throw new Error("Sessão alterada.");
  }
  const [selecionado, setSelecionado] = useState("");
  const [tipo, setTipo] = useState("observacao");
  const [referencia, setReferencia] = useState("");
  const [descricao, setDescricao] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [pedido, setPedido] = useState<Pedido | "invalido" | null>(() => {
    try {
      const valor = sessionStorage.getItem(chave);
      if (!valor) return null;
      const p = JSON.parse(valor) as Pedido;
      return p &&
        p.clienteId === clienteId &&
        typeof p.requestId === "string" &&
        typeof p.retornoId === "string" &&
        typeof p.evidenciaId === "string" &&
        Number.isSafeInteger(p.revision) &&
        typeof p.referencia === "string" &&
        typeof p.descricao === "string"
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const cache = useQueryClient();
  const retornos = useInfiniteQuery({
    queryKey: ["retorno-declarado", userId, clienteId],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_retornos_declarados_mediada", {
          p_cliente_id: clienteId,
          p_apos: pageParam,
          p_limite: 30,
        })
        .abortSignal(signal);
      if (error) throw error;
      if (
        !Array.isArray(data) ||
        data.length > 30 ||
        data.some(
          (r) => typeof r.retorno_id !== "string" || !Number.isSafeInteger(r.revisao_evidencias),
        )
      )
        throw new Error("Resposta inválida.");
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const r of data) {
        if (r.retorno_id.toLowerCase() <= anterior) throw new Error("Página divergente.");
        anterior = r.retorno_id.toLowerCase();
      }
      await conferirSessao(signal);
      return data as Retorno[];
    },
    getNextPageParam: (pagina) => (pagina.length === 30 ? pagina.at(-1)?.retorno_id : undefined),
  });
  const evidencias = useInfiniteQuery({
    queryKey: ["retorno-evidencias", userId, clienteId, selecionado],
    gcTime: 0,
    enabled: !!selecionado,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_evidencias_declaradas_mediada", {
          p_cliente_id: clienteId,
          p_retorno_id: selecionado,
          p_apos: pageParam,
          p_limite: 30,
        })
        .abortSignal(signal);
      if (error) throw error;
      if (
        !Array.isArray(data) ||
        data.length > 30 ||
        data.some(
          (e) =>
            typeof e.id !== "string" ||
            !Number.isSafeInteger(e.revisao) ||
            typeof e.descricao !== "string" ||
            typeof e.referencia !== "string",
        )
      )
        throw new Error("Resposta inválida.");
      let anterior = pageParam ?? 0;
      for (const e of data) {
        if (e.revisao <= anterior) throw new Error("Página divergente.");
        anterior = e.revisao;
      }
      await conferirSessao(signal);
      return data as {
        id: string;
        revisao: number;
        tipo: string;
        referencia: string;
        descricao: string;
      }[];
    },
    getNextPageParam: (pagina) => (pagina.length === 30 ? pagina.at(-1)?.revisao : undefined),
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_anotar_evidencia_retorno_mediada", {
          p_request_id: p.requestId,
          p_cliente_id: p.clienteId,
          p_retorno_id: p.retornoId,
          p_evidencia_id: p.evidenciaId,
          p_expected_revision: p.revision,
          p_tipo: p.tipo,
          p_referencia: p.referencia,
          p_descricao: p.descricao,
        });
      if (error) throw error;
      if (
        !data ||
        data.requestId !== p.requestId ||
        data.retornoId !== p.retornoId ||
        data.revision !== p.revision + 1 ||
        data.coberturaComprovada !== false
      )
        throw new Error("Resposta inválida.");
      await conferirSessao();
    },
    onSuccess: async (_, p) => {
      try {
        await conferirSessao();
        if (sessionStorage.getItem(chave) !== JSON.stringify(p))
          throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(chave);
      } catch {
        setMensagem("Registro concluído, mas tentativa não foi removida. Procure suporte.");
        return;
      }
      setPedido(null);
      setReferencia("");
      setDescricao("");
      setMensagem("Evidência declarada; origem e cobertura não foram comprovadas.");
      await cache.invalidateQueries({ queryKey: ["retorno-declarado", userId, clienteId] });
      await cache.invalidateQueries({ queryKey: ["retorno-evidencias", userId, clienteId] });
    },
    onError: () =>
      setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."),
    onSettled: () => {
      trava.current = false;
    },
  });
  const enviar = (p: Pedido) => {
    if (trava.current) return;
    trava.current = true;
    envio.mutate(p);
  };
  return (
    <section aria-label="Evidências declaradas">
      <h3>Evidências declaradas</h3>
      <p>
        Registro manual sem arquivo ou consulta externa; referência não prova existência. Não inclua
        credenciais nem dados sensíveis.
      </p>
      {retornos.isFetching && <output>Carregando retornos…</output>}
      {retornos.isError && (
        <p role="alert">
          Consulta indisponível.{" "}
          <button type="button" onClick={() => void retornos.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {retornos.data && !retornos.isFetching && !retornos.isError && (
        <ul>
          {retornos.data.pages.flat().map((r) => (
            <li key={r.retorno_id}>
              Retorno {r.retorno_id} · OS {r.os_id} · envelope {r.envelope_id} · revisão das
              evidências {r.revisao_evidencias}
              <button type="button" onClick={() => setSelecionado(r.retorno_id)}>
                Conferir evidências
              </button>
              {selecionado === r.retorno_id && (
                <>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (
                        pedido ||
                        trava.current ||
                        !referencia.trim() ||
                        !descricao.trim() ||
                        retornos.isFetching ||
                        retornos.isError
                      )
                        return;
                      const p: Pedido = {
                        requestId: crypto.randomUUID(),
                        clienteId,
                        retornoId: r.retorno_id,
                        evidenciaId: crypto.randomUUID(),
                        revision: r.revisao_evidencias,
                        tipo,
                        referencia: referencia.trim(),
                        descricao: descricao.trim(),
                      };
                      try {
                        if (sessionStorage.getItem(chave) !== null) {
                          setMensagem("Há tentativa anterior; reabra para recuperar.");
                          return;
                        }
                        sessionStorage.setItem(chave, JSON.stringify(p));
                      } catch {
                        setMensagem("Não foi possível guardar tentativa; nada foi enviado.");
                        return;
                      }
                      setPedido(p);
                      enviar(p);
                    }}
                  >
                    <fieldset disabled={!!pedido || envio.isPending}>
                      <label>
                        Tipo{" "}
                        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                          <option value="observacao">Observação declarada</option>
                          <option value="referencia_documento">
                            Referência documental declarada
                          </option>
                        </select>
                      </label>
                      <label>
                        Referência{" "}
                        <input
                          required
                          maxLength={500}
                          value={referencia}
                          onChange={(e) => setReferencia(e.target.value)}
                        />
                      </label>
                      <label>
                        Descrição{" "}
                        <textarea
                          required
                          maxLength={2000}
                          value={descricao}
                          onChange={(e) => setDescricao(e.target.value)}
                        />
                      </label>
                      <button type="submit">Registrar declaração</button>
                    </fieldset>
                  </form>
                  {evidencias.isFetching && <output>Carregando evidências…</output>}
                  {evidencias.isError && (
                    <p role="alert">
                      Evidências indisponíveis.{" "}
                      <button type="button" onClick={() => void evidencias.refetch()}>
                        Tentar novamente
                      </button>
                    </p>
                  )}
                  {!evidencias.isFetching && !evidencias.isError && (
                    <ul>
                      {evidencias.data?.pages.flat().map((e) => (
                        <li key={e.id}>
                          {e.tipo} · {e.referencia} · {e.descricao} · revisão {e.revisao}
                        </li>
                      ))}
                    </ul>
                  )}
                  {evidencias.hasNextPage && (
                    <button type="button" onClick={() => void evidencias.fetchNextPage()}>
                      Mais evidências
                    </button>
                  )}
                  {import.meta.env.VITE_SSO_CONFERENCIA_COBERTURA_ENABLED === "true" &&
                    !evidencias.isFetching &&
                    !evidencias.isError &&
                    evidencias.data && (
                      <ConferenciaCobertura
                        userId={userId}
                        clienteId={clienteId}
                        retornoId={r.retorno_id}
                        revision={r.revisao_evidencias}
                        evidencias={evidencias.data.pages.flat()}
                      />
                    )}
                  {import.meta.env.VITE_SSO_EVIDENCIA_POR_RESPOSTA_ENABLED === "true" &&
                    !evidencias.isFetching &&
                    !evidencias.isError &&
                    evidencias.data && (
                      <EvidenciaPorResposta
                        userId={userId}
                        clienteId={clienteId}
                        retornoId={r.retorno_id}
                        revision={r.revisao_evidencias}
                        evidencias={evidencias.data.pages.flat()}
                      />
                    )}
                  {import.meta.env.VITE_SSO_PREVIA_EVIDENCIA_RESPOSTA_ENABLED === "true" && (
                    <PreviaEvidenciasResposta
                      userId={userId}
                      clienteId={clienteId}
                      retornoId={r.retorno_id}
                    />
                  )}
                  {import.meta.env.VITE_SSO_FOTOS_RETORNO_ENABLED === "true" && (
                    <FotosRetorno userId={userId} clienteId={clienteId} retornoId={r.retorno_id} />
                  )}
                  {import.meta.env.VITE_SSO_UPLOAD_EVIDENCIA_RESPOSTA_ENABLED === "true" && (
                    <UploadEvidenciaResposta
                      userId={userId}
                      clienteId={clienteId}
                      retornoId={r.retorno_id}
                    />
                  )}
                  {import.meta.env.VITE_SSO_PREVIA_COBERTURA_PERGUNTAS_ENABLED === "true" && (
                    <PreviaCoberturaPerguntas
                      userId={userId}
                      clienteId={clienteId}
                      retornoId={r.retorno_id}
                    />
                  )}
                  {import.meta.env.VITE_SSO_PENDENCIAS_RETORNO_APROVADO_ENABLED === "true" && (
                    <PendenciasRetornoAprovado
                      userId={userId}
                      clienteId={clienteId}
                      retornoId={r.retorno_id}
                    />
                  )}
                  {import.meta.env.VITE_SSO_DECISOES_RETORNO_ENABLED === "true" && (
                    <DecisoesRetorno
                      userId={userId}
                      clienteId={clienteId}
                      retornoId={r.retorno_id}
                    />
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {retornos.hasNextPage && (
        <button type="button" onClick={() => void retornos.fetchNextPage()}>
          Mais retornos
        </button>
      )}
      {pedido === "invalido" && <p role="alert">Tentativa ilegível. Procure suporte.</p>}
      {pedido && pedido !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pedido)}>
          Repetir mesmo pedido
        </button>
      )}
      {mensagem && <p role="status">{mensagem}</p>}
    </section>
  );
}
