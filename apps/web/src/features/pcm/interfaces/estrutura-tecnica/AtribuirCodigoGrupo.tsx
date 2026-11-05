import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedidoSchema = z
  .object({
    requestId: z.string().uuid(),
    clienteId: z.string().uuid(),
    grupoId: z.string().uuid(),
    codigo: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[^\s]+$/),
  })
  .strict();
type Pedido = z.infer<typeof pedidoSchema>;

export function AtribuirCodigoGrupo({
  userId,
  clienteId,
  grupoId,
}: { userId: string; clienteId: string; grupoId: string }) {
  if (import.meta.env.VITE_SSO_ATRIBUIR_CODIGO_GRUPO_ENABLED !== "true") return null;
  return (
    <Conteudo
      key={JSON.stringify([userId, clienteId, grupoId])}
      userId={userId}
      clienteId={clienteId}
      grupoId={grupoId}
    />
  );
}

function Conteudo({
  userId,
  clienteId,
  grupoId,
}: { userId: string; clienteId: string; grupoId: string }) {
  const chave = `sso-atribuir-codigo-grupo:${JSON.stringify([userId, clienteId, grupoId])}`;
  const client = useQueryClient();
  const trava = useRef(false);
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const [codigo, setCodigo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const p = pedidoSchema.parse(JSON.parse(salvo));
      return p.clienteId === clienteId && p.grupoId === grupoId ? p : "invalido";
    } catch {
      return "invalido";
    }
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      const antes = await supabase.auth.getUser();
      if (
        antes.error ||
        !montado.current ||
        antes.data.user?.id !== userId ||
        sessionStorage.getItem(chave) !== JSON.stringify(p)
      )
        throw new Error("Sessão ou tentativa alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_atribuir_codigo_grupo", {
        p_request_id: p.requestId,
        p_cliente_id: clienteId,
        p_grupo_id: grupoId,
        p_codigo: p.codigo,
      });
      if (error) throw error;
      if (
        !data ||
        data.requestId !== p.requestId ||
        data.clienteId !== clienteId ||
        data.grupoId !== grupoId ||
        data.codigo !== p.codigo ||
        !z.string().uuid().safeParse(data.codigoId).success
      )
        throw new Error("Resposta inválida.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || !montado.current)
        throw new Error("Sessão alterada.");
    },
    onSuccess: async (_data, p) => {
      try {
        await client.invalidateQueries({
          queryKey: ["codigos-publicos", userId, clienteId],
          refetchType: "none",
        });
        const atual = await supabase.auth.getUser();
        if (
          atual.error ||
          !montado.current ||
          atual.data.user?.id !== userId ||
          sessionStorage.getItem(chave) !== JSON.stringify(p)
        )
          throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(chave);
        setPendente(null);
        setCodigo("");
        setConfirmacao(null);
        setAviso("Código inicial atribuído.");
        void client.refetchQueries({
          queryKey: ["codigos-publicos", userId, clienteId],
          type: "active",
        });
      } catch {
        if (montado.current)
          setAviso("Código confirmado, mas tentativa local não pôde ser limpa. Consulte suporte.");
      }
    },
    onError: () => {
      if (montado.current)
        setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte.");
    },
    onSettled: () => {
      trava.current = false;
    },
  });
  function enviar(p: Pedido, repeticao: boolean) {
    if (trava.current) return;
    trava.current = true;
    try {
      const salvo = sessionStorage.getItem(chave);
      if (repeticao ? salvo !== JSON.stringify(p) : salvo !== null) throw new Error();
      if (!repeticao) sessionStorage.setItem(chave, JSON.stringify(p));
      setPendente(p);
      envio.mutate(p);
    } catch {
      trava.current = false;
      setAviso("Tentativa não pôde ser preservada; nada foi enviado.");
    }
  }
  const normalizado = codigo.trim().toUpperCase();
  return (
    <section aria-label="Atribuir código inicial ao Grupo">
      <h5>Definir código inicial</h5>
      <p>
        Somente Grupo ainda sem código; esta ação não imprime etiqueta nem altera códigos
        existentes.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pendente || confirmacao !== normalizado) return;
          const p = pedidoSchema.safeParse({
            requestId: crypto.randomUUID(),
            clienteId,
            grupoId,
            codigo: normalizado,
          });
          if (!p.success) {
            setAviso("Informe código válido sem espaços.");
            return;
          }
          enviar(p.data, false);
        }}
      >
        <label>
          Código inicial{" "}
          <input
            value={codigo}
            maxLength={200}
            required
            disabled={!!pendente || envio.isPending}
            onChange={(e) => {
              setCodigo(e.target.value);
              setConfirmacao(null);
            }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={!!normalizado && confirmacao === normalizado}
            disabled={!!pendente || envio.isPending || !normalizado}
            onChange={(e) => setConfirmacao(e.target.checked ? normalizado : null)}
          />{" "}
          Conferi o código e possíveis duplicidades.
        </label>
        <button
          type="submit"
          disabled={!!pendente || envio.isPending || !normalizado || confirmacao !== normalizado}
        >
          Atribuir código
        </button>
      </form>
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente, true)}>
          Repetir tentativa de {pendente.codigo}
        </button>
      )}
      {aviso && <output className="block">{aviso}</output>}
    </section>
  );
}
