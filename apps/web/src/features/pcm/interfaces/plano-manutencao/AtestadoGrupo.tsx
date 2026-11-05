import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const pedidoSchema = z
  .object({
    requestId: uuid,
    clienteId: uuid,
    ocorrenciaId: uuid,
    revisao: z.number().int().nonnegative(),
    declaracao: z.string().trim().min(1).max(2000),
    referencia: z.string().trim().min(1).max(1000),
  })
  .strict();
type Pedido = z.infer<typeof pedidoSchema>;
const itemSchema = z
  .object({
    request_id: uuid,
    revisao: z.number().int().positive(),
    os_id: uuid,
    declaracao: z.string(),
    referencia_evidencia: z.string(),
    ator_id: uuid,
    criado_em: z.string(),
  })
  .strict();
type Props = { userId: string; clienteId: string; ocorrenciaId: string };
export function AtestadoGrupo(props: Props) {
  return (
    <Conteudo
      key={JSON.stringify([props.userId, props.clienteId, props.ocorrenciaId])}
      {...props}
    />
  );
}
function Conteudo({ userId, clienteId, ocorrenciaId }: Props) {
  const cache = useQueryClient();
  const key = ["atestados-grupo", userId, clienteId, ocorrenciaId];
  const storage = `atestado-grupo:${JSON.stringify([userId, clienteId, ocorrenciaId])}`;
  const trava = useRef(false);
  const [declaracao, setDeclaracao] = useState("");
  const [referencia, setReferencia] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(storage);
      if (!raw) return null;
      const p = pedidoSchema.parse(JSON.parse(raw));
      return p.clienteId === clienteId && p.ocorrenciaId === ocorrenciaId ? p : "invalido";
    } catch {
      return "invalido";
    }
  });
  async function sessao(signal?: AbortSignal) {
    const r = await supabase.auth.getUser();
    if (r.error || r.data.user?.id !== userId || signal?.aborted)
      throw new Error("Sessão alterada.");
  }
  const historico = useInfiniteQuery({
    queryKey: key,
    initialPageParam: null as number | null,
    gcTime: 0,
    retry: false,
    queryFn: async ({ pageParam, signal }) => {
      await sessao(signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_atestados_grupo_mediada", {
          p_cliente_id: clienteId,
          p_ocorrencia_id: ocorrenciaId,
          p_antes: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(itemSchema).max(20).parse(data);
      let anterior = pageParam ?? Number.POSITIVE_INFINITY;
      for (const item of pagina) {
        if (item.revisao >= anterior) throw new Error("Página divergente.");
        anterior = item.revisao;
      }
      await sessao(signal);
      return pagina;
    },
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.revisao : undefined),
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await sessao();
      if (sessionStorage.getItem(storage) !== JSON.stringify(p))
        throw new Error("Tentativa alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_declarar_atestado_grupo_mediado", {
          p_request_id: p.requestId,
          p_cliente_id: p.clienteId,
          p_ocorrencia_id: p.ocorrenciaId,
          p_expected_revision: p.revisao,
          p_declaracao: p.declaracao,
          p_referencia_evidencia: p.referencia,
        });
      if (error) throw error;
      const r = z
        .object({
          requestId: uuid,
          revisao: z.number().int().positive(),
          evidenciaAutenticada: z.literal(false),
          ocorrenciaEncerrada: z.literal(false),
        })
        .strict()
        .parse(data);
      if (r.requestId !== p.requestId || r.revisao !== p.revisao + 1)
        throw new Error("Resposta divergente.");
      await sessao();
    },
    onSuccess: async (_, p) => {
      try {
        await cache.invalidateQueries({ queryKey: key, refetchType: "none" });
        await sessao();
        if (sessionStorage.getItem(storage) !== JSON.stringify(p))
          throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(storage);
        setPendente(null);
        setConfirmacao(null);
        setAviso("Declaração registrada; ocorrência não foi encerrada.");
        void historico.refetch();
      } catch {
        setAviso("Atestado confirmado, mas tentativa local não foi removida; procure suporte.");
      }
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado ou revisão alterada. Repita a tentativa ou procure suporte para reconciliação.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  const itens = historico.data?.pages.flat() ?? [];
  const consistentes =
    new Set(itens.map((i) => i.request_id)).size === itens.length &&
    itens.every((i, n) => n === 0 || itens[n - 1]!.revisao > i.revisao);
  const disponivel =
    !!historico.data && !historico.isFetching && !historico.isError && consistentes;
  const revisao = itens[0]?.revisao ?? 0;
  const foto = disponivel
    ? JSON.stringify([
        userId,
        clienteId,
        ocorrenciaId,
        revisao,
        declaracao.trim(),
        referencia.trim(),
      ])
    : null;
  const enviar = (entrada: Pedido) => {
    if (trava.current || (!pendente && (!foto || confirmacao !== foto))) return;
    try {
      const p = pedidoSchema.parse(entrada);
      const salvo = sessionStorage.getItem(storage);
      if (pendente ? salvo !== JSON.stringify(p) : salvo !== null)
        throw new Error("Tentativa divergente.");
      if (!pendente) sessionStorage.setItem(storage, JSON.stringify(p));
      trava.current = true;
      setPendente(p);
      envio.mutate(p);
    } catch {
      setAviso("Tentativa não pôde ser guardada ou divergiu; nada enviado.");
    }
  };
  return (
    <section aria-label="Atestado declarado do Grupo">
      <h5>Atestado PCM declarado</h5>
      <p>
        Referência informada não comprova existência, origem ou conteúdo de evidência. Este registro
        não encerra ocorrência nem OS.
      </p>
      {(historico.isError || !consistentes) && (
        <p role="alert">
          Histórico indisponível ou divergente.{" "}
          <button type="button" onClick={() => void historico.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {disponivel && (
        <>
          <p>Revisão atual: {revisao}</p>
          <fieldset disabled={!!pendente || envio.isPending}>
            <label>
              Declaração{" "}
              <textarea
                value={declaracao}
                maxLength={2000}
                onChange={(e) => {
                  setDeclaracao(e.target.value);
                  setConfirmacao(null);
                }}
              />
            </label>
            <label>
              Referência de evidência declarada{" "}
              <input
                value={referencia}
                maxLength={1000}
                onChange={(e) => {
                  setReferencia(e.target.value);
                  setConfirmacao(null);
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={!!foto && confirmacao === foto}
                onChange={(e) => setConfirmacao(e.target.checked ? foto : null)}
              />{" "}
              Confirmo declaração e revisão
            </label>
            <button
              type="button"
              disabled={!foto || confirmacao !== foto || !declaracao.trim() || !referencia.trim()}
              onClick={() =>
                enviar({
                  requestId: crypto.randomUUID(),
                  clienteId,
                  ocorrenciaId,
                  revisao,
                  declaracao: declaracao.trim(),
                  referencia: referencia.trim(),
                })
              }
            >
              Registrar atestado
            </button>
          </fieldset>
          <ul>
            {itens.map((a) => (
              <li key={a.request_id}>
                Revisão {a.revisao} · OS {a.os_id} · {a.declaracao} · referência declarada:{" "}
                {a.referencia_evidencia} · {a.ator_id} · {a.criado_em}
              </li>
            ))}
          </ul>
        </>
      )}
      {historico.hasNextPage && (
        <button
          type="button"
          disabled={historico.isFetching}
          onClick={() => void historico.fetchNextPage()}
        >
          Mais histórico
        </button>
      )}
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
