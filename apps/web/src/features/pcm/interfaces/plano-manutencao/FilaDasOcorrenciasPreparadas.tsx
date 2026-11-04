import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { IncluirFilaSelecionada } from "./IncluirFilaSelecionada";

const linha = z.object({ tipo: z.enum(["calendario", "visita"]), preparada_id: z.string().uuid(), versao_id: z.string().uuid(),
  rotina_id: z.string().uuid(), alvo_tipo: z.enum(["sistema", "componente", "grupo"]), alvo_id: z.string().uuid(), vencimento_original: z.string().date(),
  ocorrencia_grupo_id: z.string().uuid().nullable(), estado: z.string(), fila_executavel: z.literal(false) }).strict();
type Props = { userId: string; clienteId: string; planoId: string; preparadas: string[] };
export function FilaDasOcorrenciasPreparadas(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.planoId, [...props.preparadas].sort()])} {...props} />;
}
function Conteudo({ userId, clienteId, planoId, preparadas }: Props) {
  const [aberta, setAberta] = useState(false);
  const ids = [...preparadas].map((id) => id.toLowerCase()).sort();
  const unicos = new Set(ids);
  const valida = ids.length > 0 && ids.length <= 775 && ids.length === unicos.size;
  const consulta = useQuery({ queryKey: ["obrigacoes-preparadas-janela", userId, clienteId, planoId, ids], enabled: aberta && valida, retry: false, gcTime: 0,
    queryFn: async ({ signal }) => {
      let cursor: { tipo: "calendario" | "visita"; id: string } | null = null;
      const encontradas: z.infer<typeof linha>[] = [];
      for (let pagina = 0; pagina < 20; pagina++) {
        const antes = await supabase.auth.getUser();
        if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
        const { data, error } = await supabase.schema("pcm").rpc("sso_listar_obrigacoes_preparadas_mediada", { p_cliente_id: clienteId, p_plano_id: planoId, p_apos_tipo: cursor?.tipo ?? null, p_apos_id: cursor?.id ?? null, p_limite: 50 }).abortSignal(signal);
        if (error) throw error;
        const itens = z.array(linha).max(50).parse(data);
        for (const item of itens) {
          if (cursor && (item.tipo < cursor.tipo || (item.tipo === cursor.tipo && item.preparada_id.toLowerCase() <= cursor.id.toLowerCase()))) throw new Error("Página divergente.");
          cursor = { tipo: item.tipo, id: item.preparada_id };
          if (item.tipo === "calendario" && unicos.has(item.preparada_id.toLowerCase())) encontradas.push(item);
        }
        const depois = await supabase.auth.getUser();
        if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
        if (encontradas.length === ids.length) return encontradas;
        if (itens.length < 50) throw new Error("Ocorrência não encontrada no Plano.");
      }
      throw new Error("Limite da conferência excedido.");
    } });
  const conferida = valida && !!consulta.data && !consulta.isFetching && !consulta.isError;
  return <section aria-label="Encaminhar ocorrências da janela à fila"><p>Confira os registros gerados e selecione até 25 para inclusão na fila. A inclusão exige confirmação própria e ocorre um item por vez.</p>
    <button type="button" aria-expanded={aberta} onClick={() => setAberta((a) => !a)}>{aberta ? "Ocultar seleção para fila" : "Selecionar ocorrências para fila"}</button>
    {aberta && !valida && <p role="alert">Os recibos são duplicados ou excedem o limite de conferência. Procure suporte.</p>}
    {aberta && valida && consulta.isFetching && <p role="status">Conferindo ocorrências do Plano…</p>}
    {aberta && valida && consulta.isError && <p role="alert">Não foi possível confirmar todos os registros no Plano. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {aberta && conferida && <IncluirFilaSelecionada userId={userId} clienteId={clienteId} planoId={planoId} itens={consulta.data} carregando={false} />}
  </section>;
}
