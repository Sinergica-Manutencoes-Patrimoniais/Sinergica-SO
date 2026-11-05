import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
type Pedido = {
  requestId: string;
  clienteId: string;
  tipo: "calendario" | "visita";
  preparadaId: string;
  revisao: number;
};
const uuid = z.string().uuid();
const pedidoSchema = z
  .object({
    requestId: uuid,
    clienteId: uuid,
    tipo: z.enum(["calendario", "visita"]),
    preparadaId: uuid,
    revisao: z.number().int().positive().safe(),
  })
  .strict();
const previaSchema = z
  .object({
    grupoId: uuid,
    revisao: z.number().int().positive().safe(),
    quantidade: z.string().regex(/^[1-9]\d*$/),
    quantidadeAprovada: z.string().regex(/^[1-9]\d*$/),
    revisaoAprovada: z.number().int().positive().safe(),
    osCriada: z.literal(false),
    filaIntegrada: z.literal(false),
  })
  .strict();

type Props = {
  userId: string;
  clienteId: string;
  planoId: string;
  tipo: "calendario" | "visita";
  preparadaId: string;
};
export function RegistrarOcorrenciaGrupo(props: Props) {
  return (
    <Conteudo
      key={JSON.stringify([
        props.userId,
        props.clienteId,
        props.planoId,
        props.tipo,
        props.preparadaId,
      ])}
      {...props}
    />
  );
}
function Conteudo({ userId, clienteId, planoId, tipo, preparadaId }: Props) {
  const chave = `registro-grupo:${JSON.stringify([userId, clienteId, planoId, tipo, preparadaId])}`;
  const cache = useQueryClient();
  const trava = useRef(false);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = pedidoSchema.parse(JSON.parse(raw));
      return p.clienteId === clienteId && p.tipo === tipo && p.preparadaId === preparadaId
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  async function sessao(signal?: AbortSignal) {
    const r = await supabase.auth.getUser();
    if (r.error || r.data.user?.id !== userId || signal?.aborted)
      throw new Error("Sessão alterada.");
  }
  const previa = useQuery({
    queryKey: ["previa-grupo-ocorrencia", userId, clienteId, tipo, preparadaId],
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      await sessao(signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_previa_registro_grupo_mediada", {
          p_cliente_id: clienteId,
          p_tipo: tipo,
          p_preparada_id: preparadaId,
        })
        .abortSignal(signal);
      if (error) throw error;
      const resultado = previaSchema.parse(data);
      await sessao(signal);
      return resultado;
    },
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await sessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_registrar_ocorrencia_grupo_mediada", {
          p_request_id: p.requestId,
          p_cliente_id: p.clienteId,
          p_tipo: p.tipo,
          p_preparada_id: p.preparadaId,
          p_expected_revision: p.revisao,
        });
      if (error) throw error;
      const r = z
        .object({
          requestId: uuid,
          ocorrenciaGrupoId: uuid,
          osCriada: z.literal(false),
          filaIntegrada: z.literal(false),
        })
        .strict()
        .parse(data);
      if (r.requestId !== p.requestId) throw new Error("Resposta inválida.");
      await sessao();
    },
    onSuccess: async (_, p) => {
      try {
        await cache.invalidateQueries({
          queryKey: ["obrigacoes-preparadas", userId, clienteId, planoId],
          refetchType: "none",
        });
        await sessao();
        if (sessionStorage.getItem(chave) !== JSON.stringify(p))
          throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(chave);
        setPendente(null);
        setConfirmacao(null);
        setAviso("Identidade registrada; nenhuma OS ou tarefa foi criada.");
        void cache.refetchQueries({
          queryKey: ["obrigacoes-preparadas", userId, clienteId, planoId],
          type: "active",
        });
      } catch {
        setAviso("Registro confirmado, mas tentativa local não foi removida; procure suporte.");
      }
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado ou revisão alterada. Repita a mesma tentativa; se persistir, reconcilie antes de novo registro.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  const atual = !previa.isFetching && !previa.isError ? previa.data : undefined;
  const foto = atual
    ? JSON.stringify([userId, clienteId, planoId, tipo, preparadaId, atual])
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
    <section aria-label="Registro de ocorrência do Grupo">
      <p>
        Registra identidade do Grupo para esta ocorrência preparada; não cria OS, fila ou tarefa
        Auvo.
      </p>
      {previa.isError && (
        <p role="alert">
          Prévia indisponível.{" "}
          <button type="button" onClick={() => void previa.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {atual && (
        <>
          <p>
            Grupo {atual.grupoId} · cadastro atual: revisão {atual.revisao}, quantidade{" "}
            {atual.quantidade} · Plano aprovado: revisão {atual.revisaoAprovada}, quantidade{" "}
            {atual.quantidadeAprovada}.
          </p>
          <label>
            <input
              type="checkbox"
              checked={!!foto && confirmacao === foto}
              disabled={!!pendente || previa.isFetching}
              onChange={(e) => setConfirmacao(e.target.checked ? foto : null)}
            />{" "}
            Confirmo o Grupo, o cadastro atual e a quantidade aprovada
          </label>
          <button
            type="button"
            disabled={
              !foto || confirmacao !== foto || !!pendente || envio.isPending || previa.isFetching
            }
            onClick={() =>
              enviar({
                requestId: crypto.randomUUID(),
                clienteId,
                tipo,
                preparadaId,
                revisao: atual.revisao,
              })
            }
          >
            Registrar identidade
          </button>
        </>
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
