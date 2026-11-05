import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
const cursorSchema = z
  .object({ tipo: z.enum(["calendario", "visita"]), ciclo: z.string().uuid() })
  .strict();
const pedidoSchema = z
  .object({
    requestId: z.string().uuid(),
    clienteId: z.string().uuid(),
    planoId: z.string().uuid(),
    cursor: cursorSchema.nullable(),
  })
  .strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Cursor = z.infer<typeof cursorSchema>;
export function AplicarRetiradasFila(props: {
  userId: string;
  clienteId: string;
  planoId: string;
}) {
  return (
    <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.planoId])} {...props} />
  );
}
function Conteudo({
  userId,
  clienteId,
  planoId,
}: { userId: string; clienteId: string; planoId: string }) {
  const cache = useQueryClient();
  const trava = useRef(false);
  const primeiraTentativa = useRef(false);
  const chave = `sso-aplicar-retiradas-fila:${JSON.stringify([userId, clienteId, planoId])}`;
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = pedidoSchema.parse(JSON.parse(raw));
      return p.clienteId === clienteId && p.planoId === planoId ? p : "invalido";
    } catch {
      return "invalido";
    }
  });
  const assinatura = JSON.stringify([userId, clienteId, planoId, cursor]);
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessaoDiagnostico(userId);
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa divergente.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_aplicar_retiradas_fila", {
          p_ator_id: userId,
          p_request_id: p.requestId,
          p_cliente_id: p.clienteId,
          p_plano_id: p.planoId,
          p_limite: 50,
          p_apos_tipo: p.cursor?.tipo ?? null,
          p_apos_ciclo: p.cursor?.ciclo ?? null,
        });
      if (error) throw error;
      const r = z
        .object({
          requestId: z.string().uuid(),
          clienteId: z.string().uuid(),
          planoId: z.string().uuid(),
          canceladas: z.number().int().nonnegative().max(50),
          pendentesConferencia: z.number().int().nonnegative().max(50),
          visitasSemPermissao: z.number().int().nonnegative().max(50),
          visitadas: z.number().int().nonnegative().max(50),
          ultimoTipo: z.enum(["calendario", "visita"]).nullable(),
          ultimoCiclo: z.string().uuid().nullable(),
          maisPossivel: z.boolean(),
          osAlteradas: z.literal(false),
          tarefaAuvoCriada: z.literal(false),
        })
        .strict()
        .parse(data);
      if (
        r.requestId !== p.requestId ||
        r.clienteId !== clienteId ||
        r.planoId !== planoId ||
        r.canceladas + r.pendentesConferencia + r.visitasSemPermissao !== r.visitadas ||
        (r.ultimoTipo === null) !== (r.ultimoCiclo === null) ||
        r.maisPossivel !== (r.visitadas === 50)
      )
        throw new Error("Recibo divergente.");
      await conferirSessaoDiagnostico(userId);
      return r;
    },
    onSuccess: async (r, p) => {
      try {
        await conferirSessaoDiagnostico(userId);
        if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
        sessionStorage.removeItem(chave);
      } catch {
        setAviso("Tentativa preservada; procure suporte.");
        return;
      }
      setPendente(null);
      setConfirmado(null);
      setCursor(
        r.maisPossivel && r.ultimoTipo && r.ultimoCiclo
          ? { tipo: r.ultimoTipo, ciclo: r.ultimoCiclo }
          : null,
      );
      setAviso(
        `${r.canceladas} entrada(s) retiradas da fila; ${r.pendentesConferencia} exigem conferência e ${r.visitasSemPermissao} Visita(s) exigem permissão. Nenhuma OS foi alterada.`,
      );
      await cache
        .invalidateQueries({ queryKey: ["fila-preventiva-pcm", userId, clienteId, planoId] })
        .catch(() => undefined);
    },
    onError: async (error, p) => {
      const e = error as { code?: string; message?: string };
      if (primeiraTentativa.current && e.code === "P0012" && e.message === "fila_alterada") {
        try {
          await conferirSessaoDiagnostico(userId);
          if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
          sessionStorage.removeItem(chave);
          setPendente(null);
          setConfirmado(null);
          setAviso("A fila mudou. Confira novamente antes de aplicar as retiradas.");
          await cache.invalidateQueries({
            queryKey: ["fila-preventiva-pcm", userId, clienteId, planoId],
          });
          return;
        } catch {
          /* Preservar se a sessão ou o pedido divergirem. */
        }
      }
      setAviso("Resultado não confirmado. Repita o mesmo pedido ou procure suporte.");
    },
    onSettled: () => {
      trava.current = false;
    },
  });
  const enviar = (p: Pedido) => {
    if (trava.current) return;
    try {
      const anterior = sessionStorage.getItem(chave);
      if (anterior !== null && anterior !== JSON.stringify(p)) throw new Error();
      primeiraTentativa.current = anterior === null;
      sessionStorage.setItem(chave, JSON.stringify(p));
    } catch {
      setAviso("Não foi possível guardar tentativa; nada enviado.");
      return;
    }
    trava.current = true;
    setPendente(p);
    envio.mutate(p);
  };
  return (
    <section aria-label="Aplicar retiradas aprovadas">
      <h3>Aplicar retiradas aprovadas</h3>
      <p>
        Aplica até 50 retiradas já vigentes à fila local somente quando a fonte confirma ausência de
        execução. Casos incertos ou com OS permanecem para conferência; nenhuma OS é alterada.
      </p>
      {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" ? (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir mesmo lote
        </button>
      ) : (
        !pendente && (
          <>
            <label>
              <input
                type="checkbox"
                checked={confirmado === assinatura}
                onChange={(e) => setConfirmado(e.target.checked ? assinatura : null)}
              />{" "}
              Conferi o Plano e autorizo aplicar este lote de retiradas efetivas
            </label>
            <button
              type="button"
              disabled={envio.isPending || confirmado !== assinatura}
              onClick={() => enviar({ requestId: crypto.randomUUID(), clienteId, planoId, cursor })}
            >
              {cursor ? "Aplicar próximo lote" : "Aplicar retiradas à fila"}
            </button>
          </>
        )
      )}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}
