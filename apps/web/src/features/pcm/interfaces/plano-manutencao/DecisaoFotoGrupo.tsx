import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { useFotosGrupo } from "./useFotosGrupo";

const uuid = z.string().uuid();
const pedidoSchema = z
  .object({
    requestId: uuid,
    clienteId: uuid,
    ocorrenciaId: uuid,
    fotoId: uuid,
    revisao: z.number().int().nonnegative(),
    decisao: z.enum(["aceita_pcm", "rejeitada_pcm"]),
    motivo: z.string().trim().min(1).max(2000),
  })
  .strict();
type Pedido = z.infer<typeof pedidoSchema>;
const itemSchema = z
  .object({
    request_id: uuid,
    foto_id: uuid,
    revisao: z.number().int().positive(),
    decisao: z.enum(["aceita_pcm", "rejeitada_pcm"]),
    motivo: z.string(),
    ator_id: uuid,
    criado_em: z.string(),
  })
  .strict();
type Props = { userId: string; clienteId: string; ocorrenciaId: string };
export function DecisaoFotoGrupo(props: Props) {
  return (
    <Conteudo
      key={JSON.stringify([props.userId, props.clienteId, props.ocorrenciaId])}
      {...props}
    />
  );
}
function Conteudo({ userId, clienteId, ocorrenciaId }: Props) {
  const cache = useQueryClient();
  const chave = `decisao-foto-grupo:${JSON.stringify([userId, clienteId, ocorrenciaId])}`;
  const key = ["decisoes-foto-grupo", userId, clienteId, ocorrenciaId];
  const trava = useRef(false);
  const [fotoId, setFotoId] = useState("");
  const [decisao, setDecisao] = useState<Pedido["decisao"]>("aceita_pcm");
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
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
  const fotos = useFotosGrupo(userId, clienteId, ocorrenciaId);
  const historico = useInfiniteQuery({
    queryKey: key,
    gcTime: 0,
    retry: false,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      await sessao(signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_decisoes_foto_grupo_mediada", {
          p_cliente_id: clienteId,
          p_ocorrencia_id: ocorrenciaId,
          p_antes: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(itemSchema).max(20).parse(data);
      let anterior = pageParam ?? Number.POSITIVE_INFINITY;
      for (const i of pagina) {
        if (i.revisao >= anterior) throw new Error("Página divergente.");
        anterior = i.revisao;
      }
      await sessao(signal);
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.revisao : undefined),
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await sessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_decidir_foto_grupo_mediada", {
        p_request_id: p.requestId,
        p_cliente_id: p.clienteId,
        p_ocorrencia_id: p.ocorrenciaId,
        p_foto_id: p.fotoId,
        p_expected_revision: p.revisao,
        p_decisao: p.decisao,
        p_motivo: p.motivo,
      });
      if (error) throw error;
      const r = z
        .object({
          requestId: uuid,
          revisao: z.number().int().positive(),
          conteudoAutenticado: z.literal(false),
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
        if (sessionStorage.getItem(chave) !== JSON.stringify(p))
          throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(chave);
        setPendente(null);
        setConfirmacao(null);
        setAviso("Decisão registrada. Ocorrência não encerrada.");
        void historico.refetch();
      } catch {
        setAviso("Decisão confirmada, mas tentativa não removida; procure suporte.");
      }
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado, foto indisponível ou revisão alterada. Repita a tentativa ou procure suporte.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  const listaFotos = fotos.data?.pages.flat() ?? [];
  const decisoes = historico.data?.pages.flat() ?? [];
  const descendente = (itens: { revisao: number }[]) =>
    itens.every((i, n) => n === 0 || itens[n - 1]!.revisao > i.revisao);
  const consistentes =
    descendente(listaFotos) &&
    descendente(decisoes) &&
    new Set(listaFotos.map((i) => i.id)).size === listaFotos.length &&
    new Set(decisoes.map((i) => i.request_id)).size === decisoes.length;
  const disponivel =
    !!fotos.data &&
    !!historico.data &&
    !fotos.isFetching &&
    !historico.isFetching &&
    !fotos.isError &&
    !historico.isError &&
    consistentes;
  const revisao = decisoes[0]?.revisao ?? 0;
  const selecionada = listaFotos.find((f) => f.id === fotoId);
  const foto =
    disponivel && selecionada
      ? JSON.stringify([
          userId,
          clienteId,
          ocorrenciaId,
          selecionada,
          revisao,
          decisao,
          motivo.trim(),
        ])
      : null;
  const enviar = (entrada: Pedido) => {
    if (trava.current || (!pendente && (!foto || confirmacao !== foto))) return;
    try {
      const p = pedidoSchema.parse(entrada);
      const salvo = sessionStorage.getItem(chave);
      if (pendente ? salvo !== JSON.stringify(p) : salvo !== null)
        throw new Error("Tentativa divergente.");
      if (!pendente) sessionStorage.setItem(chave, JSON.stringify(p));
      trava.current = true;
      setPendente(p);
      envio.mutate(p);
    } catch {
      setAviso("Tentativa não pôde ser guardada ou divergiu; nada enviado.");
    }
  };
  return (
    <section aria-label="Decisão PCM da foto do Grupo">
      <h5>Decisão sobre foto</h5>
      <p>Aceitar ou rejeitar não autentica conteúdo ou autoria e não encerra a ocorrência.</p>
      {(fotos.isError || historico.isError || !consistentes) && (
        <p role="alert">
          Fotos ou histórico indisponíveis ou divergentes.{" "}
          <button
            type="button"
            onClick={() => {
              void fotos.refetch();
              void historico.refetch();
            }}
          >
            Reconsultar
          </button>
        </p>
      )}
      <fieldset disabled={!disponivel || !!pendente || envio.isPending}>
        <label>
          Foto{" "}
          <select
            value={fotoId}
            onChange={(e) => {
              setFotoId(e.target.value);
              setConfirmacao(null);
            }}
          >
            <option value="">Selecione</option>
            {listaFotos.map((f) => (
              <option key={f.id} value={f.id}>
                Revisão {f.revisao} · nota {f.nota_id} · {f.criado_em}
              </option>
            ))}
          </select>
        </label>
        <label>
          Decisão{" "}
          <select
            value={decisao}
            onChange={(e) => {
              setDecisao(e.target.value as Pedido["decisao"]);
              setConfirmacao(null);
            }}
          >
            <option value="aceita_pcm">Aceita pelo PCM</option>
            <option value="rejeitada_pcm">Rejeitada pelo PCM</option>
          </select>
        </label>
        <label>
          Motivo{" "}
          <textarea
            maxLength={2000}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setConfirmacao(null);
            }}
          />
        </label>
        <p>Revisão atual: {revisao}</p>
        <label>
          <input
            type="checkbox"
            checked={!!foto && confirmacao === foto}
            onChange={(e) => setConfirmacao(e.target.checked ? foto : null)}
          />{" "}
          Confirmo decisão e revisão
        </label>
        <button
          type="button"
          disabled={!foto || confirmacao !== foto || !motivo.trim()}
          onClick={() =>
            enviar({
              requestId: crypto.randomUUID(),
              clienteId,
              ocorrenciaId,
              fotoId,
              revisao,
              decisao,
              motivo: motivo.trim(),
            })
          }
        >
          Registrar decisão
        </button>
      </fieldset>
      {fotos.hasNextPage && (
        <button
          type="button"
          disabled={fotos.isFetching}
          onClick={() => void fotos.fetchNextPage()}
        >
          Mais fotos
        </button>
      )}
      {disponivel && (
        <ul>
          {decisoes.map((d) => (
            <li key={d.request_id}>
              Revisão {d.revisao} · foto {d.foto_id} · {d.decisao} · {d.motivo} · {d.ator_id} ·{" "}
              {d.criado_em}
            </li>
          ))}
        </ul>
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
