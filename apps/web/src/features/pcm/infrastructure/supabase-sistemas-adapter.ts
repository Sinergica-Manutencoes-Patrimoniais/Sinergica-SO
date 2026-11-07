import { supabase } from "../../../lib/supabase-client";
import { IdentificadorDuplicadoError } from "../application/identificador-ativo";
import type {
  EditarSistemaCommand,
  SistemaCommand,
  SistemaItemOpcao,
  SistemasGateway,
} from "../application/sistemas-gateway";
import { agregarHistoricoSistema } from "../domain/historico-ativo";
import type { OsHistoricoItem } from "../domain/historico-ativo";
import type { Sistema, SistemaItemMembro } from "../domain/sistemas";

interface SistemaRow {
  id: string;
  cliente_id: string;
  area_id: string | null;
  local_id: string | null;
  nome: string;
  categoria_id: string | null;
  categoria: string | null;
  tipo: string | null;
  descricao: string | null;
  ativo: boolean;
  auvo_id: number | null;
  auvo_equipment_id: number | null;
  codigo: string | null;
  auvo_descricao: string | null;
  auvo_sync_status: string | null;
  auvo_sync_error: string | null;
  auvo_synced_at: string | null;
}

interface SistemaItemRow {
  id: string;
  sistema_id: string;
  item_id: string;
}

interface ItemOpcaoRow {
  id: string;
  nome: string;
  client_id: string | null;
}

const SISTEMA_COLS =
  "id,cliente_id,area_id,local_id,nome,categoria_id,categoria,tipo,descricao,ativo,auvo_id,auvo_equipment_id,codigo,auvo_descricao,auvo_sync_status,auvo_sync_error,auvo_synced_at" as const;

function mapSistema(row: SistemaRow): Sistema {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    areaId: row.area_id,
    localId: row.local_id,
    nome: row.nome,
    categoriaId: row.categoria_id,
    categoria: row.categoria,
    tipo: row.tipo,
    descricao: row.descricao,
    ativo: row.ativo,
    auvoId: row.auvo_id,
    auvoEquipmentId: row.auvo_equipment_id,
    codigo: row.codigo,
    auvoDescricao: row.auvo_descricao,
    auvoSyncStatus: row.auvo_sync_status,
    auvoSyncError: row.auvo_sync_error,
    auvoSyncedAt: row.auvo_synced_at,
  };
}

/** E01-S155 AC-6: mesma tradução de `fn_sistemas_normalizar_posicao` do lado dos equipamentos. */
function traduzirErroPosicao(error: { code?: string; message?: string }): never {
  if (error.code === "23505" && error.message?.includes("uq_sistemas_codigo_padrao")) {
    throw new IdentificadorDuplicadoError("");
  }
  if (error.code === "23514" && error.message?.includes("posicao_cliente_divergente")) {
    throw new Error("A Área/Local escolhido é de outro cliente.");
  }
  throw error;
}

