import { supabase } from "../../../lib/supabase-client";
import type {
  IdentificadorAtivoGateway,
  NiveisIdentificador,
  NivelComSigla,
} from "../application/identificador-ativo-gateway";
import type { NivelIdentificador } from "../domain/identificador-ativo";

interface NivelRow {
  id: string;
  nome: string;
  sigla: string | null;
}

interface LocalRow extends NivelRow {
  area_id: string;
  parent_id: string | null;
}

const NIVEL_COLS = "id,nome,sigla" as const;
const LOCAL_COLS = "id,nome,sigla,area_id,parent_id" as const;

const TABELA_POR_NIVEL: Record<
  NivelComSigla,
  "clientes" | "areas" | "locais" | "equipamento_categorias"
> = {
  cliente: "clientes",
  area: "areas",
  local: "locais",
  categoria: "equipamento_categorias",
};

function mapNivel(row: NivelRow): NivelIdentificador {
  return { id: row.id, nome: row.nome, sigla: row.sigla };
}

function erroSigla(error: { code?: string }): never {
  if (error.code === "23505") throw new Error("Sigla já usada neste nível.");
  throw error;
}

function obrigatorio<T>(valor: T | null, mensagem: string): T {
  if (valor === null) throw new Error(mensagem);
  return valor;
}

export const supabaseIdentificadorAtivoAdapter: IdentificadorAtivoGateway = {
  async obterNiveis(input): Promise<NiveisIdentificador> {
    const [
      { data: cliente, error: erroCliente },
      { data: categoria, error: erroCategoria },
      local,
    ] = await Promise.all([
      supabase
        .schema("pcm")
        .from("clientes")
        .select(NIVEL_COLS)
        .eq("id", input.clienteId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .schema("pcm")
        .from("equipamento_categorias")
        .select(NIVEL_COLS)
        .eq("id", input.categoriaId)
        .is("deleted_at", null)
        .maybeSingle(),
      input.localId
        ? supabase
            .schema("pcm")
            .from("locais")
            .select(LOCAL_COLS)
            .eq("id", input.localId)
            .is("deleted_at", null)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (erroCliente) throw erroCliente;
    if (erroCategoria) throw erroCategoria;
    if (local.error) throw local.error;

    const localSelecionado = local.data as LocalRow | null;
    const areaId = localSelecionado?.area_id ?? input.areaId;
    if (input.areaId && localSelecionado && input.areaId !== localSelecionado.area_id) {
      throw new Error("Local não pertence à Área informada.");
    }

    const { data: area, error: erroArea } = areaId
      ? await supabase
          .schema("pcm")
          .from("areas")
          .select(NIVEL_COLS)
          .eq("id", areaId)
          .eq("cliente_id", input.clienteId)
          .is("deleted_at", null)
          .maybeSingle()
      : { data: null, error: null };
    if (erroArea) throw erroArea;

    const locais: NivelIdentificador[] = [];
    if (localSelecionado) {
      const { data: locaisDaArea, error: erroLocais } = await supabase
        .schema("pcm")
        .from("locais")
        .select(LOCAL_COLS)
        .eq("area_id", localSelecionado.area_id)
        .is("deleted_at", null);
      if (erroLocais) throw erroLocais;

      const porId = new Map(((locaisDaArea ?? []) as LocalRow[]).map((item) => [item.id, item]));
      let cursor: string | null = localSelecionado.id;
      while (cursor !== null) {
        const item: LocalRow = obrigatorio(porId.get(cursor) ?? null, "Cadeia de Local inválida.");
        locais.unshift(mapNivel(item));
        cursor = item.parent_id;
      }
    }

    return {
      cliente: mapNivel(obrigatorio(cliente as NivelRow | null, "Cliente não encontrado.")),
      area: area ? mapNivel(area as NivelRow) : null,
      locais,
      categoria: mapNivel(obrigatorio(categoria as NivelRow | null, "Categoria não encontrada.")),
    };
  },

  async definirSigla(nivel, id, sigla, userId) {
    const { error } = await supabase
      .schema("pcm")
      .from(TABELA_POR_NIVEL[nivel])
      .update({ sigla, updated_at: new Date().toISOString(), updated_by: userId })
      .eq("id", id);
    if (error) erroSigla(error);
  },

  async proximoSequencial(prefixo) {
    const { data, error } = await supabase
      .schema("pcm")
      .rpc("fn_proximo_sequencial_identificador", { p_prefixo: prefixo });
    if (error) throw error;
    return data as string;
  },
};
