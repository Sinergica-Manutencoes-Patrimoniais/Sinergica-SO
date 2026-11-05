import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const inteiro = z.string().regex(/^(0|[1-9][0-9]{0,15})$/);
const pedidoSchema = z
  .object({
    requestId: uuid,
    clienteId: uuid,
    ocorrenciaId: uuid,
    atestadoId: uuid,
    revisao: z.number().int().nonnegative(),
    quantidade: inteiro,
    motivo: z.string().trim().min(1).max(2000),
  })
  .strict();
type Pedido = z.infer<typeof pedidoSchema>;
const atestadoSchema = z
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
const quantidadeSchema = z
  .object({
    request_id: uuid,
    os_id: uuid,
    atestado_request_id: uuid,
    revisao: z.number().int().positive(),
    quantidade_declarada: inteiro,
    quantidade_snapshot: z.string().regex(/^(0|[1-9][0-9]{0,18})$/),
    motivo: z.string(),
    ator_id: uuid,
    criado_em: z.string(),
  })
  .strict();
type Props = { userId: string; clienteId: string; ocorrenciaId: string };
export function QuantidadeGrupo(props: Props) {
  return (
    <Conteudo
      key={JSON.stringify([props.userId, props.clienteId, props.ocorrenciaId])}
      {...props}
    />
  );
}
function Conteudo({ userId, clienteId, ocorrenciaId }: Props) {
  const cache = useQueryClient();
  const key = ["quantidades-grupo", userId, clienteId, ocorrenciaId];
  const storage = `quantidade-grupo:${JSON.stringify([userId, clienteId, ocorrenciaId])}`;
  const trava = useRef(false);
  const [atestado, setAtestado] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
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
  function conferirOrdem<T extends { revisao: number }>(pagina: T[], antes: number | null) {
    let anterior = antes ?? Number.POSITIVE_INFINITY;
    for (const item of pagina) {
      if (item.revisao >= anterior) throw new Error("Página divergente.");
      anterior = item.revisao;
    }
    return pagina;
  }
  const atestados = useInfiniteQuery({
    queryKey: ["atestados-grupo", userId, clienteId, ocorrenciaId],
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
      const pagina = conferirOrdem(z.array(atestadoSchema).max(20).parse(data), pageParam);
      await sessao(signal);
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.revisao : undefined),
  });
  const historico = useInfiniteQuery({
    queryKey: key,
    initialPageParam: null as number | null,
    gcTime: 0,
    retry: false,
    queryFn: async ({ pageParam, signal }) => {
      await sessao(signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_quantidades_grupo_mediada", {
          p_cliente_id: clienteId,
          p_ocorrencia_id: ocorrenciaId,
          p_antes: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = conferirOrdem(z.array(quantidadeSchema).max(20).parse(data), pageParam);
      await sessao(signal);
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.revisao : undefined),
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await sessao();
      if (sessionStorage.getItem(storage) !== JSON.stringify(p))
        throw new Error("Tentativa alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_declarar_quantidade_grupo_mediada", {
          p_request_id: p.requestId,
          p_cliente_id: p.clienteId,
          p_ocorrencia_id: p.ocorrenciaId,
          p_atestado_id: p.atestadoId,
          p_expected_revision: p.revisao,
          p_quantidade: p.quantidade,
          p_motivo: p.motivo,
        });
      if (error) throw error;
      const r = z
        .object({
          requestId: uuid,
          revisao: z.number().int().positive(),
          quantidade: inteiro,
          execucaoComprovada: z.literal(false),
          ocorrenciaEncerrada: z.literal(false),
        })
        .strict()
        .parse(data);
      if (
        r.requestId !== p.requestId ||
        r.revisao !== p.revisao + 1 ||
        r.quantidade !== p.quantidade
      )
        throw new Error("Resposta inválida.");
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
        setAviso("Quantidade declarada; execução e encerramento não foram comprovados.");
        void historico.refetch();
      } catch {
        setAviso("Declaração confirmada, mas tentativa local não foi removida; procure suporte.");
      }
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado, revisão alterada ou quantidade inválida. Repita a tentativa ou procure suporte.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  const listaAtestados = atestados.data?.pages.flat() ?? [];
  const listaHistorico = historico.data?.pages.flat() ?? [];
  const ordemValida = (itens: { revisao: number; request_id: string }[]) =>
    itens.every((item, i) => i === 0 || itens[i - 1]!.revisao > item.revisao) &&
    new Set(itens.map((item) => item.request_id)).size === itens.length;
  const disponivel =
    !!atestados.data &&
    !!historico.data &&
    !atestados.isFetching &&
    !historico.isFetching &&
    !atestados.isError &&
    !historico.isError &&
    ordemValida(listaAtestados) &&
    ordemValida(listaHistorico);
  const revisao = listaHistorico[0]?.revisao ?? 0;
  const selecionado = listaAtestados.find((a) => a.request_id === atestado);
  const foto =
    disponivel && selecionado
      ? JSON.stringify([
          userId,
          clienteId,
          ocorrenciaId,
          selecionado,
          revisao,
          quantidade,
          motivo.trim(),
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
    <section aria-label="Quantidade declarada do Grupo">
      <h5>Quantidade declarada pelo PCM</h5>
      <p>
        Declaração parcial ou integral não comprova execução. Revisões substituem a anterior; não
        devem ser somadas. Não encerra ocorrência ou OS.
      </p>
      {(!ordemValida(listaAtestados) ||
        !ordemValida(listaHistorico) ||
        historico.isError ||
        atestados.isError) && (
        <p role="alert">
          Atestados ou histórico indisponíveis ou divergentes.{" "}
          <button
            type="button"
            onClick={() => {
              void atestados.refetch();
              void historico.refetch();
            }}
          >
            Reconsultar
          </button>
        </p>
      )}
      <fieldset disabled={!disponivel || !!pendente || envio.isPending}>
        <label>
          Atestado{" "}
          <select
            value={atestado}
            onChange={(e) => {
              setAtestado(e.target.value);
              setConfirmacao(null);
            }}
          >
            <option value="">Selecione</option>
            {listaAtestados.map((a) => (
              <option key={a.request_id} value={a.request_id}>
                Revisão {a.revisao} · OS {a.os_id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantidade inteira{" "}
          <input
            inputMode="numeric"
            value={quantidade}
            onChange={(e) => {
              setQuantidade(e.target.value);
              setConfirmacao(null);
            }}
          />
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
          Confirmo quantidade e revisão
        </label>
        <button
          type="button"
          disabled={
            !foto ||
            confirmacao !== foto ||
            !inteiro.safeParse(quantidade).success ||
            !motivo.trim()
          }
          onClick={() =>
            enviar({
              requestId: crypto.randomUUID(),
              clienteId,
              ocorrenciaId,
              atestadoId: atestado,
              revisao,
              quantidade,
              motivo: motivo.trim(),
            })
          }
        >
          Registrar quantidade
        </button>
      </fieldset>
      {atestados.hasNextPage && (
        <button
          type="button"
          disabled={atestados.isFetching}
          onClick={() => void atestados.fetchNextPage()}
        >
          Mais atestados
        </button>
      )}
      {disponivel && (
        <ul>
          {listaHistorico.map((q) => (
            <li key={q.request_id}>
              Revisão {q.revisao} · OS {q.os_id} · declarado {q.quantidade_declarada} de{" "}
              {q.quantidade_snapshot} históricas · {q.motivo} · {q.ator_id} · {q.criado_em}
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
      {aviso && <output className="block">{aviso}</output>}
    </section>
  );
}
