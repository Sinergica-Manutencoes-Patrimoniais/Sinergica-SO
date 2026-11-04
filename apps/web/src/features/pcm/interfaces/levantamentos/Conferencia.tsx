import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";

type Pedido = {
  requestId: string;
  loteId: string;
  chave: string;
  revisao: number;
  observacao: string;
};
const pedidoSchema = z.object({ requestId: z.string().uuid(), loteId: z.string().uuid(), chave: z.string().min(1).max(200),
  revisao: z.number().int().positive(), observacao: z.string().trim().min(1).max(2000) }).strict();

/** Anotação de conferência não equivale à aprovação nem incorpora cadastros. */
export function Conferencia({
  userId,
  clienteId,
  loteId,
  chave,
  revisao,
}: { userId: string; clienteId: string; loteId: string; chave: string; revisao: number }) {
  const chaveLocal = `sso-conferencia:${JSON.stringify([userId, clienteId, loteId, chave])}`;
  const client = useQueryClient();
  const [observacao, setObservacao] = useState("");
  const [aviso, setAviso] = useState("");
  const trava = useRef(false);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chaveLocal);
      if (!salvo) return null;
      const p = pedidoSchema.parse(JSON.parse(salvo));
      return p.loteId === loteId && p.chave === chave ? p : "invalido";
    } catch {
      return "invalido";
    }
  });
  const permissao = useQuery({
    queryKey: ["levantamentos", userId, clienteId, "conferencia-permissao"],
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const autorizada = await supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.aprovar", clienteId);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return autorizada;
    },
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const historico = useInfiniteQuery({
    queryKey: ["levantamentos", userId, clienteId, loteId, chave, "conferencias", revisao],
    initialPageParam: null as number | null,
    queryFn: async ({pageParam, signal}) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_conferencias_levantamento", {
          p_lote_id: loteId,
          p_chave_linha: chave,
          p_apos_revision: pageParam,
          p_limite: 100,
        }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Histórico inválido.");
      if (data.length > 100) throw new Error("Histórico inválido.");
      let anterior = pageParam ?? 0;
      const pagina = data.map((v) => {
        if (
          typeof v.id !== "string" ||
          typeof v.observacao !== "string" ||
          !Number.isSafeInteger(v.revisao_lote) || v.revisao_lote <= anterior
        )
          throw new Error("Histórico inválido.");
        anterior = v.revisao_lote;
        return {
          id: v.id as string,
          observacao: v.observacao as string,
          revisao: v.revisao_lote as number,
        };
      });
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    enabled: permitido,
    gcTime: 0,
    getNextPageParam: (pagina) => pagina.length === 100 ? pagina.at(-1)?.revisao : undefined,
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(chaveLocal) !== JSON.stringify(p)) throw new Error("Sessão ou tentativa alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_anotar_conferencia_levantamento", {
          p_request_id: p.requestId,
          p_lote_id: p.loteId,
          p_chave_linha: p.chave,
          p_expected_revision: p.revisao,
          p_observacao: p.observacao,
        });
      if (error) throw error;
      if (
        !data ||
        data.aggregateId !== loteId ||
        data.requestId !== p.requestId ||
        data.revision !== p.revisao + 1 ||
        data.state !== "pendente"
      )
        throw new Error("Resposta inválida.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
    },
    onSuccess: async (_resposta, confirmado) => {
      try {
        await client.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId, "lotes"], refetchType: "none" });
        const atual = await supabase.auth.getUser();
        if (atual.error || atual.data.user?.id !== userId) throw new Error("Sessão alterada.");
        if (sessionStorage.getItem(chaveLocal) !== JSON.stringify(confirmado)) throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(chaveLocal);
      } catch {
        setAviso("Não foi possível concluir a conferência da sessão ou tentativa. Consulte o recibo.");
        return;
      }
      setPendente(null);
      setObservacao("");
      setAviso("Observação registrada; linha permanece pendente.");
      await client.refetchQueries({ queryKey: ["levantamentos", userId, clienteId, "lotes"], type: "active" });
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado. Repita a mesma tentativa ou procure suporte se houver conflito de revisão.",
      ),
    onSettled: () => { trava.current = false; },
  });
  const repetir = (p: Pedido) => {
    if (trava.current || !permitido) return;
    try {
      pedidoSchema.parse(p);
      const existente = sessionStorage.getItem(chaveLocal);
      if (existente !== null && existente !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      if (existente === null && pendente) throw new Error("Tentativa não encontrada.");
      if (existente === null) sessionStorage.setItem(chaveLocal, JSON.stringify(p));
    } catch {
      setAviso("Não foi possível preservar tentativa. Nada foi enviado.");
      return;
    }
    setPendente(p);
    setAviso("");
    trava.current = true;
    envio.mutate(p);
  };
  if (permissao.isFetching || permissao.isPending)
    return <output>Verificando permissão de conferência…</output>;
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
  return (
    <section aria-label={`Conferência da linha ${chave}`}>
      <p>Observações são provisórias e não aprovam nem incorporam esta linha.</p>
      {historico.isFetching && <output>Carregando observações…</output>}
      {historico.isError && (
        <p role="alert">
          Não foi possível carregar observações.{" "}
          <button type="button" onClick={() => void historico.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!historico.isFetching && !historico.isError && (
        <ul>
          {historico.data?.pages.flat().map((item) => (
            <li key={item.id}>
              Revisão {item.revisao}: {item.observacao}
            </li>
          ))}
        </ul>
      )}
      {historico.hasNextPage && !historico.isError && <button type="button" disabled={historico.isFetching} onClick={() => void historico.fetchNextPage()}>Mais observações</button>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pendente && observacao.trim())
            repetir({
              requestId: crypto.randomUUID(),
              loteId,
              chave,
              revisao,
              observacao: observacao.trim(),
            });
        }}
      >
        <label>
          Observação de conferência{" "}
          <textarea
            maxLength={2000}
            required
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            disabled={!!pendente || envio.isPending}
          />
        </label>
        <button type="submit" disabled={!!pendente || envio.isPending}>
          Registrar observação
        </button>
      </form>
      {pendente === "invalido" && (
        <p role="alert">Tentativa local ilegível. Procure suporte antes de registrar novamente.</p>
      )}
      {pendente && pendente !== "invalido" && (
        <p>
          Tentativa pendente: {pendente.observacao}{" "}
          <button type="button" disabled={envio.isPending} onClick={() => repetir(pendente)}>
            Repetir tentativa
          </button>
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}
