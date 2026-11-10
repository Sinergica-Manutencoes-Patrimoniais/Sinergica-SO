import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";

const pedidoSchema = z
  .object({
    requestId: z.string().guid(),
    loteId: z.string().guid(),
    chave: z
      .string()
      .min(1)
      .max(200)
      .refine((v) => v.trim().length > 0),
    revisao: z.number().int().positive(),
    motivo: z
      .string()
      .min(1)
      .max(2000)
      .refine((v) => v.trim().length > 0),
  })
  .strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; loteId: string; chave: string; revisao: number };
export function RejeicaoLevantamento(props: Props) {
  if (import.meta.env.VITE_SSO_REJEICAO_LEVANTAMENTOS_ENABLED !== "true") return null;
  return (
    <Conteudo
      key={JSON.stringify([props.userId, props.clienteId, props.loteId, props.chave])}
      {...props}
    />
  );
}
function Conteudo({ userId, clienteId, loteId, chave, revisao }: Props) {
  const chaveLocal = `sso-rejeicao-levantamento:${JSON.stringify([userId, clienteId, loteId, chave])}`;
  const [recuperacao] = useState(() => {
    try {
      const valor = sessionStorage.getItem(chaveLocal);
      const pedido = valor ? pedidoSchema.parse(JSON.parse(valor)) : null;
      if (pedido && (pedido.loteId !== loteId || pedido.chave !== chave))
        throw new Error("Contexto divergente.");
      return { pedido, falhou: false };
    } catch {
      return { pedido: null, falhou: true };
    }
  });
  const [pendente, setPendente] = useState(recuperacao.pedido);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  const client = useQueryClient();
  const permissao = useQuery({
    queryKey: ["levantamentos", userId, clienteId, "rejeicao-permissao"],
    gcTime: 0,
    refetchOnWindowFocus: true,
    queryFn: () => supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.aprovar", clienteId),
  });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  async function enviar(pedido: Pedido) {
    if (!permitido || enviando.current) return;
    enviando.current = true;
    setOcupado(true);
    setErro("");
    try {
      const { data, error } = await supabase.schema("pcm").rpc("sso_rejeitar_linha_autorizado", {
        p_request_id: pedido.requestId,
        p_lote_id: pedido.loteId,
        p_expected_revision: pedido.revisao,
        p_chave: pedido.chave,
        p_motivo: pedido.motivo,
      });
      if (error) throw error;
      if (
        !data ||
        data.aggregateId !== pedido.loteId ||
        data.requestId !== pedido.requestId ||
        data.revision !== pedido.revisao + 1 ||
        data.state !== "pendente"
      )
        throw new Error("Resposta inválida.");
      if (sessionStorage.getItem(chaveLocal) !== JSON.stringify(pedido))
        throw new Error("Operação guardada divergente.");
      sessionStorage.removeItem(chaveLocal);
      setPendente(null);
      setMotivo("");
      await client.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId, "lotes"] });
    } catch {
      setErro(
        "Não foi possível confirmar a rejeição. Tente com os mesmos dados ou consulte suporte.",
      );
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  function iniciar() {
    if (!permitido || pendente || recuperacao.falhou || enviando.current) return;
    try {
      const pedido = pedidoSchema.parse({
        requestId: crypto.randomUUID(),
        loteId,
        chave,
        revisao,
        motivo,
      });
      if (sessionStorage.getItem(chaveLocal) !== null) throw new Error("Operação pendente.");
      sessionStorage.setItem(chaveLocal, JSON.stringify(pedido));
      setPendente(pedido);
      void enviar(pedido);
    } catch {
      setErro("Informe motivo e confira o armazenamento antes de continuar.");
    }
  }
  if (permissao.isFetching || permissao.isPending)
    return <output>Verificando acesso à decisão…</output>;
  if (permissao.isError)
    return (
      <p role="alert">
        Não foi possível verificar acesso.{" "}
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (!permitido) return null;
  return (
    <section aria-label={`Rejeitar linha ${chave}`}>
      <p>Rejeição registra decisão de conferência e não altera cadastro oficial.</p>
      {recuperacao.falhou && <p role="alert">Operação guardada inválida. Consulte suporte.</p>}
      {erro && <p role="alert">{erro}</p>}
      {pendente ? (
        <button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>
          Repetir rejeição
        </button>
      ) : (
        !recuperacao.falhou && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              iniciar();
            }}
          >
            <label>
              Motivo da rejeição
              <textarea
                required
                maxLength={2000}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>
            <button type="submit" disabled={ocupado}>
              Rejeitar linha
            </button>
          </form>
        )
      )}
    </section>
  );
}
