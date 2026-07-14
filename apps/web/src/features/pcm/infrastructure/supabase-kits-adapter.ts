import { supabase } from "../../../lib/supabase-client";
import type {
  AtribuirKitCommand,
  CriarKitCommand,
  DesativarKitCommand,
  DevolverKitCommand,
  EditarKitCommand,
  KitsGateway,
} from "../application/kits-gateway";
import type { KitAtribuicaoAtiva, KitItem } from "../domain/kits";

interface KitRow {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

interface KitItemRow {
  kit_id: string;
  ferramenta_id: string;
  quantidade: number;
}

async function montarItens(kitIds: string[]): Promise<Map<string, KitItem["itens"]>> {
  if (kitIds.length === 0) return new Map();
  const [itens, ferramentas] = await Promise.all([
    supabase
      .schema("pcm")
      .from("kit_itens")
      .select("kit_id,ferramenta_id,quantidade")
      .in("kit_id", kitIds),
    supabase.schema("pcm").from("ferramentas").select("id,nome").is("deleted_at", null),
  ]);
  if (itens.error) throw itens.error;
  if (ferramentas.error) throw ferramentas.error;
  const nomesFerramentas = new Map(
    (ferramentas.data ?? []).map((f) => [f.id as string, f.nome as string]),
  );
  const porKit = new Map<string, KitItem["itens"]>();
  for (const row of (itens.data ?? []) as KitItemRow[]) {
    const lista = porKit.get(row.kit_id) ?? [];
    lista.push({
      ferramentaId: row.ferramenta_id,
      ferramentaNome: nomesFerramentas.get(row.ferramenta_id) ?? "Ferramenta removida",
      quantidade: row.quantidade,
    });
    porKit.set(row.kit_id, lista);
  }
  return porKit;
}

export const supabaseKitsAdapter: KitsGateway = {
  async listarKits() {
    const { data, error } = await supabase
      .schema("pcm")
      .from("kits")
      .select("id,nome,descricao,ativo")
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    const kits = (data ?? []) as KitRow[];
    const itensPorKit = await montarItens(kits.map((k) => k.id));
    return kits.map((row) => ({
      id: row.id,
      nome: row.nome,
      descricao: row.descricao,
      ativo: row.ativo,
      itens: itensPorKit.get(row.id) ?? [],
    }));
  },

  async criar(input: CriarKitCommand) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("kits")
      .insert({
        nome: input.nome,
        descricao: input.descricao,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select("id,nome,descricao,ativo")
      .single();
    if (error) throw error;
    const kit = data as KitRow;
    await gravarItens(kit.id, input.itens, input.userId);
    return { ...kit, itens: await itensDoKit(kit.id) };
  },

  async editar(input: EditarKitCommand) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("kits")
      .update({
        nome: input.nome,
        descricao: input.descricao,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select("id,nome,descricao,ativo")
      .single();
    if (error) throw error;
    const kit = data as KitRow;
    // AC-5: composição vale só pra futuras atribuições — substitui tudo (delete+insert), nunca
    // mexe em `ferramenta_movimentacoes` já gravadas (o passado não retroage).
    const deletar = await supabase.schema("pcm").from("kit_itens").delete().eq("kit_id", input.id);
    if (deletar.error) throw deletar.error;
    await gravarItens(kit.id, input.itens, input.userId);
    return { ...kit, itens: await itensDoKit(kit.id) };
  },

  async desativar(input: DesativarKitCommand) {
    const agora = new Date().toISOString();
    const { error } = await supabase
      .schema("pcm")
      .from("kits")
      .update({ ativo: false, deleted_at: agora, updated_at: agora, updated_by: input.userId })
      .eq("id", input.id);
    if (error) throw error;
  },

  async atribuir(input: AtribuirKitCommand) {
    const { data, error } = await supabase.schema("pcm").rpc("fn_atribuir_kit", {
      p_kit_id: input.kitId,
      p_funcionario_id: input.funcionarioId,
      p_user_id: input.userId,
    });
    if (error) throw error;
    return data as string;
  },

  async devolver(input: DevolverKitCommand) {
    const { error } = await supabase.schema("pcm").rpc("fn_devolver_kit", {
      p_kit_atribuicao_id: input.kitAtribuicaoId,
      p_condicao: input.condicao ?? "ok",
      p_user_id: input.userId,
    });
    if (error) throw error;
  },

  async listarAtribuicoesAtivas(): Promise<KitAtribuicaoAtiva[]> {
    const [movimentacoes, unidades, funcionarios] = await Promise.all([
      supabase
        .schema("pcm")
        .from("ferramenta_movimentacoes")
        .select("kit_atribuicao_id,unidade_id,funcionario_id")
        .not("kit_atribuicao_id", "is", null)
        .eq("tipo", "atribuicao"),
      supabase.schema("pcm").from("ferramenta_unidades").select("id,codigo,ferramenta_id,status"),
      supabase.schema("pcm").from("funcionarios").select("id,nome").is("deleted_at", null),
    ]);
    if (movimentacoes.error) throw movimentacoes.error;
    if (unidades.error) throw unidades.error;
    if (funcionarios.error) throw funcionarios.error;

    const ferramentas = await supabase
      .schema("pcm")
      .from("ferramentas")
      .select("id,nome")
      .is("deleted_at", null);
    if (ferramentas.error) throw ferramentas.error;
    const nomesFerramentas = new Map(
      (ferramentas.data ?? []).map((f) => [f.id as string, f.nome as string]),
    );
    const unidadesMap = new Map(
      (unidades.data ?? []).map((u) => [
        u.id as string,
        {
          codigo: u.codigo as string,
          ferramentaNome: nomesFerramentas.get(u.ferramenta_id as string) ?? "Ferramenta removida",
          status: u.status as string,
        },
      ]),
    );
    const nomesFuncionarios = new Map(
      (funcionarios.data ?? []).map((f) => [f.id as string, f.nome as string]),
    );

    const grupos = new Map<string, { funcionarioId: string; unidadeIds: string[] }>();
    for (const row of movimentacoes.data ?? []) {
      const kitAtribuicaoId = row.kit_atribuicao_id as string;
      const grupo = grupos.get(kitAtribuicaoId) ?? {
        funcionarioId: row.funcionario_id as string,
        unidadeIds: [],
      };
      grupo.unidadeIds.push(row.unidade_id as string);
      grupos.set(kitAtribuicaoId, grupo);
    }

    const resultado: KitAtribuicaoAtiva[] = [];
    for (const [kitAtribuicaoId, grupo] of grupos) {
      const unidadesDoGrupo = grupo.unidadeIds
        .map((id) => ({ id, ...unidadesMap.get(id) }))
        .filter((u): u is { id: string; codigo: string; ferramentaNome: string; status: string } =>
          Boolean(u.codigo),
        );
      const aindaComTecnico = unidadesDoGrupo.filter((u) => u.status === "atribuida").length;
      if (aindaComTecnico === 0) continue;
      resultado.push({
        kitAtribuicaoId,
        funcionarioId: grupo.funcionarioId,
        funcionarioNome: nomesFuncionarios.get(grupo.funcionarioId) ?? "Técnico removido",
        totalItens: grupo.unidadeIds.length,
        itensAindaComTecnico: aindaComTecnico,
        unidades: unidadesDoGrupo,
      });
    }
    return resultado;
  },
};

async function itensDoKit(kitId: string): Promise<KitItem["itens"]> {
  const mapa = await montarItens([kitId]);
  return mapa.get(kitId) ?? [];
}

async function gravarItens(
  kitId: string,
  itens: Array<{ ferramentaId: string; quantidade: number }>,
  userId: string,
): Promise<void> {
  if (itens.length === 0) return;
  const { error } = await supabase
    .schema("pcm")
    .from("kit_itens")
    .insert(
      itens.map((item) => ({
        kit_id: kitId,
        ferramenta_id: item.ferramentaId,
        quantidade: item.quantidade,
        created_by: userId,
      })),
    );
  if (error) throw error;
}
