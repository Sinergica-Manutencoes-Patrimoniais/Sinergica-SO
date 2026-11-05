import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

type Props = {
  userId: string;
  clienteId: string;
  planoId: string;
  rascunhoId: string;
  preparadaId: string;
  planoRevision: number;
  decisaoRevision: number;
  tipo: "calendario" | "visita";
};
const pedidoSchema = z
  .object({
    requestId: z.string().uuid(),
    clienteId: z.string().uuid(),
    planoId: z.string().uuid(),
    rascunhoId: z.string().uuid(),
    preparadaId: z.string().uuid(),
    planoRevision: z.number().int().positive().safe(),
    decisaoRevision: z.number().int().positive().safe(),
    tipo: z.enum(["calendario", "visita"]),
    motivo: z.string().trim().min(1).max(2000),
  })
  .strict();
type Pedido = z.infer<typeof pedidoSchema>;
export function ResolverRetiradaImpacto(props: Props) {
  if (import.meta.env.VITE_SSO_RESOLUCAO_IMPACTO_ENABLED !== "true") return null;
  return (
    <Conteudo
      key={JSON.stringify([
        props.userId,
        props.clienteId,
        props.planoId,
        props.rascunhoId,
        props.preparadaId,
        props.decisaoRevision,
        props.tipo,
      ])}
      {...props}
    />
  );
}
function Conteudo({
  userId,
  clienteId,
  planoId,
  rascunhoId,
  preparadaId,
  planoRevision,
  decisaoRevision,
  tipo,
}: Props) {
  const cache = useQueryClient();
  const trava = useRef(false);
  const primeiraTentativa = useRef(false);
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const chave = `sso-retirada-impacto:${JSON.stringify([userId, clienteId, planoId, rascunhoId, preparadaId, decisaoRevision, tipo])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = pedidoSchema.parse(JSON.parse(raw));
      return p.clienteId === clienteId &&
        p.planoId === planoId &&
        p.rascunhoId === rascunhoId &&
        p.preparadaId === preparadaId &&
        p.decisaoRevision === decisaoRevision &&
        p.tipo === tipo
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const assinatura = JSON.stringify([
    clienteId,
    planoId,
    rascunhoId,
    preparadaId,
    planoRevision,
    decisaoRevision,
    tipo,
    motivo.trim(),
  ]);
  const queryKey = [
    "resolucao-impacto",
    userId,
    clienteId,
    planoId,
    rascunhoId,
    preparadaId,
    planoRevision,
    decisaoRevision,
    tipo,
  ] as const;
  const consulta = useQuery({
    queryKey,
    retry: false,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_consultar_resolucao_impacto_v2", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_rascunho_id: rascunhoId,
          p_preparada_id: preparadaId,
          p_expected_plano: planoRevision,
          p_expected_decisao: decisaoRevision,
          p_tipo: tipo,
        })
        .abortSignal(signal);
      if (error) throw error;
      const r = z
        .object({
          preparadaId: z.string().uuid(),
          revisaoDecisao: z.number().int().positive(),
          resolvida: z.boolean(),
          motivo: z.string().nullable(),
          resolucaoObsoleta: z.boolean(),
        })
        .strict()
        .parse(data);
      if (
        r.preparadaId !== preparadaId ||
        r.revisaoDecisao !== decisaoRevision ||
        r.resolvida !== (r.motivo !== null) ||
        (r.resolvida && r.resolucaoObsoleta)
      )
        throw new Error("Resposta divergente.");
      await conferirSessaoDiagnostico(userId, signal);
      return r;
    },
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessaoDiagnostico(userId);
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa divergente.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_resolver_impacto_retirada", {
        p_ator_id: userId,
        p_request_id: p.requestId,
        p_cliente_id: p.clienteId,
        p_plano_id: p.planoId,
        p_rascunho_id: p.rascunhoId,
        p_preparada_id: p.preparadaId,
        p_expected_plano: p.planoRevision,
        p_expected_decisao: p.decisaoRevision,
        p_tipo: p.tipo,
        p_motivo: p.motivo,
      });
      if (error) throw error;
      const r = z
        .object({
          requestId: z.string().uuid(),
          preparadaId: z.string().uuid(),
          revisaoPlano: z.number().int().positive(),
          revisaoDecisao: z.number().int().positive(),
          decisao: z.literal("retirar_geracao"),
          resolucaoRegistrada: z.literal(true),
          aprovacaoAutorizada: z.literal(false),
          ocorrenciaAlterada: z.literal(false),
          osAlteradas: z.literal(false),
        })
        .strict()
        .parse(data);
      if (
        r.requestId !== p.requestId ||
        r.preparadaId !== p.preparadaId ||
        r.revisaoPlano !== p.planoRevision ||
        r.revisaoDecisao !== p.decisaoRevision
      )
        throw new Error("Recibo divergente.");
      await conferirSessaoDiagnostico(userId);
    },
    onSuccess: async (_r, p) => {
      try {
        await conferirSessaoDiagnostico(userId);
        if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
        sessionStorage.removeItem(chave);
      } catch {
        setAviso("Tentativa preservada; procure suporte.");
        return;
      }
      setPendente(null);
      setConfirmacao(null);
      setAviso("Retirada registrada para aprovação; ocorrência e OS permanecem intactas.");
      await Promise.all([
        cache.invalidateQueries({ queryKey }),
        cache.invalidateQueries({
          queryKey: ["avaliacao-impacto-revisao", userId, clienteId, planoId],
        }),
        cache.invalidateQueries({
          queryKey: ["avaliacao-impacto-visita-legado", userId, clienteId, planoId],
        }),
      ]);
    },
    onError: async (error, p) => {
      if (
        primeiraTentativa.current &&
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        "message" in error &&
        ((error.code === "P0011" && error.message === "revisao_obsoleta") ||
          (error.code === "P0015" && error.message === "decisao_obsoleta_ou_incompativel"))
      ) {
        try {
          await conferirSessaoDiagnostico(userId);
          if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
          sessionStorage.removeItem(chave);
          setPendente(null);
          setConfirmacao(null);
          setAviso("A revisão ou decisão mudou. Atualize os dados e confirme novamente.");
          await Promise.all([
            cache.invalidateQueries({ queryKey }),
            cache.invalidateQueries({
              queryKey: ["decisoes-impacto-ocorrencia", userId, clienteId, planoId],
            }),
            cache.invalidateQueries({ queryKey: ["impactos-visita", userId, clienteId, planoId] }),
          ]).catch(() => undefined);
          return;
        } catch {
          setAviso("Tentativa preservada; procure suporte.");
          return;
        }
      }
      setAviso(
        "Resultado não confirmado ou decisão alterada. Repita a tentativa; procure suporte se persistir.",
      );
    },
    onSettled: () => {
      trava.current = false;
      primeiraTentativa.current = false;
    },
  });
  const enviar = (p: Pedido, primeira = false) => {
    if (trava.current) return;
    try {
      const anterior = sessionStorage.getItem(chave);
      if (anterior !== null && (primeira || anterior !== JSON.stringify(p))) throw new Error();
      sessionStorage.setItem(chave, JSON.stringify(p));
    } catch {
      setAviso("Não foi possível guardar a tentativa.");
      return;
    }
    trava.current = true;
    primeiraTentativa.current = primeira;
    setPendente(p);
    envio.mutate(p);
  };
  return (
    <section aria-label="Resolver retirada futura">
      <p>
        A retirada passa a valer somente com aprovação e vigência da revisão. Ocorrências anteriores
        à vigência precisam de outra decisão PCM; OS existentes não são canceladas.
      </p>
      {consulta.isFetching && <p role="status">Consultando resolução…</p>}
      {consulta.isError && (
        <p role="alert">
          Resolução indisponível.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.data?.resolvida && (
        <p>Retirada registrada: {consulta.data.motivo}</p>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.data?.resolucaoObsoleta && (
        <p role="alert">
          O escopo mudou ou não pôde ser comprovado. A retirada registrada não resolve mais este
          impacto; registre uma nova decisão de impacto antes de continuar.
        </p>
      )}
      {!consulta.isFetching &&
        !consulta.isError &&
        consulta.data &&
        !consulta.data.resolvida &&
        !consulta.data.resolucaoObsoleta && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pendente || envio.isPending || confirmacao !== assinatura || !motivo.trim())
                return;
              enviar(
                {
                  requestId: crypto.randomUUID(),
                  clienteId,
                  planoId,
                  rascunhoId,
                  preparadaId,
                  planoRevision,
                  decisaoRevision,
                  tipo,
                  motivo: motivo.trim(),
                },
                true,
              );
            }}
          >
            <fieldset disabled={!!pendente || envio.isPending}>
              <label>
                Motivo{" "}
                <textarea
                  required
                  maxLength={2000}
                  value={motivo}
                  onChange={(e) => {
                    setMotivo(e.target.value);
                    setConfirmacao(null);
                  }}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={confirmacao === assinatura}
                  onChange={(e) => setConfirmacao(e.target.checked ? assinatura : null)}
                />{" "}
                Confirmo retirar a geração futura desta ocorrência
              </label>
              <button disabled={confirmacao !== assinatura}>Registrar retirada</button>
            </fieldset>
          </form>
        )}
      {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}
