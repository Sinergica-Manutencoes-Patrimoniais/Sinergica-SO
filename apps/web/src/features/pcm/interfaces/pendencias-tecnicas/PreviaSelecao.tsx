import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
type Props = { userId: string; clienteId: string; selecionadas: Record<string, number> };
const linha = z.object({ pendencia_id: z.string().uuid(), revisao_solicitada: z.number().int().positive(), revisao_atual: z.number().int().positive().nullable(), situacao: z.enum(["indisponivel", "revisao_alterada", "nao_aberta", "ja_composta", "sem_conflito_observado"]) }).strict();
export function PreviaSelecao(props: Props) {
  if (import.meta.env.VITE_SSO_PREVIA_SELECAO_COMPOSICAO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}
function Conteudo({ userId, clienteId, selecionadas }: Props) {
  const itens = Object.entries(selecionadas).map(([id, revision]) => ({ id, revision })).sort((a, b) => a.id.localeCompare(b.id));
  const q = useQuery({ queryKey: ["backlog-previa-selecao", userId, clienteId, itens], enabled: false, gcTime: 0,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_previa_selecao_composicao", { p_cliente_id: clienteId, p_itens: itens }).abortSignal(signal);
      if (error) throw error;
      const r = z.array(linha).max(100).parse(data);
      const divergente = r.some(x => {
        if (!itens.some(i => i.id === x.pendencia_id && i.revision === x.revisao_solicitada)) return true;
        if (x.situacao === "indisponivel") return x.revisao_atual !== null;
        if (x.situacao === "revisao_alterada") return x.revisao_atual === null || x.revisao_atual === x.revisao_solicitada;
        return x.revisao_atual !== x.revisao_solicitada;
      });
      if (r.length !== itens.length || new Set(r.map(x => x.pendencia_id)).size !== r.length || divergente) throw new Error("Prévia divergente");
      return r;
    } });
  return <section><h4>Conferência da seleção</h4><p>Prévia não garante composição: dados podem mudar, e o servidor verificará novamente ao enviar.</p>
    <button type="button" disabled={itens.length < 1 || itens.length > 100 || q.isFetching} onClick={() => void q.refetch()}>Verificar conflitos</button>
    {itens.length > 100 && <p role="alert">Selecione no máximo 100 Pendências.</p>}{q.isFetching && <output>Conferindo…</output>}{q.isError && <p role="alert">Prévia indisponível. Tente novamente.</p>}
    {q.data && !q.isFetching && !q.isError && <ul>{q.data.map(p => <li key={p.pendencia_id}>Pendência {p.pendencia_id} · revisão selecionada {p.revisao_solicitada} · {p.revisao_atual === null ? "revisão indisponível" : `revisão atual ${p.revisao_atual}`} · {p.situacao}</li>)}</ul>}
  </section>;
}