export const supabaseSistemasAdapter: SistemasGateway = {
  async listar(clienteId) {
    let query = supabase.schema("pcm").from("sistemas").select(SISTEMA_COLS).is("deleted_at", null);
    if (clienteId) query = query.eq("cliente_id", clienteId);
    const { data, error } = await query.order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as SistemaRow[]).map(mapSistema);
  },

  async listarMembrosDoCliente(clienteId) {
    const { data: sistemas, error: sistemasError } = await supabase
      .schema("pcm")
      .from("sistemas")
      .select("id")
      .eq("cliente_id", clienteId)
      .is("deleted_at", null);
    if (sistemasError) throw sistemasError;
    const sistemaIds = (sistemas ?? []).map((sistema) => sistema.id as string);
    if (sistemaIds.length === 0) return [];
    const { data, error } = await supabase
      .schema("pcm")
      .from("sistema_itens")
      .select("sistema_id,item_id")
      .in("sistema_id", sistemaIds);
    if (error) throw error;
    return (data ?? []).map((membro) => ({
      sistemaId: membro.sistema_id as string,
      itemId: membro.item_id as string,
    }));
  },

  async obter(id) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("sistemas")
      .select(SISTEMA_COLS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSistema(data as SistemaRow) : null;
  },

  async criar(input: SistemaCommand) {
    const cliente = await buscarCliente(input.clienteId);
    const { data, error } = await supabase
      .schema("pcm")
      .from("sistemas")
      .insert({
        cliente_id: input.clienteId,
        // E01-S155: com Local escolhido, area_id não é enviado — o trigger deriva da Área do Local.
        area_id: input.localId ? null : input.areaId,
        local_id: input.localId,
        nome: input.nome,
        codigo: input.codigo,
        categoria_id: input.categoriaId,
        categoria: input.categoria,
        tipo: input.tipo,
        descricao: input.descricao,
        // E01-S153: pré-condição do flip writeEnabled — sem isso o Sistema sobe ao Auvo sem
        // associatedCustomerId (ver registry/sistemas.ts).
        auvo_customer_id: cliente?.auvoId ?? null,
        auvo_sync_status: "pending",
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(SISTEMA_COLS)
      .single();
    if (error) traduzirErroPosicao(error);
    return mapSistema(data as SistemaRow);
  },

  async editar(input: EditarSistemaCommand) {
    if (input.alterarIdentificador) throw new Error("Alteração de código deve usar a jornada de códigos públicos.");
    const { data, error } = await supabase
      .schema("pcm")
      .from("sistemas")
      .update({
        area_id: input.localId ? null : input.areaId,
        local_id: input.localId,
        nome: input.nome,
        categoria_id: input.categoriaId,
        categoria: input.categoria,
        tipo: input.tipo,
        descricao: input.descricao,
        auvo_sync_status: "pending",
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(SISTEMA_COLS)
      .single();
    if (error) traduzirErroPosicao(error);
    return mapSistema(data as SistemaRow);
  },

  async desativar(id, userId) {
    const agora = new Date().toISOString();
    const { error } = await supabase
      .schema("pcm")
      .from("sistemas")
      .update({
        ativo: false,
        deleted_at: agora,
        auvo_sync_status: "pending",
        updated_at: agora,
        updated_by: userId,
      })
      .eq("id", id);
    if (error) throw error;
  },

  async listarItensDisponiveis(clienteId): Promise<SistemaItemOpcao[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("equipamentos")
      .select("id,nome,client_id")
      .eq("client_id", clienteId)
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    const itens = (data ?? []) as ItemOpcaoRow[];
    if (itens.length === 0) return [];

    // E01-S154 AC-4: um Componente pertence a no máximo 1 Sistema — resolve em quais itens desta
    // lista já têm dono, pra UI desabilitar o checkbox deles em qualquer OUTRO Sistema.
    const { data: membrosData, error: membrosError } = await supabase
      .schema("pcm")
      .from("sistema_itens")
      .select("item_id,sistema_id")
      .in(
        "item_id",
        itens.map((item) => item.id),
      );
    if (membrosError) throw membrosError;
    const sistemaIdPorItem = new Map(
      (membrosData ?? []).map((m) => [m.item_id as string, m.sistema_id as string]),
    );
    const sistemaIds = [...new Set(sistemaIdPorItem.values())];
    let nomePorSistema = new Map<string, string>();
    if (sistemaIds.length > 0) {
      const { data: sistemasData, error: sistemasError } = await supabase
        .schema("pcm")
        .from("sistemas")
        .select("id,nome")
        .in("id", sistemaIds);
      if (sistemasError) throw sistemasError;
      nomePorSistema = new Map((sistemasData ?? []).map((s) => [s.id as string, s.nome as string]));
    }

    return itens.map((row) => {
      const sistemaId = sistemaIdPorItem.get(row.id) ?? null;
      return {
        id: row.id,
        nome: row.nome,
        clientId: row.client_id,
        sistemaId,
        sistemaNome: sistemaId ? (nomePorSistema.get(sistemaId) ?? null) : null,
      };
    });
  },

  async listarItensDoSistema(sistemaId): Promise<SistemaItemMembro[]> {
    const [membros, itens] = await Promise.all([
      supabase
        .schema("pcm")
        .from("sistema_itens")
        .select("id,sistema_id,item_id")
        .eq("sistema_id", sistemaId),
      supabase
        .schema("pcm")
        .from("equipamentos")
        .select("id,nome,client_id")
        .is("deleted_at", null),
    ]);
    if (membros.error) throw membros.error;
    if (itens.error) throw itens.error;
    const itensMap = new Map((itens.data ?? []).map((i) => [i.id as string, i as ItemOpcaoRow]));
    return ((membros.data ?? []) as SistemaItemRow[]).map((row) => {
      const item = itensMap.get(row.item_id);
      return {
        id: row.id,
        sistemaId: row.sistema_id,
        itemId: row.item_id,
        itemNome: item?.nome ?? "Item removido",
        itemClienteId: item?.client_id ?? "",
      };
    });
  },

  async adicionarItem(sistemaId, itemId, userId): Promise<SistemaItemMembro> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("sistema_itens")
      .insert({ sistema_id: sistemaId, item_id: itemId, created_by: userId })
      .select("id,sistema_id,item_id")
      .single();
    if (error) throw error;
    const item = await supabase
      .schema("pcm")
      .from("equipamentos")
      .select("id,nome,client_id")
      .eq("id", itemId)
      .maybeSingle();
    const row = data as SistemaItemRow;
    return {
      id: row.id,
      sistemaId: row.sistema_id,
      itemId: row.item_id,
      itemNome: (item.data?.nome as string | undefined) ?? "",
      itemClienteId: (item.data?.client_id as string | undefined) ?? "",
    };
  },

  async removerItem(sistemaId, itemId) {
    const { error } = await supabase
      .schema("pcm")
      .from("sistema_itens")
      .delete()
      .eq("sistema_id", sistemaId)
      .eq("item_id", itemId);
    if (error) throw error;
  },

  async listarHistoricoOsSistema(sistemaId): Promise<OsHistoricoItem[]> {
    // AC-2: duas fontes — OS vinculadas ao Sistema em si (E01-S76/S85 — sobe como Equipment) e OS
    // vinculadas a qualquer um dos seus Componentes/Itens membros. `agregarHistoricoSistema`
    // (domínio) junta e deduplica — a mesma OS pode aparecer nas duas fontes.
    const [sistemaRes, itemIds] = await Promise.all([
      supabase
        .schema("pcm")
        .from("sistemas")
        .select("auvo_equipment_id,cliente_id")
        .eq("id", sistemaId)
        .maybeSingle(),
      listarIdsHistoricoSistema(sistemaId),
    ]);
    if (sistemaRes.error) throw sistemaRes.error;
    const clienteId = sistemaRes.data?.cliente_id as string | null | undefined;
    if (!clienteId) throw new Error("Sistema indisponível ou sem Cliente definido.");

    let auvoEquipmentIdsComponentes: number[] = [];
    for (let inicio = 0; inicio < itemIds.length; inicio += 200) {
      const { data: itens, error: itensErro } = await supabase
        .schema("pcm")
        .from("equipamentos")
        .select("auvo_equipment_id")
        .eq("client_id", clienteId)
        .in("id", itemIds.slice(inicio, inicio + 200));
      if (itensErro) throw itensErro;
      auvoEquipmentIdsComponentes.push(...(itens ?? [])
        .map((row) => row.auvo_equipment_id as number | null)
        .filter((id): id is number => id != null));
    }
    const auvoEquipmentIdSistema =
      (sistemaRes.data?.auvo_equipment_id as number | null | undefined) ?? null;

    const [historicoSistema, historicoComponentes] = await Promise.all([
      buscarHistoricoPorAuvoIds(auvoEquipmentIdSistema == null ? [] : [auvoEquipmentIdSistema], clienteId),
      buscarHistoricoPorAuvoIds(auvoEquipmentIdsComponentes, clienteId),
    ]);
    return agregarHistoricoSistema([historicoSistema, historicoComponentes]);
  },
};

async function listarIdsHistoricoSistema(sistemaId: string): Promise<string[]> {
  const itens: string[] = [];
  let cursor: string | null = null;
  let total: number | null = null;
  for (;;) {
    let consulta = supabase.schema("pcm").from("sistema_itens").select("item_id", { count: "exact" })
      .eq("sistema_id", sistemaId).order("item_id").limit(500);
    if (cursor) consulta = consulta.gt("item_id", cursor);
    const { data, error, count } = await consulta;
    if (error) throw error;
    if (count === null || count > 50_000) throw new Error("Lista de Componentes excede o limite de consulta.");
    if (total === null) total = count;
    const pagina = data ?? [];
    for (const item of pagina) {
      if (typeof item.item_id !== "string" || (cursor !== null && item.item_id <= cursor)) throw new Error("Lista de Componentes inconsistente.");
      cursor = item.item_id; itens.push(item.item_id);
    }
    if (itens.length > total || itens.length > 50_000) throw new Error("Lista de Componentes alterada durante a consulta.");
    if (pagina.length < 500) break;
  }
  if (itens.length !== total) throw new Error("Lista de Componentes alterada durante a consulta.");
  return itens;
}

async function buscarCliente(id: string): Promise<{ id: string; auvoId: number | null } | null> {
  const { data, error } = await supabase
    .schema("pcm")
    .from("clientes")
    .select("id,auvo_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id as string, auvoId: (data.auvo_id as number | null) ?? null };
}

export async function buscarHistoricoPorAuvoIds(auvoEquipmentIds: number[], clienteId: string): Promise<OsHistoricoItem[]> {
  const ids = [...new Set(auvoEquipmentIds)];
  if (ids.length === 0) return [];

  const osEncontradas = new Set<string>();
  const limite = 50_000;
  let totalVinculos = 0;
  for (let inicio = 0; inicio < ids.length; inicio += 200) {
    const lote = ids.slice(inicio, inicio + 200);
    let cursor: string | null = null;
    let total: number | null = null;
    let lidos = 0;
    do {
      let consulta = supabase.schema("pcm").from("os_equipamentos_auvo")
        .select("id,ordem_servico_id", { count: "exact" }).in("auvo_equipment_id", lote).order("id").limit(500);
      if (cursor) consulta = consulta.gt("id", cursor);
      const { data, error, count } = await consulta;
      if (error) throw error;
      if (count === null || count > limite || (cursor === null && count + totalVinculos > limite)) throw new Error("Histórico de OS excede o limite de consulta.");
      if (cursor === null) total = count;
      const pagina = data ?? [];
      for (const item of pagina) {
        if (typeof item.id !== "string" || typeof item.ordem_servico_id !== "string" || (cursor !== null && item.id <= cursor)) throw new Error("Histórico de OS inconsistente.");
        cursor = item.id;
        osEncontradas.add(item.ordem_servico_id);
        lidos++;
      }
      if (lidos > limite || lidos > (total ?? 0)) throw new Error("Histórico de OS alterado durante a consulta.");
      if (pagina.length < 500) break;
    } while (true);
    if (lidos !== total) throw new Error("Histórico de OS alterado durante a consulta.");
    totalVinculos += lidos;
  }
  const osIds = [...osEncontradas];
  if (osIds.length === 0) return [];

  const ordens: Array<{
      id: string;
      numero: string;
      categoria: string | null;
      status: string | null;
      data_agendada: string | null;
      created_at: string | null;
    }> = [];
  for (let inicio = 0; inicio < osIds.length; inicio += 200) {
    const { data, error } = await supabase.schema("pcm").from("ordens_servico")
      .select("id,numero,categoria,status,data_agendada,created_at")
      .eq("client_id", clienteId).in("id", osIds.slice(inicio, inicio + 200)).is("deleted_at", null);
    if (error) throw error;
    ordens.push(...(data ?? []));
  }
  ordens.sort((a, b) => (b.created_at ? Date.parse(b.created_at) : Number.NEGATIVE_INFINITY) -
    (a.created_at ? Date.parse(a.created_at) : Number.NEGATIVE_INFINITY) || a.id.localeCompare(b.id));
  return ordens.map((o) => ({
    osId: o.id,
    numero: o.numero,
    categoria: o.categoria,
    status: o.status,
    data: o.data_agendada ?? o.created_at,
  }));
}
