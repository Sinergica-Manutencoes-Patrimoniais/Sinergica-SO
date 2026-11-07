import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";

const linha = z.object({ id: z.string().guid(), entidade: z.string(), objeto_id: z.string().guid(), operacao: z.string(), estado: z.string(), estado_fonte: z.enum(["pending", "processing", "error", "sent"]), tentativas: z.number().int().nonnegative(), enfileirado_em: z.string(), enviado_em: z.string().nullable() }).strict();
const celula = (valor: string | number | null) => `"${(`'${valor ?? ""}`).replaceAll('"', '""')}"`;
type Props = { userId: string; clienteId: string; estado: string };
export function ExportarFila(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.estado])} {...props} />;
}
function Conteudo({ userId, clienteId, estado }: Props) {
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const ativo = useRef(false);
  useEffect(() => { ativo.current = true; return () => { ativo.current = false; }; }, []);
  const exportar = async () => {
    if (ocupado) return;
    setOcupado(true); setMensagem("");
    try {
      const sessaoInicial = await supabase.auth.getUser();
      if (!ativo.current) return;
      if (sessaoInicial.error || sessaoInicial.data.user?.id !== userId) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_outbox_reconciliacao_filtrada", { p_cliente_id: clienteId, p_estado: estado || null, p_apos: null, p_limite: 100 });
      if (!ativo.current) return;
      if (error) throw error;
      const linhas = z.array(linha).max(100).parse(data);
      const primeiraSessao = await supabase.auth.getUser();
      if (!ativo.current) return;
      if (primeiraSessao.error || primeiraSessao.data.user?.id !== userId) throw new Error("Sessão alterada");
      if (!await supabaseCapacidadesSsoAdapter.autorizarAcao("integracao.reconciliar", clienteId)) throw new Error("Acesso revogado");
      if (!ativo.current) return;
      const sessaoAtual = await supabase.auth.getUser();
      if (!ativo.current) return;
      if (sessaoAtual.error || sessaoAtual.data.user?.id !== userId) throw new Error("Sessão alterada");
      const cabecalho = ["entidade", "objeto", "operacao", "estado_fila", "classificacao", "tentativas", "enfileirado_em", "enviado_em"];
      const csv = [cabecalho.map(celula).join(","), ...linhas.map((x) => [x.entidade, x.objeto_id, x.operacao, x.estado_fonte, x.estado, x.tentativas, x.enfileirado_em, x.enviado_em].map(celula).join(","))].join("\r\n");
      const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
      try { const a = document.createElement("a"); a.href = url; a.download = "diagnostico-fila-primeira-pagina.csv"; a.click(); }
      finally { URL.revokeObjectURL(url); }
      setMensagem(`Exportados ${linhas.length} itens da primeira página; o resultado pode não conter toda a fila.`);
    } catch { if (ativo.current) setMensagem("Não foi possível exportar. Verifique o acesso e tente novamente."); }
    finally { if (ativo.current) setOcupado(false); }
  };
  return <div><button type="button" disabled={ocupado} onClick={() => void exportar()}>Exportar primeira página CSV (até 100)</button>{mensagem && <p role="status">{mensagem}</p>}</div>;
}
