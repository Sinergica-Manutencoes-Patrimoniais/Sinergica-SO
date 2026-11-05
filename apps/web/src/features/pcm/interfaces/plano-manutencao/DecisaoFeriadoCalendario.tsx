import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedidoSchema = z
  .object({
    requestId: z.string().uuid(),
    clienteId: z.string().uuid(),
    preparadaId: z.string().uuid(),
    feriadoId: z.string().uuid(),
    revisao: z.number().int().nonnegative().safe(),
    motivo: z.string().min(1).max(2000),
    vencimento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    feriadoRevisao: z.number().int().nonnegative().safe().optional(),
  })
  .strict();
const feriadoSchema = z
  .object({
    id: z.string().uuid(),
    fonte: z.string(),
    revisao: z.number().int().nonnegative().safe(),
  })
  .strict();
const consultaSchema = z.discriminatedUnion("preparadaExiste", [
  z
    .object({
      preparadaExiste: z.literal(false),
      feriados: z.array(feriadoSchema).length(0),
      fonteCompleta: z.literal(false),
    })
    .strict(),
  z
    .object({
      preparadaExiste: z.literal(true),
      preparadaId: z.string().uuid(),
      vencimentoOriginal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      revisao: z.number().int().nonnegative().safe(),
      feriados: z.array(feriadoSchema),
      fonteCompleta: z.literal(false),
    })
    .strict(),
]);
type Pedido = z.infer<typeof pedidoSchema>;
type Props = {
  userId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  rotinaId: string;
  ciclo: number;
  aoConferirAtraso?: (preparadaId: string) => void;
};

export function DecisaoFeriadoCalendario(props: Props) {
  return (
    <Formulario
      key={JSON.stringify([
        props.userId,
        props.clienteId,
        props.planoId,
        props.versaoId,
        props.rotinaId,
        props.ciclo,
      ])}
      {...props}
    />
  );
}

