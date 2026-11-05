import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useAuth } from "../../../../app/auth-context";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import {
  type SubstituicaoCodigo,
  substituirCodigoPublico,
} from "../../infrastructure/supabase-codigos-publicos-adapter";

export function SubstituicaoCodigoPublico({
  userId,
  clienteId,
  tipo,
  ativoId,
  codigoAnterior,
}: {
  userId: string;
  clienteId: string;
  tipo: "sistema" | "componente" | "grupo_quantitativo";
  ativoId: string;
  codigoAnterior: string;
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const trava = useRef(false);
  const storageKey = `sso-substituir-codigo:${JSON.stringify([userId, clienteId, tipo, ativoId])}`;
  const [novo, setNovo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<SubstituicaoCodigo | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(storageKey);
      if (!salvo) return null;
      const p: unknown = JSON.parse(salvo);
      if (!p || typeof p !== "object") return "invalido";
      const v = p as Record<string, unknown>;
      if (
        typeof v.requestId !== "string" ||
        v.tipo !== tipo ||
        v.ativoId !== ativoId ||
        typeof v.codigoAnterior !== "string" ||
        typeof v.codigoNovo !== "string" ||
        typeof v.motivo !== "string" ||
        !v.motivo.trim()
      )
        return "invalido";
      return v as SubstituicaoCodigo;
    } catch {
      return "invalido";
    }
  });
  const permissao = useQuery({
    queryKey: ["codigos-publicos", userId, clienteId, "substituir-permissao"],
    queryFn: () => supabaseCapacidadesSsoAdapter.autorizarAcao("codigo.substituir", clienteId),
    enabled: user?.id === userId && user.papel === "superadmin",
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const permitido =
    user?.id === userId &&
    user.papel === "superadmin" &&
    permissao.data === true &&
    !permissao.isFetching &&
    !permissao.isError;
  const envio = useMutation({
    mutationFn: async (pedido: SubstituicaoCodigo) => {
      const antes = await supabase.auth.getUser();
      if (
        antes.error ||
        antes.data.user?.id !== userId ||
        sessionStorage.getItem(storageKey) !== JSON.stringify(pedido)
      )
        throw new Error("Sessão ou tentativa alterada.");
      await substituirCodigoPublico(pedido);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
    },
    onSuccess: async (_data, pedido) => {
      // A confirmação pode ter alterado o código mesmo quando outra tentativa
      // substituiu o registro local. Reconsulte antes de decidir pela limpeza.
      await client.invalidateQueries({
        queryKey: ["codigos-publicos", userId, clienteId],
        refetchType: "none",
      });
      try {
        const atual = await supabase.auth.getUser();
        if (
          atual.error ||
          atual.data.user?.id !== userId ||
          sessionStorage.getItem(storageKey) !== JSON.stringify(pedido)
        )
          throw new Error("Tentativa local divergente");
        sessionStorage.removeItem(storageKey);
      } catch {
        setAviso(
          "Substituição concluída, mas tentativa local não pôde ser removida. Procure suporte.",
        );
        return;
      }
      setPendente(null);
      setNovo("");
      setMotivo("");
      setConfirmacao(null);
      setAviso("Código substituído; código anterior permanece como alias.");
      void client.refetchQueries({
        queryKey: ["codigos-publicos", userId, clienteId],
        type: "active",
      });
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado. Repita a mesma tentativa; se houver conflito, procure suporte antes de nova alteração.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  const enviar = (pedido: SubstituicaoCodigo, repeticao = false) => {
    if (!permitido || trava.current) return;
    trava.current = true;
    try {
      const salvo = sessionStorage.getItem(storageKey);
      if (repeticao ? salvo !== JSON.stringify(pedido) : salvo !== null)
        throw new Error("Tentativa local divergente");
      if (!repeticao) sessionStorage.setItem(storageKey, JSON.stringify(pedido));
    } catch {
      trava.current = false;
      setAviso("Não foi possível preservar tentativa; alteração não enviada.");
      return;
    }
    setPendente(pedido);
    setAviso("");
    envio.mutate(pedido);
  };
  if (user?.id !== userId || user.papel !== "superadmin") return null;
  if (permissao.isFetching || permissao.isPending)
    return <output>Verificando permissão de substituição…</output>;
  if (permissao.isError)
    return (
      <p role="alert">
        Não foi possível verificar permissão.{" "}
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (!permitido) return null;
  const fotografia = JSON.stringify({
    userId,
    clienteId,
    tipo,
    ativoId,
    codigoAnterior,
    novo: novo.trim().toUpperCase(),
    motivo: motivo.trim(),
  });
  return (
    <section aria-label="Substituição administrativa de código">
      <h3>Correção excepcional de código</h3>
      <p>O código anterior será preservado como alias. Confirme os dados antes de registrar.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const normalizado = novo.trim().toUpperCase();
          if (normalizado && normalizado === codigoAnterior.trim().toUpperCase()) {
            setAviso("O novo código deve ser diferente do atual.");
            return;
          }
          if (
            pendente ||
            !normalizado ||
            confirmacao !== fotografia ||
            normalizado.length > 200 ||
            /\s/.test(normalizado) ||
            !motivo.trim() ||
            motivo.trim().length > 2000
          ) {
            setAviso("Confira código e motivo.");
            return;
          }
          enviar({
            requestId: crypto.randomUUID(),
            tipo,
            ativoId,
            codigoAnterior,
            codigoNovo: normalizado,
            motivo: motivo.trim(),
          });
        }}
      >
        <p>Código atual conferido: {codigoAnterior}</p>
        <label>
          Novo código{" "}
          <input
            value={novo}
            maxLength={200}
            required
            disabled={!!pendente || envio.isPending}
            onChange={(e) => {
              setNovo(e.target.value);
              setConfirmacao(null);
            }}
          />
        </label>
        <label>
          Motivo{" "}
          <textarea
            value={motivo}
            maxLength={2000}
            required
            disabled={!!pendente || envio.isPending}
            onChange={(e) => {
              setMotivo(e.target.value);
              setConfirmacao(null);
            }}
          />
        </label>
        {confirmacao && confirmacao !== fotografia && (
          <p role="alert">Código ou contexto mudou; confira novamente.</p>
        )}
        <label>
          <input
            type="checkbox"
            checked={confirmacao === fotografia}
            disabled={!!pendente || envio.isPending}
            onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)}
          />{" "}
          Conferi o código atual, o substituto e o motivo.
        </label>
        <button
          type="submit"
          disabled={!!pendente || envio.isPending || confirmacao !== fotografia}
        >
          Confirmar substituição
        </button>
      </form>
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <p>
          Tentativa pendente: {pendente.codigoAnterior} para {pendente.codigoNovo}.{" "}
          <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente, true)}>
            Repetir tentativa
          </button>
        </p>
      )}
      {aviso && <output className="block">{aviso}</output>}
    </section>
  );
}
