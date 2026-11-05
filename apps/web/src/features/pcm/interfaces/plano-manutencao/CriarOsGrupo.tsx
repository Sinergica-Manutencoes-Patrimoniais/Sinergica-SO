import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedidoSchema = z
  .object({
    requestId: z.string().uuid(),
    clienteId: z.string().uuid(),
    intencaoId: z.string().uuid(),
  })
  .strict();
const respostaSchema = z
  .object({
    requestId: z.string().uuid(),
    intencaoId: z.string().uuid(),
    ocorrenciaId: z.string().uuid(),
    osId: z.string().uuid(),
    osCriada: z.literal(true),
    tarefaCriada: z.literal(false),
  })
  .strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = {
  userId: string;
  clienteId: string;
  ocorrenciaId: string;
  intencaoId: string;
  disponivel: boolean;
};

export function CriarOsGrupo(props: Props) {
  return (
    <Conteudo
      key={JSON.stringify([props.userId, props.clienteId, props.ocorrenciaId, props.intencaoId])}
      {...props}
    />
  );
}

function Conteudo({ userId, clienteId, ocorrenciaId, intencaoId, disponivel }: Props) {
  const cache = useQueryClient();
  const chave = `criar-os-grupo:${JSON.stringify([userId, clienteId, ocorrenciaId, intencaoId])}`;
  const trava = useRef(false);
  const [confirmado, setConfirmado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const pedido = pedidoSchema.parse(JSON.parse(raw));
      return pedido.clienteId === clienteId && pedido.intencaoId === intencaoId
        ? pedido
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const envio = useMutation({
    mutationFn: async (pedido: Pedido) => {
      const sessao = await supabase.auth.getUser();
      if (
        sessao.error ||
        sessao.data.user?.id !== userId ||
        sessionStorage.getItem(chave) !== JSON.stringify(pedido)
      )
        throw new Error("Sessão ou tentativa alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_criar_os_grupo", {
        p_request_id: pedido.requestId,
        p_cliente_id: pedido.clienteId,
        p_intencao_id: pedido.intencaoId,
      });
      if (error) throw error;
      const resposta = respostaSchema.parse(data);
      if (
        resposta.requestId !== pedido.requestId ||
        resposta.intencaoId !== intencaoId ||
        resposta.ocorrenciaId !== ocorrenciaId
      )
        throw new Error("Resposta divergente.");
      const atual = await supabase.auth.getUser();
      if (atual.error || atual.data.user?.id !== userId) throw new Error("Sessão alterada.");
      return resposta;
    },
    onSuccess: async (resposta, pedido) => {
      if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) {
        setAviso("Resposta recebida, mas a tentativa local mudou; procure suporte.");
        return;
      }
      sessionStorage.removeItem(chave);
      setPendente(null);
      setConfirmado(false);
      setAviso(`OS ${resposta.osId} criada e vinculada. Nenhuma tarefa Auvo foi criada.`);
      await cache.invalidateQueries({
        queryKey: ["intencao-os-grupo", userId, clienteId, ocorrenciaId],
      });
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado. Repita a mesma tentativa para verificar, sem criar outra solicitação.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  function enviar(pedido: Pedido) {
    if (trava.current || (!pendente && (!disponivel || !confirmado))) return;
    try {
      const salvo = sessionStorage.getItem(chave);
      if (pendente ? salvo !== JSON.stringify(pedido) : salvo !== null)
        throw new Error("Tentativa divergente.");
      if (!pendente) sessionStorage.setItem(chave, JSON.stringify(pedido));
      trava.current = true;
      setPendente(pedido);
      envio.mutate(pedido);
    } catch {
      setAviso("Não foi possível preservar a tentativa; nada foi enviado.");
    }
  }
  return (
    <section aria-label="Criar OS preventiva para Grupo">
      <h5>Criar OS preventiva</h5>
      {disponivel && !pendente && (
        <>
          <label>
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />{" "}
            Confirmo a criação de uma OS para esta intenção
          </label>
          <button
            type="button"
            disabled={!confirmado || envio.isPending}
            onClick={() => enviar({ requestId: crypto.randomUUID(), clienteId, intencaoId })}
          >
            Criar OS
          </button>
        </>
      )}
      {pendente === "invalido" && (
        <p role="alert">Tentativa local ilegível. Procure suporte antes de criar outra OS.</p>
      )}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}
