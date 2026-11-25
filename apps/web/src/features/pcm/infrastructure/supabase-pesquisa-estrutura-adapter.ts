import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import type { PesquisaEstruturaGateway } from "../application/pesquisa-estrutura-gateway";

const uuid = z.string().guid();
const resultado = z
  .object({
    chave: z.string().max(60),
    tipo: z.enum(["area", "local", "sistema", "equipamento", "componente", "grupo_quantitativo"]),
    id: uuid,
    nome: z.string(),
    codigo: z.string().nullable(),
    area_id: uuid.nullable(),
    local_id: uuid.nullable(),
    sistema_id: uuid.nullable(),
    parent_id: uuid.nullable(),
  })
  .transform((r) => ({
    chave: r.chave,
    tipo: r.tipo,
    id: r.id,
    nome: r.nome,
    codigo: r.codigo,
    areaId: r.area_id,
    localId: r.local_id,
    sistemaId: r.sistema_id,
    parentId: r.parent_id,
  }));
async function conferirSessao(usuario: string, signal?: AbortSignal) {
  const atual = await supabase.auth.getUser();
  if (atual.error || atual.data.user?.id !== usuario || signal?.aborted)
    throw new Error("Sessão alterada.");
}
export const supabasePesquisaEstruturaAdapter: PesquisaEstruturaGateway = {
  async pesquisar(filtro, signal) {
    await conferirSessao(filtro.usuario, signal);
    const consulta = supabase.schema("pcm").rpc("sso_pesquisar_estrutura", {
      p_cliente_id: filtro.clienteId,
      p_busca: filtro.busca,
      p_tipo: filtro.tipo || null,
      p_contexto_tipo: filtro.contexto?.tipo ?? null,
      p_contexto_id: filtro.contexto?.id ?? null,
      p_apos: filtro.apos,
      p_limite: 50,
    });
    const { data, error } = await (signal ? consulta.abortSignal(signal) : consulta);
    await conferirSessao(filtro.usuario, signal);
    if (error) throw error;
    const pagina = z.array(resultado).max(50).parse(data);
    if (
      pagina.some((r) => r.chave !== `${r.tipo}:${r.id}`) ||
      new Set(pagina.map((r) => r.chave)).size !== pagina.length
    )
      throw new Error("Resposta da estrutura divergente.");
    return pagina;
  },
};
