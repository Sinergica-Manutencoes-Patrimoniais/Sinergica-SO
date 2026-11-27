import { Button, RecursoNaoAtivado } from "@sinergica/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { flagLigada } from "../../../../config/flags-sso";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().guid();
export const pedidoCancelamentoChamadoCampoSchema = z
  .object({
    requestId: uuid,
    clienteId: uuid,
    osId: uuid,
    chamadoId: uuid,
    revision: z.number().int().positive().safe(),
    osUpdatedAt: z.string().datetime({ offset: true }).nullable(),
    taskId: z.string().regex(/^[1-9]\d{0,18}$/),
    motivo: z.string().min(1).max(2000),
  })
  .strict();
const schema = pedidoCancelamentoChamadoCampoSchema;
type Pedido = z.infer<typeof schema>;
type Props = {
  userId: string;
  clienteId: string;
  osId: string;
  chamadoId: string;
  revision: number;
  osUpdatedAt: string | null;
  taskId: string | null;
  disponivel: boolean;
  onDescartado?: () => void;
};

export function CancelarChamadoCampo(props: Props) {
  if (!flagLigada("VITE_SSO_CANCELAMENTO_CHAMADO_CAMPO_ENABLED")) {
    return (
      <RecursoNaoAtivado
        recurso="Cancelamento chamado campo"
        podeAdministrar={false}
        faltando={["VITE_SSO_CANCELAMENTO_CHAMADO_CAMPO_ENABLED"]}
      />
    );
  }
  return <Conteudo key={`${props.userId}:${props.clienteId}:${props.osId}`} {...props} />;
}
function Conteudo({
  userId,
  clienteId,
  osId,
  chamadoId,
  revision,
  osUpdatedAt,
  taskId,
  disponivel,
  onDescartado,
}: Props) {
  const chave = `sso-cancelamento-chamado-campo:${JSON.stringify([userId, clienteId, osId])}`;
  const outrasChaves = ["sso-triagem-chamado-campo:", "sso-uniao-chamado-campo:"].map(
    (prefixo) => `${prefixo}${JSON.stringify([userId, clienteId, osId])}`,
  );
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const trava = useRef(false);
  const cache = useQueryClient();
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = schema.parse(JSON.parse(raw));
      return p.clienteId === clienteId && p.osId === osId && p.chamadoId === chamadoId
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const foto = JSON.stringify([
    userId,
    clienteId,
    osId,
    chamadoId,
    revision,
    osUpdatedAt,
    taskId,
    motivo.trim(),
  ]);
  const confirmado = confirmacao === foto;
  async function conferirSessao() {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId) throw new Error("Sessão alterada.");
  }
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa divergente.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_cancelar_chamado_campo_preservado", {
          p_ator_id: userId,
          p_cliente_id: p.clienteId,
          p_request_id: p.requestId,
          p_os_id: p.osId,
          p_chamado_id: p.chamadoId,
          p_expected_revision: p.revision,
          p_os_updated_at: p.osUpdatedAt,
          p_task_id: p.taskId,
          p_motivo: p.motivo,
        });
      if (error) throw error;
      const r = z
        .object({
          requestId: uuid,
          clienteId: uuid,
          chamadoId: uuid,
          osId: uuid,
          revision: z.number().int().positive().safe(),
          estado: z.literal("cancelado"),
          osAlterada: z.literal(false),
          tarefaAlterada: z.literal(false),
          execucaoAlterada: z.literal(false),
        })
        .strict()
        .parse(data);
      if (
        r.requestId !== p.requestId ||
        r.clienteId !== p.clienteId ||
        r.chamadoId !== p.chamadoId ||
        r.osId !== p.osId
      )
        throw new Error("Recibo divergente.");
      await conferirSessao();
      return r;
    },
    onSuccess: async (_r, p) => {
      try {
        await cache.invalidateQueries({
          queryKey: ["triagem-chamado-campo", userId, clienteId, osId],
          refetchType: "none",
        });
        await conferirSessao();
        if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
        sessionStorage.removeItem(chave);
        setPendente(null);
        setConfirmacao(null);
        setAviso(
          "Chamado cancelado; OS e tarefa preservadas. Continuidade ainda depende das demais guardas operacionais.",
        );
        void cache.refetchQueries({
          queryKey: ["triagem-chamado-campo", userId, clienteId, osId],
          type: "active",
        });
        onDescartado?.();
      } catch {
        setAviso("Não foi possível confirmar sessão ou tentativa. Consulte suporte.");
      }
    },
    onError: () =>
      setAviso("Resultado não confirmado. Preserve e repita o mesmo pedido ou consulte suporte."),
    onSettled: () => {
      trava.current = false;
    },
  });
  function executar(p: Pedido) {
    if (trava.current) return;
    try {
      if (
        sessionStorage.getItem(chave) !== JSON.stringify(p) ||
        outrasChaves.some((k) => sessionStorage.getItem(k) !== null)
      )
        throw new Error();
    } catch {
      setAviso("Há outra tentativa pendente ou divergente. Reconcilie antes de continuar.");
      return;
    }
    trava.current = true;
    envio.mutate(p);
  }
  function iniciar() {
    if (!disponivel || !confirmado || !taskId || pendente || trava.current) return;
    try {
      const p = schema.parse({
        requestId: crypto.randomUUID(),
        clienteId,
        osId,
        chamadoId,
        revision,
        osUpdatedAt,
        taskId,
        motivo: motivo.trim(),
      });
      if (
        sessionStorage.getItem(chave) ||
        outrasChaves.some((k) => sessionStorage.getItem(k) !== null)
      )
        throw new Error();
      sessionStorage.setItem(chave, JSON.stringify(p));
      setPendente(p);
      executar(p);
    } catch {
      setAviso("Confira motivo e armazenamento. Nada foi enviado.");
    }
  }
  const titulo = onDescartado ? "Descartar com motivo" : "Cancelar Chamado provisório";
  return (
    <section
      aria-label={onDescartado ? titulo : "Cancelar Chamado de campo preservando OS"}
      className="space-y-3"
    >
      <div className="space-y-1">
        {onDescartado ? (
          <h3 className="text-body font-semibold text-ink">{titulo}</h3>
        ) : (
          <h5>{titulo}</h5>
        )}
        <p className="text-caption text-ink-2">
          O Chamado provisório será cancelado com motivo e vínculo histórico. A OS, sua fase e a
          tarefa Auvo serão preservadas.
        </p>
      </div>
      {pendente === "invalido" ? (
        <p role="alert">Tentativa local inválida. Consulte suporte.</p>
      ) : pendente ? (
        <Button disabled={envio.isPending} onClick={() => executar(pendente)}>
          Repetir mesmo pedido
        </Button>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar();
          }}
        >
          <label className="block space-y-1 text-caption font-semibold text-ink-2">
            {onDescartado ? "Motivo do descarte" : "Motivo"}
            <textarea
              className="input min-h-24"
              required
              maxLength={2000}
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setConfirmacao(null);
              }}
            />
          </label>
          <label className="flex items-start gap-2 text-caption text-ink-2">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmacao(e.target.checked ? foto : null)}
            />{" "}
            Conferi Chamado, OS, tarefa e motivo.
          </label>
          <Button
            variant="danger"
            type="submit"
            disabled={!disponivel || !taskId || !motivo.trim() || !confirmado || envio.isPending}
          >
            {onDescartado ? "Descartar com motivo" : "Cancelar Chamado"}
          </Button>
        </form>
      )}
      {aviso && <output>{aviso}</output>}
    </section>
  );
}
