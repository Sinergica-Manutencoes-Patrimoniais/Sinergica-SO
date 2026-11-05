import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { IncluirFilaSelecionada } from "./IncluirFilaSelecionada";

const linha = z
  .object({
    tipo: z.enum(["calendario", "visita"]),
    preparada_id: z.string().uuid(),
    versao_id: z.string().uuid(),
    rotina_id: z.string().uuid(),
    alvo_tipo: z.enum(["sistema", "componente", "grupo"]),
    alvo_id: z.string().uuid(),
    vencimento_original: z.string().date(),
    ocorrencia_grupo_id: z.string().uuid().nullable(),
    estado: z.string(),
    fila_executavel: z.literal(false),
  })
  .strict();
type Props = { userId: string; clienteId: string; planoId: string; preparadas: string[] };
export function FilaDasOcorrenciasPreparadas(props: Props) {
  return (
    <Conteudo
      key={JSON.stringify([
        props.userId,
        props.clienteId,
        props.planoId,
        [...props.preparadas].sort(),
      ])}
      {...props}
    />
  );
}
function Conteudo({ userId, clienteId, planoId, preparadas }: Props) {
  const [aberta, setAberta] = useState(false);
  const ids = [...preparadas].map((id) => id.toLowerCase()).sort();
  const unicos = new Set(ids);
  const valida = ids.length > 0 && ids.length <= 775 && ids.length === unicos.size;
  const consulta = useQuery({
    queryKey: ["obrigacoes-preparadas-janela", userId, clienteId, planoId, ids],
    enabled: aberta && valida,
    retry: false,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_obrigacoes_calendario_por_ids", {
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_preparadas: ids,
        })
        .abortSignal(signal);
      if (error) throw error;
      const itens = z.array(linha).max(775).parse(data);
      if (
        itens.length !== ids.length ||
        itens.some(
          (item, i) => item.tipo !== "calendario" || item.preparada_id.toLowerCase() !== ids[i],
        )
      )
        throw new Error("Registros incompletos ou divergentes.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return itens;
    },
  });
  const conferida = valida && !!consulta.data && !consulta.isFetching && !consulta.isError;
  return (
    <section aria-label="Encaminhar ocorrências da janela à fila">
      <p>
        Confira os registros gerados e selecione até 25 para inclusão na fila. A inclusão exige
        confirmação própria e ocorre um item por vez.
      </p>
      <button type="button" aria-expanded={aberta} onClick={() => setAberta((a) => !a)}>
        {aberta ? "Ocultar seleção para fila" : "Selecionar ocorrências para fila"}
      </button>
      {aberta && !valida && (
        <p role="alert">
          Os recibos são duplicados ou excedem o limite de conferência. Procure suporte.
        </p>
      )}
      {aberta && valida && consulta.isFetching && (
        <p role="status">Conferindo ocorrências do Plano…</p>
      )}
      {aberta && valida && consulta.isError && (
        <p role="alert">
          Não foi possível confirmar todos os registros no Plano.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {aberta && conferida && (
        <IncluirFilaSelecionada
          userId={userId}
          clienteId={clienteId}
          planoId={planoId}
          itens={consulta.data}
          carregando={false}
        />
      )}
    </section>
  );
}
