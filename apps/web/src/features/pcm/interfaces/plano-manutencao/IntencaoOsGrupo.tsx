import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { CriarOsGrupo } from "./CriarOsGrupo";

const uuid = z.string().uuid();
const pedidoSchema = z
  .object({
    requestId: uuid,
    clienteId: uuid,
    ocorrenciaId: uuid,
    tipo: z.enum(["intencao", "decisao"]),
    titulo: z.string().max(200),
    motivo: z.string().trim().min(1).max(2000),
    intencaoId: z.string(),
    osId: z.string(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (
      p.tipo === "intencao"
        ? !p.titulo.trim() || !!p.intencaoId || !!p.osId
        : !uuid.safeParse(p.intencaoId).success || !uuid.safeParse(p.osId).success
    )
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tentativa inválida." });
  });
type Pedido = z.infer<typeof pedidoSchema>;
const estadoSchema = z
  .object({
    intencao: z
      .object({
        id: uuid,
        titulo: z.string(),
        motivo: z.string(),
        grupoRevisao: z.number(),
        quantidade: z.string(),
        criadoEm: z.string(),
      })
      .strict()
      .nullable(),
    decisao: z
      .object({ requestId: uuid, osId: uuid, motivo: z.string(), criadoEm: z.string() })
      .strict()
      .nullable(),
    vinculo: z.object({ requestId: uuid, osId: uuid, criadoEm: z.string() }).strict().nullable(),
    execucaoAutorizada: z.literal(false),
    osCriada: z.literal(false),
  })
  .strict();
type Props = { userId: string; clienteId: string; ocorrenciaId: string };
export function IntencaoOsGrupo(props: Props) {
  return (
    <Conteudo
      key={JSON.stringify([props.userId, props.clienteId, props.ocorrenciaId])}
      {...props}
    />
  );
}
function Conteudo({ userId, clienteId, ocorrenciaId }: Props) {
  const cache = useQueryClient();
  const queryKey = ["intencao-os-grupo", userId, clienteId, ocorrenciaId];
  const chave = `intencao-grupo:${JSON.stringify([userId, clienteId, ocorrenciaId])}`;
  const trava = useRef(false);
  const [titulo, setTitulo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [osId, setOsId] = useState("");
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
  const consulta = useQuery({
    queryKey,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      await sessao(signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_consultar_intencao_grupo_mediada", {
          p_cliente_id: clienteId,
          p_ocorrencia_id: ocorrenciaId,
        })
        .abortSignal(signal);
      if (error) throw error;
      const estado = estadoSchema.parse(data);
      await sessao(signal);
      return estado;
    },
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await sessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa alterada.");
      const result =
        p.tipo === "intencao"
          ? await supabase
              .schema("pcm")
              .rpc("sso_preparar_intencao_grupo_mediada", {
                p_request_id: p.requestId,
                p_cliente_id: p.clienteId,
                p_ocorrencia_id: p.ocorrenciaId,
                p_titulo: p.titulo,
                p_motivo: p.motivo,
              })
          : await supabase
              .schema("pcm")
              .rpc("sso_decidir_intencao_grupo_mediada", {
                p_request_id: p.requestId,
                p_cliente_id: p.clienteId,
                p_ocorrencia_id: p.ocorrenciaId,
                p_intencao_id: p.intencaoId,
                p_os_id: p.osId,
                p_motivo: p.motivo,
              });
      if (result.error) throw result.error;
      const resposta =
        p.tipo === "intencao"
          ? z
              .object({
                requestId: uuid,
                intencaoId: uuid,
                osCriada: z.literal(false),
                tarefaCriada: z.literal(false),
                execucaoAutorizada: z.literal(false),
              })
              .strict()
              .parse(result.data)
          : z
              .object({
                requestId: uuid,
                decisaoRegistrada: z.literal(true),
                vinculoCriado: z.literal(false),
                osAlterada: z.literal(false),
              })
              .strict()
              .parse(result.data);
      if (resposta.requestId !== p.requestId) throw new Error("Resposta inválida.");
      await sessao();
    },
    onSuccess: async (_, p) => {
      try {
        await cache.invalidateQueries({ queryKey, refetchType: "none" });
        await sessao();
        if (sessionStorage.getItem(chave) !== JSON.stringify(p))
          throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(chave);
        setPendente(null);
        setConfirmacao(null);
        setAviso("Registro realizado; nenhuma OS ou tarefa foi criada.");
        void consulta.refetch();
      } catch {
        setAviso(
          "Resultado confirmado, mas tentativa local não pôde ser removida; procure suporte.",
        );
      }
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado. Repita a mesma tentativa ou procure suporte para reconciliação.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  const estado = !consulta.isError && !consulta.isFetching ? consulta.data : undefined;
  const tipo = estado?.intencao ? "decisao" : "intencao";
  const foto =
    estado && !estado.vinculo && !estado.decisao
      ? JSON.stringify([
          userId,
          clienteId,
          ocorrenciaId,
          estado,
          titulo.trim(),
          motivo.trim(),
          osId.trim(),
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
    <section aria-label="Intenção de OS para Grupo">
      <h5>Intenção de OS</h5>
      <p>
        O registro de intenção não cria OS nem comprova execução. Ausência aqui não exclui OS fora
        desta consulta.
      </p>
      {consulta.isError && (
        <p role="alert">
          Estado indisponível.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {estado?.intencao && (
        <p>
          Intenção {estado.intencao.id} · {estado.intencao.titulo} · revisão histórica do Grupo{" "}
          {estado.intencao.grupoRevisao} · quantidade {estado.intencao.quantidade}
        </p>
      )}
      {estado?.decisao && (
        <p>
          Decisão para OS {estado.decisao.osId}: {estado.decisao.motivo}.
          {!estado.vinculo && " O vínculo é uma ação separada."}
        </p>
      )}
      {estado?.vinculo && <p>Vínculo declarado à OS {estado.vinculo.osId}.</p>}
      {estado?.intencao && import.meta.env.VITE_SSO_CRIAR_OS_GRUPO_ENABLED === "true" && (
        <CriarOsGrupo
          userId={userId}
          clienteId={clienteId}
          ocorrenciaId={ocorrenciaId}
          intencaoId={estado.intencao.id}
          disponivel={!estado.decisao && !estado.vinculo && !pendente}
        />
      )}
      {estado && !estado.vinculo && !estado.decisao && (
        <fieldset disabled={!!pendente || envio.isPending}>
          {tipo === "intencao" ? (
            <label>
              Título{" "}
              <input
                value={titulo}
                maxLength={200}
                onChange={(e) => {
                  setTitulo(e.target.value);
                  setConfirmacao(null);
                }}
              />
            </label>
          ) : (
            <label>
              ID da OS existente para decisão{" "}
              <input
                value={osId}
                onChange={(e) => {
                  setOsId(e.target.value);
                  setConfirmacao(null);
                }}
              />
            </label>
          )}
          <label>
            Motivo{" "}
            <textarea
              value={motivo}
              maxLength={2000}
              onChange={(e) => {
                setMotivo(e.target.value);
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
            Confirmo os dados e a decisão
          </label>
          <button
            type="button"
            disabled={
              !foto ||
              confirmacao !== foto ||
              !motivo.trim() ||
              (tipo === "intencao" ? !titulo.trim() : !uuid.safeParse(osId.trim()).success)
            }
            onClick={() =>
              enviar({
                requestId: crypto.randomUUID(),
                clienteId,
                ocorrenciaId,
                tipo,
                titulo: tipo === "intencao" ? titulo.trim() : "",
                motivo: motivo.trim(),
                intencaoId: estado.intencao?.id ?? "",
                osId: tipo === "decisao" ? osId.trim() : "",
              })
            }
          >
            {tipo === "intencao" ? "Preparar intenção" : "Registrar decisão para OS"}
          </button>
        </fieldset>
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
