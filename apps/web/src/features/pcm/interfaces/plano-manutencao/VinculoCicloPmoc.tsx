import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

type Props = { userId: string; clienteId: string; propostaId: string; decisaoRevision: number };
const pedidoSchema = z
  .object({
    requestId: z.string().uuid(),
    clienteId: z.string().uuid(),
    propostaId: z.string().uuid(),
    decisaoRevision: z.number().int().positive().safe(),
    evidencia: z.string().trim().min(1).max(500),
    motivo: z.string().trim().min(1).max(2000),
  })
  .strict();
type Pedido = z.infer<typeof pedidoSchema>;
export function VinculoCicloPmoc(props: Props) {
  if (import.meta.env.VITE_SSO_VINCULO_CICLO_PMOC_ENABLED !== "true") return null;
  return (
    <Conteudo
      key={JSON.stringify([props.userId, props.clienteId, props.propostaId, props.decisaoRevision])}
      {...props}
    />
  );
}
function Conteudo({ userId, clienteId, propostaId, decisaoRevision }: Props) {
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const cache = useQueryClient();
  const trava = useRef(false);
  const primeira = useRef(false);
  const chave = `sso-vinculo-pmoc:${JSON.stringify([userId, clienteId, propostaId, decisaoRevision])}`;
  const [evidencia, setEvidencia] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = pedidoSchema.parse(JSON.parse(raw));
      return p.clienteId === clienteId &&
        p.propostaId === propostaId &&
        p.decisaoRevision === decisaoRevision
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const assinatura = JSON.stringify([
    clienteId,
    propostaId,
    decisaoRevision,
    evidencia.trim(),
    motivo.trim(),
  ]);
  const queryKey = ["vinculo-ciclo-pmoc", userId, clienteId, propostaId, decisaoRevision] as const;
  const consulta = useQuery({
    queryKey,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_consultar_vinculo_ciclo_pmoc", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_proposta_id: propostaId,
        })
        .abortSignal(signal);
      if (error) throw error;
      const r = z
        .object({
          propostaId: z.string().uuid(),
          vinculoId: z.string().uuid().nullable(),
          estado: z.enum(["nao_vinculado", "declarado_pcm", "revisao_necessaria"]),
          agendamentoId: z.string().uuid().nullable(),
        })
        .strict()
        .parse(data);
      if (
        r.propostaId !== propostaId ||
        (r.estado === "nao_vinculado") !== (r.vinculoId === null) ||
        (r.vinculoId === null) !== (r.agendamentoId === null)
      )
        throw new Error("Resposta divergente.");
      await conferirSessaoDiagnostico(userId, signal);
      return r;
    },
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessaoDiagnostico(userId);
      if (!montado.current) throw new Error("Tela desmontada.");
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa divergente.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_vincular_ciclo_pmoc", {
        p_ator_id: userId,
        p_request_id: p.requestId,
        p_cliente_id: p.clienteId,
        p_proposta_id: p.propostaId,
        p_expected_decisao: p.decisaoRevision,
        p_confirma_alvo: true,
        p_confirma_obrigacao: true,
        p_evidencia: p.evidencia,
        p_motivo: p.motivo,
      });
      if (error) throw error;
      const r = z
        .object({
          requestId: z.string().uuid(),
          vinculoId: z.string().uuid(),
          propostaId: z.string().uuid(),
          agendamentoId: z.string().uuid(),
          escopoDeclaradoPcm: z.literal(true),
          fonteIndependenteValidada: z.literal(false),
          exclusividadeGlobalComprovada: z.literal(false),
          ocorrenciaCriada: z.literal(false),
          osCriada: z.literal(false),
          tarefaAuvoCriada: z.literal(false),
        })
        .strict()
        .parse(data);
      if (r.requestId !== p.requestId || r.propostaId !== p.propostaId)
        throw new Error("Recibo divergente.");
      await conferirSessaoDiagnostico(userId);
      if (!montado.current) throw new Error("Tela desmontada.");
    },
    onSuccess: async (_r, p) => {
      try {
        await conferirSessaoDiagnostico(userId);
        if (!montado.current) throw new Error("Tela desmontada.");
        if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
        sessionStorage.removeItem(chave);
      } catch {
        setAviso("Tentativa preservada; procure suporte.");
        return;
      }
      setPendente(null);
      setConfirmado(null);
      setAviso("Vínculo declarado. Nenhum agendamento ou OS foi alterado.");
      await Promise.all([
        cache.invalidateQueries({ queryKey }),
        cache.invalidateQueries({ queryKey: ["origem-efetiva-ciclo", userId, clienteId] }),
        cache.invalidateQueries({ queryKey: ["origens-lote", userId, clienteId] }),
        cache.invalidateQueries({ queryKey: ["inventario-pmoc", userId, clienteId] }),
        cache.invalidateQueries({ queryKey: ["avaliacao-inventario-pmoc", userId, clienteId] }),
      ]);
    },
    onError: async (error, p) => {
      if (
        primeira.current &&
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P0019" &&
        "message" in error &&
        typeof error.message === "string" &&
        ["plano_alterado", "decisao_nao_validada_ou_obsoleta"].includes(error.message)
      ) {
        try {
          await conferirSessaoDiagnostico(userId);
          if (!montado.current) throw new Error("Tela desmontada.");
          if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
          sessionStorage.removeItem(chave);
          setPendente(null);
          setConfirmado(null);
          setAviso("A proposta mudou. Atualize e confira novamente.");
          await cache.invalidateQueries({ queryKey });
          return;
        } catch {
          setAviso("Tentativa preservada; procure suporte.");
          return;
        }
      }
      setAviso(
        "Resultado não confirmado ou identidade em conflito. Repita a tentativa; procure suporte se persistir.",
      );
    },
    onSettled: () => {
      trava.current = false;
      primeira.current = false;
    },
  });
  const enviar = (p: Pedido) => {
    if (trava.current) return;
    try {
      const anterior = sessionStorage.getItem(chave);
      if (anterior !== null && anterior !== JSON.stringify(p)) throw new Error();
      primeira.current = anterior === null;
      sessionStorage.setItem(chave, JSON.stringify(p));
    } catch {
      setAviso("Não foi possível guardar a tentativa.");
      return;
    }
    trava.current = true;
    setPendente(p);
    envio.mutate(p);
  };
  return (
    <section aria-label="Vínculo da obrigação ao PMOC">
      <p>
        O PCM declara que o agendamento cobre o mesmo alvo e a mesma obrigação contratual. A
        referência não é verificada automaticamente; declare a origem PMOC na Rotina antes de
        vincular.
      </p>
      {consulta.isFetching && <output>Consultando vínculo…</output>}
      {consulta.isError && (
        <p role="alert">
          Vínculo indisponível.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.data?.estado === "declarado_pcm" && (
        <p>Vínculo declarado ao agendamento {consulta.data.agendamentoId}.</p>
      )}
      {!consulta.isFetching &&
        !consulta.isError &&
        consulta.data?.estado === "revisao_necessaria" && (
          <p role="alert">Vínculo anterior requer nova análise; registre nova proposta.</p>
        )}
      {!consulta.isFetching && !consulta.isError && consulta.data?.estado === "nao_vinculado" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              pendente ||
              envio.isPending ||
              confirmado !== assinatura ||
              !evidencia.trim() ||
              !motivo.trim()
            )
              return;
            enviar({
              requestId: crypto.randomUUID(),
              clienteId,
              propostaId,
              decisaoRevision,
              evidencia: evidencia.trim(),
              motivo: motivo.trim(),
            });
          }}
        >
          <fieldset disabled={!!pendente || envio.isPending}>
            <label>
              Referência da evidência{" "}
              <input
                required
                maxLength={500}
                value={evidencia}
                onChange={(e) => {
                  setEvidencia(e.target.value);
                  setConfirmado(null);
                }}
              />
            </label>
            <label>
              Motivo{" "}
              <textarea
                required
                maxLength={2000}
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  setConfirmado(null);
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={confirmado === assinatura}
                onChange={(e) => setConfirmado(e.target.checked ? assinatura : null)}
              />{" "}
              Conferi mesmo alvo e mesma obrigação contratual
            </label>
            <button type="submit" disabled={confirmado !== assinatura}>
              Vincular ao PMOC
            </button>
          </fieldset>
        </form>
      )}
      {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <output>{aviso}</output>}
    </section>
  );
}