function Formulario({
  userId,
  clienteId,
  planoId,
  versaoId,
  rotinaId,
  ciclo,
  aoConferirAtraso,
}: Props) {
  const chave = `sso-feriado-ciclo:${JSON.stringify([userId, clienteId, planoId, versaoId, rotinaId, ciclo])}`;
  const trava = useRef(false);
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const [aberto, setAberto] = useState(false);
  const [feriadoId, setFeriadoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = pedidoSchema.parse(JSON.parse(raw));
      if ((p.vencimento === undefined) !== (p.feriadoRevisao === undefined)) return "invalido";
      return p.clienteId === clienteId ? p : "invalido";
    } catch {
      return "invalido";
    }
  });
  async function conferirSessao() {
    const atual = await supabase.auth.getUser();
    if (atual.error || atual.data.user?.id !== userId || !montado.current)
      throw new Error("Sessão alterada.");
  }
  const consulta = useQuery({
    queryKey: ["feriados-ciclo", userId, clienteId, planoId, versaoId, rotinaId, ciclo],
    enabled: aberto,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      await conferirSessao();
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_feriados_ciclo", {
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_versao_id: versaoId,
          p_rotina_id: rotinaId,
          p_indice: ciclo,
        })
        .abortSignal(signal);
      if (error) throw error;
      const r = consultaSchema.parse(data);
      if (new Set(r.feriados.map((f) => f.id.toLowerCase())).size !== r.feriados.length)
        throw new Error("Feriados duplicados.");
      await conferirSessao();
      if (signal.aborted) throw new Error("Consulta cancelada.");
      return r;
    },
  });
  const atual = consulta.data?.preparadaExiste ? consulta.data : null;
  const feriado = atual?.feriados.find((f) => f.id === feriadoId);
  const foto =
    atual && feriado
      ? JSON.stringify([
          userId,
          clienteId,
          planoId,
          versaoId,
          rotinaId,
          ciclo,
          atual,
          feriado,
          motivo.trim(),
        ])
      : null;
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa alterada.");
      const parametros = {
        p_request_id: p.requestId,
        p_cliente_id: p.clienteId,
        p_preparada_id: p.preparadaId,
        p_feriado_id: p.feriadoId,
        p_expected_revision: p.revisao,
        p_motivo: p.motivo,
      };
      const consulta =
        p.vencimento !== undefined && p.feriadoRevisao !== undefined
          ? supabase.schema("pcm").rpc("sso_decidir_feriado_conferido", {
              ...parametros,
              p_feriado_revision: p.feriadoRevisao,
              p_vencimento: p.vencimento,
            })
          : supabase.schema("pcm").rpc("sso_decidir_feriado_calendario", parametros);
      const { data, error } = await consulta;
      if (error) throw error;
      if (
        !data ||
        data.requestId !== p.requestId ||
        data.preparadaId !== p.preparadaId ||
        data.revisao !== p.revisao + 1 ||
        data.decisao !== "manter_para_pcm" ||
        (p.vencimento !== undefined && data.vencimentoOriginal !== p.vencimento) ||
        (p.feriadoRevisao !== undefined && data.feriadoRevisao !== p.feriadoRevisao) ||
        data.estadoOperacionalAlterado !== false ||
        data.dataBaseAlterada !== false ||
        data.osCriada !== false ||
        data.tarefaAuvoCriada !== false
      )
        throw new Error("Resultado divergente.");
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa alterada.");
    },
  });
  async function enviar(p: Pedido, repeticao: boolean) {
    if (trava.current) return;
    trava.current = true;
    setAviso("");
    try {
      const salvo = sessionStorage.getItem(chave);
      if (repeticao ? salvo !== JSON.stringify(p) : salvo !== null)
        throw new Error("Tentativa divergente.");
      if (!repeticao) sessionStorage.setItem(chave, JSON.stringify(p));
      setPendente(p);
      await envio.mutateAsync(p);
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(chave);
      setPendente(null);
      setConfirmado(null);
      setAviso("Decisão registrada; estado operacional e calendário não foram alterados.");
      void consulta.refetch();
    } catch (error) {
      if (
        !repeticao &&
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P0018" &&
        "message" in error &&
        (error.message === "revisao_obsoleta" ||
          error.message === "feriado_alterado" ||
          error.message === "fotografia_divergente")
      ) {
        try {
          await conferirSessao();
          if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
          sessionStorage.removeItem(chave);
          setPendente(null);
          setConfirmado(null);
          setAviso("Os dados mudaram. Confira novamente antes de decidir.");
          void consulta.refetch();
          return;
        } catch {
          setAviso("Tentativa preservada; procure suporte.");
          return;
        }
      }
      setAviso(
        "Resultado não confirmado. Mantenha a tentativa e procure suporte em caso de conflito.",
      );
    } finally {
      trava.current = false;
    }
  }
  return (
    <section aria-label="Decisão de feriado por calendário">
      <button type="button" onClick={() => setAberto(!aberto)}>
        {aberto ? "Ocultar decisão de feriado" : "Conferir decisão de feriado"}
      </button>
      {aberto && (
        <>
          <p>
            A decisão registra manutenção para tratamento PCM, sem presumir pendência de execução.
            Lista apenas feriados gerais declarados e é incompleta; não altera âncora, vencimento,
            OS ou Auvo.
          </p>
          {consulta.isFetching && <output>Consultando feriados…</output>}
          {consulta.isError && (
            <p role="alert">
              Consulta indisponível.{" "}
              <button type="button" onClick={() => void consulta.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {!consulta.isFetching &&
            !consulta.isError &&
            consulta.data &&
            !consulta.data.preparadaExiste && (
              <p>Ocorrência desta versão não encontrada; outras versões não são inferidas.</p>
            )}
          {!consulta.isFetching && !consulta.isError && atual && aoConferirAtraso && (
            <button type="button" onClick={() => aoConferirAtraso(atual.preparadaId)}>
              Conferir esta ocorrência na triagem de atraso
            </button>
          )}
          {!consulta.isFetching && !consulta.isError && atual && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  !feriado ||
                  !foto ||
                  confirmado !== foto ||
                  !motivo.trim() ||
                  pendente ||
                  trava.current
                )
                  return;
                void enviar(
                  {
                    requestId: crypto.randomUUID(),
                    clienteId,
                    preparadaId: atual.preparadaId,
                    feriadoId: feriado.id,
                    revisao: atual.revisao,
                    motivo: motivo.trim(),
                    vencimento: atual.vencimentoOriginal,
                    feriadoRevisao: feriado.revisao,
                  },
                  false,
                );
              }}
            >
              <fieldset disabled={!!pendente || envio.isPending}>
                <p>
                  Vencimento original {atual.vencimentoOriginal} · revisão {atual.revisao}
                </p>
                <label>
                  Feriado geral declarado{" "}
                  <select
                    required
                    value={feriadoId}
                    onChange={(e) => {
                      setFeriadoId(e.target.value);
                      setConfirmado(null);
                    }}
                  >
                    <option value="">Selecione</option>
                    {atual.feriados.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.fonte} · revisão {f.revisao}
                      </option>
                    ))}
                  </select>
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
                    checked={foto !== null && confirmado === foto}
                    disabled={!foto}
                    onChange={(e) => setConfirmado(e.target.checked ? foto : null)}
                  />{" "}
                  Conferi a fonte declarada e a data
                </label>
                <button type="submit" disabled={!foto || confirmado !== foto}>
                  Registrar tratamento PCM
                </button>
              </fieldset>
            </form>
          )}
          {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}
          {pendente && pendente !== "invalido" && (
            <button
              type="button"
              disabled={envio.isPending}
              onClick={() => void enviar(pendente, true)}
            >
              Repetir tentativa pendente
            </button>
          )}
          {aviso && <output className="block">{aviso}</output>}
        </>
      )}
    </section>
  );
}
