import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { planoManutencaoKeys } from "../../application/plano-manutencao-queries";
type Pedido = {
  requestId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  rotinaId: string;
  revision: number;
  perguntaId: string;
  obrigatoria: boolean;
  justificativa: string;
};
const pedidoSchema = z
  .object({
    requestId: z.string().uuid(),
    clienteId: z.string().uuid(),
    planoId: z.string().uuid(),
    versaoId: z.string().uuid(),
    rotinaId: z.string().uuid(),
    revision: z.number().int().positive().safe(),
    perguntaId: z.string().trim().min(1).max(250),
    obrigatoria: z.boolean(),
    justificativa: z.string().trim().min(1).max(2000),
  })
  .strict();

export function ContratoPerguntas(props: {
  userId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  rotinaId: string;
  revision: number;
}) {
  if (import.meta.env.VITE_SSO_CONTRATO_PERGUNTA_MEDIADO_ENABLED !== "true")
    return <p>Contratos de perguntas indisponíveis.</p>;
  return (
    <Conteudo
      key={JSON.stringify([
        props.userId,
        props.clienteId,
        props.planoId,
        props.versaoId,
        props.rotinaId,
      ])}
      {...props}
    />
  );
}
function Conteudo({
  userId,
  clienteId,
  planoId,
  versaoId,
  rotinaId,
  revision,
}: {
  userId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  rotinaId: string;
  revision: number;
}) {
  const cache = useQueryClient();
  const trava = useRef(false);
  const storageKey = `sso-contrato-pergunta:${JSON.stringify([userId, clienteId, planoId, versaoId, rotinaId])}`;
  const [pergunta, setPergunta] = useState("");
  const [obrigatoria, setObrigatoria] = useState<"" | "sim" | "nao">("");
  const [justificativa, setJustificativa] = useState("");
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const p = pedidoSchema.parse(JSON.parse(raw));
      return p.clienteId === clienteId &&
        p.planoId === planoId &&
        p.versaoId === versaoId &&
        p.rotinaId === rotinaId
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const perguntas = useInfiniteQuery({
    queryKey: ["contrato-perguntas", userId, clienteId, planoId, versaoId, rotinaId],
    gcTime: 0,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_perguntas_mediado", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_versao_id: versaoId,
          p_rotina_id: rotinaId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z
        .array(
          z
            .object({
              indice: z.number().int().positive(),
              pergunta_id: z.string().min(1).max(250),
              obrigatoria: z.boolean().nullable(),
              contrato_atual: z.boolean(),
              revisao_plano: z.number().int().positive().nullable(),
            })
            .strict(),
        )
        .max(20)
        .parse(data);
      let anterior = pageParam ?? 0;
      for (const p of pagina) {
        if (p.indice <= anterior) throw new Error("Página inválida.");
        anterior = p.indice;
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.indice : undefined),
  });
  const historico = useInfiniteQuery({
    queryKey: [
      "historico-contrato-pergunta",
      userId,
      clienteId,
      planoId,
      versaoId,
      rotinaId,
      pergunta,
    ],
    enabled: !!pergunta,
    gcTime: 0,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_historico_pergunta_mediado", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_versao_id: versaoId,
          p_rotina_id: rotinaId,
          p_pergunta_id: pergunta,
          p_antes: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z
        .array(
          z
            .object({
              id: z.string().uuid(),
              revisao_plano: z.number().int().positive().safe(),
              questionario_id: z.string().uuid(),
              obrigatoria: z.boolean(),
              justificativa: z.string().min(1).max(2000),
              ator_id: z.string().uuid(),
              criado_em: z.string().min(1),
            })
            .strict(),
        )
        .max(20)
        .parse(data);
      let anterior = pageParam ?? Number.MAX_SAFE_INTEGER;
      const ids = new Set<string>();
      for (const item of pagina) {
        if (item.revisao_plano >= anterior || ids.has(item.id))
          throw new Error("Histórico inválido.");
        anterior = item.revisao_plano;
        ids.add(item.id);
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.revisao_plano : undefined),
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      if (sessionStorage.getItem(storageKey) !== JSON.stringify(p))
        throw new Error("Tentativa divergente.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_configurar_pergunta_mediada", {
          p_ator_id: userId,
          p_request_id: p.requestId,
          p_cliente_id: p.clienteId,
          p_plano_id: p.planoId,
          p_expected_revision: p.revision,
          p_versao_id: p.versaoId,
          p_rotina_id: p.rotinaId,
          p_pergunta_id: p.perguntaId,
          p_obrigatoria: p.obrigatoria,
          p_justificativa: p.justificativa,
        });
      if (error) throw error;
      const r = z
        .object({
          contratoId: z.string().uuid(),
          revision: z.number().int().positive(),
          requestId: z.string().uuid(),
        })
        .strict()
        .parse(data);
      if (r.requestId !== p.requestId || r.revision !== p.revision + 1)
        throw new Error("Recibo divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
    },
    onSuccess: async (_resultado, p) => {
      try {
        await Promise.all([
          cache.invalidateQueries({
            queryKey: ["contrato-perguntas", userId, clienteId, planoId, versaoId, rotinaId],
          }),
          cache.invalidateQueries({
            queryKey: [
              "historico-contrato-pergunta",
              userId,
              clienteId,
              planoId,
              versaoId,
              rotinaId,
            ],
          }),
          cache.invalidateQueries({ queryKey: planoManutencaoKeys.raiz(userId, clienteId) }),
        ]);
        const sessaoAtual = await supabase.auth.getUser();
        if (
          sessaoAtual.error ||
          sessaoAtual.data.user?.id !== userId ||
          sessionStorage.getItem(storageKey) !== JSON.stringify(p)
        )
          throw new Error();
        sessionStorage.removeItem(storageKey);
      } catch {
        setAviso("Registro confirmado, mas tentativa não foi removida. Procure suporte.");
        return;
      }
      setPendente(null);
      setAviso("Contrato de resposta registrado em rascunho; questionário Auvo não foi alterado.");
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado, pergunta ou revisão pode ter mudado. Repita a tentativa; procure suporte em conflito.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  const enviar = (p: Pedido, repeticao = false) => {
    if (trava.current) return;
    try {
      const salvo = sessionStorage.getItem(storageKey);
      if (repeticao ? salvo !== JSON.stringify(p) : salvo !== null) throw new Error();
      if (!repeticao) sessionStorage.setItem(storageKey, JSON.stringify(p));
    } catch {
      setAviso("Tentativa indisponível ou divergente; nada enviado.");
      return;
    }
    setPendente(p);
    trava.current = true;
    envio.mutate(p);
  };
  const itensPergunta = perguntas.data?.pages.flat() ?? [];
  const itensHistorico = historico.data?.pages.flat() ?? [];
  const divergente =
    itensPergunta.some((item, i) => i > 0 && item.indice <= itensPergunta[i - 1]!.indice) ||
    new Set(itensPergunta.map((item) => item.pergunta_id)).size !== itensPergunta.length ||
    new Set(itensHistorico.map((item) => item.id.toLowerCase())).size !== itensHistorico.length;
  const acessoConfirmado =
    !divergente &&
    !perguntas.isFetching &&
    !perguntas.isError &&
    !historico.isFetching &&
    !historico.isError;
  return (
    <section aria-label="Obrigatoriedade das perguntas">
      <h4>Obrigatoriedade de resposta</h4>
      <p>
        Definição PCM para esta Rotina e versão rascunho; não altera o questionário Auvo nem define
        exigência de foto. Consulte o questionário antes de decidir.
      </p>
      {divergente && (
        <p role="alert">
          As páginas da consulta divergiram.{" "}
          <button
            type="button"
            onClick={() => {
              void perguntas.refetch();
              void historico.refetch();
            }}
          >
            Atualizar consultas
          </button>
        </p>
      )}
      {perguntas.isError && (
        <p role="alert">
          Perguntas indisponíveis.{" "}
          <button type="button" onClick={() => void perguntas.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {acessoConfirmado && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              pendente ||
              !pergunta ||
              !obrigatoria ||
              !justificativa.trim() ||
              !acessoConfirmado ||
              !perguntas.data?.pages.flat().some((p) => p.pergunta_id === pergunta)
            )
              return;
            const p = pedidoSchema.safeParse({
              requestId: crypto.randomUUID(),
              clienteId,
              planoId,
              versaoId,
              rotinaId,
              revision,
              perguntaId: pergunta,
              obrigatoria: obrigatoria === "sim",
              justificativa: justificativa.trim(),
            });
            if (!p.success) {
              setAviso("Confira os dados e a revisão antes de enviar.");
              return;
            }
            enviar(p.data);
          }}
        >
          <fieldset
            disabled={!!pendente || envio.isPending || perguntas.isFetching || perguntas.isError}
          >
            <label>
              Pergunta{" "}
              <select required value={pergunta} onChange={(e) => setPergunta(e.target.value)}>
                <option value="">Selecione</option>
                {perguntas.data?.pages.flat().map((p) => (
                  <option key={p.indice} value={p.pergunta_id}>
                    Posição {p.indice} · {p.pergunta_id} ·{" "}
                    {p.contrato_atual
                      ? p.obrigatoria
                        ? "obrigatória"
                        : "opcional"
                      : "sem contrato atual"}
                  </option>
                ))}
              </select>
            </label>{" "}
            <label>
              Resposta exigida{" "}
              <select
                required
                value={obrigatoria}
                onChange={(e) => setObrigatoria(e.target.value as "" | "sim" | "nao")}
              >
                <option value="">Selecione</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
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
            <button type="submit">Guardar contrato na revisão {revision}</button>
          </fieldset>
        </form>
      )}
      {acessoConfirmado && perguntas.hasNextPage && (
        <button type="button" onClick={() => void perguntas.fetchNextPage()}>
          Mais perguntas
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
      {acessoConfirmado && historico.data && (
        <ul>
          {historico.data.pages.flat().map((h) => (
            <li key={h.id}>
              Revisão {h.revisao_plano} · {h.obrigatoria ? "obrigatória" : "opcional"} ·{" "}
              {h.justificativa} · {h.ator_id} · {h.criado_em}
            </li>
          ))}
        </ul>
      )}
      {acessoConfirmado && historico.hasNextPage && (
        <button type="button" onClick={() => void historico.fetchNextPage()}>
          Mais histórico
        </button>
      )}
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente, true)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}
