import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
type Pedido = {
  versao: 2;
  osId: string;
  requestId: string;
  clienteId: string;
  retornoId: string;
  atestacaoId: string;
  decisaoRevision: number;
  status: string;
  updatedAt: string;
};
type PedidoLegado = Omit<Pedido, "versao" | "osId">;
const respostaFinalizacao = z
  .object({
    retornoId: z.string().uuid(),
    osId: z.string().uuid(),
    status: z.literal("finalizado"),
    chamadoAlterado: z.literal(false),
    requestId: z.string().uuid(),
  })
  .strict();

export function FinalizarOsValidada(props: Parameters<typeof Conteudo>[0]) {
  return (
    <Conteudo
      key={JSON.stringify([props.userId, props.clienteId, props.retornoId, props.atestacaoId])}
      {...props}
    />
  );
}
function Conteudo({
  userId,
  clienteId,
  retornoId,
  atestacaoId,
  decisaoRevision,
}: {
  userId: string;
  clienteId: string;
  retornoId: string;
  atestacaoId: string;
  decisaoRevision: number;
}) {
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const cache = useQueryClient();
  const storageKey = `sso-finalizacao-os:${JSON.stringify([userId, clienteId, retornoId, atestacaoId])}`;
  const trava = useRef(false);
  async function conferirSessao() {
    const r = await supabase.auth.getUser();
    if (r.error || r.data.user?.id !== userId) throw new Error("Sessão alterada.");
  }
  const [assinaturaConfirmada, setAssinaturaConfirmada] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<
    Pedido | { tipo: "legado"; dados: PedidoLegado } | "invalido" | null
  >(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const p = JSON.parse(raw) as Pedido;
      const baseValida =
        p.clienteId === clienteId &&
        p.retornoId === retornoId &&
        p.atestacaoId === atestacaoId &&
        typeof p.requestId === "string" &&
        Number.isSafeInteger(p.decisaoRevision) &&
        typeof p.status === "string" &&
        typeof p.updatedAt === "string";
      if (!baseValida) return "invalido";
      if (p.versao === undefined && p.osId === undefined) return { tipo: "legado", dados: p };
      return p.versao === 2 && z.string().uuid().safeParse(p.osId).success ? p : "invalido";
    } catch {
      return "invalido";
    }
  });
  const previa = useQuery({
    queryKey: ["retorno-previa-finalizacao-os", userId, clienteId, retornoId],
    gcTime: 0,
    queryFn: async ({ signal }) => {
      await conferirSessao();
      if (!montado.current) throw new Error("Tela desmontada.");
      if (signal.aborted) throw new Error("Cancelado.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_mediar_previa_finalizacao_os", {
          p_cliente_id: clienteId,
          p_retorno_id: retornoId,
        })
        .abortSignal(signal);
      if (error) throw error;
      const r = z
        .object({
          osId: z.string().uuid(),
          status: z.string().min(1),
          updatedAt: z.string().datetime({ offset: true }).nullable(),
          chamadoAlterado: z.literal(false),
          notificacaoLegadaPossivel: z.literal(true),
        })
        .strict()
        .parse(data);
      await conferirSessao();
      if (!montado.current) throw new Error("Tela desmontada.");
      if (signal.aborted) throw new Error("Cancelado.");
      return r;
    },
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessao();
      if (!montado.current) throw new Error("Tela desmontada.");
      if (sessionStorage.getItem(storageKey) !== JSON.stringify(p))
        throw new Error("Tentativa alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_mediar_finalizacao_os", {
          p_request_id: p.requestId,
          p_cliente_id: p.clienteId,
          p_retorno_id: p.retornoId,
          p_expected_os_id: p.osId,
          p_atestacao_request_id: p.atestacaoId,
          p_expected_decisao: p.decisaoRevision,
          p_expected_status: p.status,
          p_expected_updated_at: p.updatedAt,
        });
      if (error) throw error;
      const r = respostaFinalizacao.parse(data);
      if (
        r.requestId.toLowerCase() !== p.requestId.toLowerCase() ||
        r.retornoId.toLowerCase() !== p.retornoId.toLowerCase() ||
        r.osId.toLowerCase() !== p.osId.toLowerCase()
      )
        throw new Error("Resposta não corresponde ao pedido.");
      await conferirSessao();
      if (!montado.current) throw new Error("Tela desmontada.");
    },
    onSuccess: async (_, pedido) => {
      try {
        await cache.invalidateQueries({
          queryKey: ["retorno-previa-finalizacao-os", userId, clienteId, retornoId],
        });
        await conferirSessao();
        if (!montado.current) throw new Error("Tela desmontada.");
        if (sessionStorage.getItem(storageKey) !== JSON.stringify(pedido))
          throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(storageKey);
        setPendente(null);
        setAssinaturaConfirmada(null);
        setAviso(
          "OS finalizada no legado; Chamado não foi alterado. Evento legado pode gerar notificação no Portal.",
        );
      } catch {
        setAviso(
          "Resultado confirmado, mas a tentativa local não pôde ser removida; procure suporte.",
        );
      }
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado ou requisitos mudaram. Repita a mesma tentativa; procure suporte em conflito.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  const enviar = (p: Pedido, repetir = false) => {
    if (trava.current) return;
    try {
      const salva = sessionStorage.getItem(storageKey);
      if ((repetir && salva !== JSON.stringify(p)) || (!repetir && salva !== null))
        throw new Error("Tentativa divergente.");
      if (!repetir) sessionStorage.setItem(storageKey, JSON.stringify(p));
    } catch {
      setAviso("Não foi possível conferir ou guardar tentativa; nada enviado.");
      return;
    }
    setPendente(p);
    trava.current = true;
    envio.mutate(p);
  };
  const consultaLegada = useMutation({
    mutationFn: async (p: PedidoLegado) => {
      await conferirSessao();
      if (!montado.current) throw new Error("Tela desmontada.");
      if (sessionStorage.getItem(storageKey) !== JSON.stringify(p))
        throw new Error("Tentativa alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_mediar_consulta_finalizacao_os", {
          p_request_id: p.requestId,
          p_cliente_id: p.clienteId,
          p_retorno_id: p.retornoId,
          p_atestacao_request_id: p.atestacaoId,
          p_expected_decisao: p.decisaoRevision,
          p_expected_status: p.status,
          p_expected_updated_at: p.updatedAt,
        });
      if (error) throw error;
      const resposta = z
        .discriminatedUnion("situacao", [
          z
            .object({ situacao: z.literal("nao_localizada"), requestId: z.string().uuid() })
            .strict(),
          z
            .object({
              situacao: z.literal("encontrada"),
              requestId: z.string().uuid(),
              resultado: respostaFinalizacao,
            })
            .strict(),
        ])
        .parse(data);
      if (resposta.requestId.toLowerCase() !== p.requestId.toLowerCase())
        throw new Error("Consulta divergente.");
      if (
        resposta.situacao === "encontrada" &&
        (resposta.resultado.requestId.toLowerCase() !== p.requestId.toLowerCase() ||
          resposta.resultado.retornoId.toLowerCase() !== p.retornoId.toLowerCase())
      )
        throw new Error("Resultado divergente.");
      await conferirSessao();
      if (!montado.current) throw new Error("Tela desmontada.");
      return resposta;
    },
    onSuccess: async (resposta, pedido) => {
      if (resposta.situacao === "nao_localizada") {
        setAviso("Tentativa não localizada; ausência não autoriza nova escrita. Procure suporte.");
        return;
      }
      try {
        await conferirSessao();
        if (!montado.current) throw new Error("Tela desmontada.");
        if (sessionStorage.getItem(storageKey) !== JSON.stringify(pedido)) {
          setAviso("Resultado localizado, mas a tentativa local mudou; procure suporte.");
          return;
        }
        sessionStorage.removeItem(storageKey);
      } catch {
        setAviso(
          "Resultado localizado, mas tentativa local não pôde ser removida; procure suporte.",
        );
        return;
      }
      setPendente(null);
      setAviso(
        `Resultado anterior confirmado para OS ${resposta.resultado.osId}; Chamado não foi alterado.`,
      );
      await cache.invalidateQueries({
        queryKey: ["retorno-previa-finalizacao-os", userId, clienteId, retornoId],
      });
    },
    onError: () =>
      setAviso(
        "Não foi possível reconciliar a tentativa antiga; ela permanece guardada. Procure suporte.",
      ),
  });
  const assinatura = previa.data?.updatedAt
    ? JSON.stringify([
        clienteId,
        retornoId,
        atestacaoId,
        decisaoRevision,
        previa.data.osId,
        previa.data.status,
        previa.data.updatedAt,
      ])
    : null;
  const confirmado = assinatura !== null && assinatura === assinaturaConfirmada;
  return (
    <section aria-label="Finalização individual da OS">
      <p>
        Preparado para revisão: não usar antes da homologação. Finalizar altera o status legado e
        pode gerar notificação no Portal; não altera Chamado nem chama Auvo explicitamente.
      </p>
      {previa.isError && (
        <p role="alert">
          Prévia indisponível.{" "}
          <button type="button" onClick={() => void previa.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {previa.data && !previa.isFetching && !previa.isError && (
        <p>
          OS {previa.data.osId} · status {previa.data.status} · atualização{" "}
          {previa.data.updatedAt ?? "indisponível"} · decisão {decisaoRevision}.
        </p>
      )}
      <label>
        <input
          type="checkbox"
          checked={confirmado}
          disabled={!!pendente || !previa.data?.updatedAt || previa.isFetching || previa.isError}
          onChange={(e) => setAssinaturaConfirmada(e.target.checked ? assinatura : null)}
        />{" "}
        Confirmo a finalização individual e o possível efeito de notificação
      </label>{" "}
      <button
        type="button"
        disabled={
          !confirmado ||
          !!pendente ||
          envio.isPending ||
          !previa.data?.updatedAt ||
          previa.isFetching ||
          previa.isError
        }
        onClick={() => {
          if (previa.data?.updatedAt)
            enviar({
              versao: 2,
              osId: previa.data.osId,
              requestId: crypto.randomUUID(),
              clienteId,
              retornoId,
              atestacaoId,
              decisaoRevision,
              status: previa.data.status,
              updatedAt: previa.data.updatedAt,
            });
        }}
      >
        Finalizar OS individual
      </button>
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && "tipo" in pendente && (
        <>
          <p role="alert">Tentativa antiga preservada; consulte reconciliação antes de repetir.</p>
          <button
            type="button"
            disabled={consultaLegada.isPending}
            onClick={() => consultaLegada.mutate(pendente.dados)}
          >
            Consultar resultado anterior
          </button>
        </>
      )}
      {pendente && pendente !== "invalido" && !("tipo" in pendente) && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente, true)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}
