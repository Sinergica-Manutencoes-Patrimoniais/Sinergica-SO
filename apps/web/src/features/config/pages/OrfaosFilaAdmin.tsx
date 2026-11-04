import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const resultado = z.object({ escopo: z.literal("global_administrativo_sistemas_e_equipamentos"), considerados: z.number().int().nonnegative().max(1000), limite: z.literal(1000), truncado: z.boolean(), origemAusente: z.number().int().nonnegative(), clienteAusente: z.number().int().nonnegative(), outrasEntidades: z.literal("nao_avaliadas"), estadoRemoto: z.literal("desconhecido") }).strict();
export function OrfaosFilaAdmin({ userId }: { userId: string }) {
  const consulta = useQuery({ queryKey: ["orfaos-fila-administrativo", userId], gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_contar_orfaos_fila_admin").abortSignal(signal); if (error) throw error; return resultado.parse(data); } });
  return <section aria-label="Diagnóstico administrativo de órfãos da fila" className="rounded-md border border-line p-4"><h2>Diagnóstico administrativo global da fila</h2>
    <p>Somente Sistemas e Equipamentos. Outras entidades não foram avaliadas; estado remoto desconhecido. Nenhuma fila é alterada.</p>
    {consulta.isFetching && <output>Consultando amostra...</output>}{consulta.isError && <p role="alert">Diagnóstico indisponível ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <><p>Origem ausente: {consulta.data.origemAusente} · Cliente ausente: {consulta.data.clienteAusente}.</p><p>{consulta.data.truncado ? `Amostra truncada em ${consulta.data.limite} itens; não representa o total.` : `${consulta.data.considerados} itens examinados no recorte de possíveis órfãos.`}</p></>}
  </section>;
}
