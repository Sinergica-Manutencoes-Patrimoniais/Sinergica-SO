/** Adapter Supabase do motor de precificação (E03-S03). Roda sob RLS do usuário.
 *
 * Custo de MO e alíquota nunca vêm de `select` em `financeiro.*` — só das duas RPCs publicadas
 * pelo Financeiro (`fn_custo_hora_medio_por_cargo`, `fn_aliquota_efetiva_atual`, migration 0181,
 * ADR-0019 R2). Cargos de `pcm.funcionarios` são lidos direto (R2 não exige RPC para leitura de
 * catálogo simples e público dentro do próprio módulo PCM — mesmo padrão que
 * `listarClientesOpcoes` do Financeiro usa sobre `pcm.clientes`). */

import { supabase } from "../../../lib/supabase-client";
import type {
  AliquotaVigente,
  CustoHoraNivel,
  EditarMaterialCommand,
  EditarNivelTecnicoCommand,
  EditarParametrosPrecoCommand,
  Material,
  MaterialCommand,
  NivelTecnico,
  NivelTecnicoCommand,
  ParametrosPreco,
  PrecificacaoGateway,
} from "../application/precificacao-gateway";
import type { OrigemCustoMo } from "../domain/precificacao";
import { resolverCustoMoHora } from "../domain/precificacao";

const PARAMETROS_COLS =
  "margem_alvo_pct,overhead_pct,beneficios_pct,suporte_pct,veiculo_mensal_centavos,markup_material_padrao_pct,mo_inclui_inss_patronal";
const NIVEL_COLS = "id,nome,custo_mensal_referencia_centavos,horas_mes_referencia,cargo_pcm,ativo";
const MATERIAL_COLS = "id,nome,unidade,custo_referencia_centavos,markup_pct,ativo";

interface ParametrosRow {
  margem_alvo_pct: number;
  overhead_pct: number;
  beneficios_pct: number;
  suporte_pct: number;
  veiculo_mensal_centavos: number;
  markup_material_padrao_pct: number;
  mo_inclui_inss_patronal: boolean;
}

interface NivelRow {
  id: string;
  nome: string;
  custo_mensal_referencia_centavos: number;
  horas_mes_referencia: number;
  cargo_pcm: string | null;
  ativo: boolean;
}

interface MaterialRow {
  id: string;
  nome: string;
  unidade: string;
  custo_referencia_centavos: number;
  markup_pct: number | null;
  ativo: boolean;
}

function mapParametros(row: ParametrosRow): ParametrosPreco {
  return {
    margemAlvoPct: row.margem_alvo_pct,
    overheadPct: row.overhead_pct,
    beneficiosPct: row.beneficios_pct,
    suportePct: row.suporte_pct,
    veiculoMensalCentavos: row.veiculo_mensal_centavos,
    markupMaterialPadraoPct: row.markup_material_padrao_pct,
    moIncluiInssPatronal: row.mo_inclui_inss_patronal,
  };
}

function mapNivel(row: NivelRow): NivelTecnico {
  return {
    id: row.id,
    nome: row.nome,
    custoMensalReferenciaCentavos: row.custo_mensal_referencia_centavos,
    horasMesReferencia: row.horas_mes_referencia,
    cargoPcm: row.cargo_pcm,
    ativo: row.ativo,
  };
}

function mapMaterial(row: MaterialRow): Material {
  return {
    id: row.id,
    nome: row.nome,
    unidade: row.unidade,
    custoReferenciaCentavos: row.custo_referencia_centavos,
    markupPct: row.markup_pct,
    ativo: row.ativo,
  };
}

async function usuarioAtual(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export const supabasePrecificacaoAdapter: PrecificacaoGateway = {
  async obterParametros() {
    const { data, error } = await supabase
      .schema("comercial")
      .from("parametros_preco")
      .select(PARAMETROS_COLS)
      .eq("id", 1)
      .single();
    if (error) throw error;
    return mapParametros(data as ParametrosRow);
  },

  async editarParametros(input: EditarParametrosPrecoCommand) {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: await usuarioAtual(),
    };
    if (input.margemAlvoPct !== undefined) patch.margem_alvo_pct = input.margemAlvoPct;
    if (input.overheadPct !== undefined) patch.overhead_pct = input.overheadPct;
    if (input.beneficiosPct !== undefined) patch.beneficios_pct = input.beneficiosPct;
    if (input.suportePct !== undefined) patch.suporte_pct = input.suportePct;
    if (input.veiculoMensalCentavos !== undefined) {
      patch.veiculo_mensal_centavos = input.veiculoMensalCentavos;
    }
    if (input.markupMaterialPadraoPct !== undefined) {
      patch.markup_material_padrao_pct = input.markupMaterialPadraoPct;
    }
    if (input.moIncluiInssPatronal !== undefined) {
      patch.mo_inclui_inss_patronal = input.moIncluiInssPatronal;
    }

    const { data, error } = await supabase
      .schema("comercial")
      .from("parametros_preco")
      .update(patch)
      .eq("id", 1)
      .select(PARAMETROS_COLS)
      .single();
    if (error) throw error;
    return mapParametros(data as ParametrosRow);
  },

  async listarNiveisTecnico() {
    const { data, error } = await supabase
      .schema("comercial")
      .from("niveis_tecnico")
      .select(NIVEL_COLS)
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as NivelRow[]).map(mapNivel);
  },

  async criarNivelTecnico(input: NivelTecnicoCommand) {
    const { data, error } = await supabase
      .schema("comercial")
      .from("niveis_tecnico")
      .insert({
        nome: input.nome.trim(),
        custo_mensal_referencia_centavos: input.custoMensalReferenciaCentavos,
        horas_mes_referencia: input.horasMesReferencia ?? 220,
        cargo_pcm: input.cargoPcm ?? null,
        created_by: await usuarioAtual(),
      })
      .select(NIVEL_COLS)
      .single();
    if (error) throw error;
    return mapNivel(data as NivelRow);
  },

  async editarNivelTecnico(input: EditarNivelTecnicoCommand) {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: await usuarioAtual(),
    };
    if (input.nome !== undefined) patch.nome = input.nome.trim();
    if (input.custoMensalReferenciaCentavos !== undefined) {
      patch.custo_mensal_referencia_centavos = input.custoMensalReferenciaCentavos;
    }
    if (input.horasMesReferencia !== undefined) {
      patch.horas_mes_referencia = input.horasMesReferencia;
    }
    if (input.cargoPcm !== undefined) patch.cargo_pcm = input.cargoPcm;
    if (input.ativo !== undefined) patch.ativo = input.ativo;

    const { data, error } = await supabase
      .schema("comercial")
      .from("niveis_tecnico")
      .update(patch)
      .eq("id", input.id)
      .select(NIVEL_COLS)
      .single();
    if (error) throw error;
    return mapNivel(data as NivelRow);
  },

  async listarCargosPcm() {
    const { data, error } = await supabase
      .schema("pcm")
      .from("funcionarios")
      .select("cargo")
      .eq("ativo", true)
      .is("deleted_at", null)
      .not("cargo", "is", null);
    if (error) throw error;
    const cargos = new Set(
      ((data ?? []) as { cargo: string | null }[])
        .map((row) => row.cargo?.trim())
        .filter((cargo): cargo is string => Boolean(cargo)),
    );
    return [...cargos].sort((a, b) => a.localeCompare(b, "pt-BR"));
  },

  async listarMateriais() {
    const { data, error } = await supabase
      .schema("comercial")
      .from("materiais")
      .select(MATERIAL_COLS)
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as MaterialRow[]).map(mapMaterial);
  },

  async criarMaterial(input: MaterialCommand) {
    const { data, error } = await supabase
      .schema("comercial")
      .from("materiais")
      .insert({
        nome: input.nome.trim(),
        unidade: input.unidade.trim(),
        custo_referencia_centavos: input.custoReferenciaCentavos,
        markup_pct: input.markupPct ?? null,
        created_by: await usuarioAtual(),
      })
      .select(MATERIAL_COLS)
      .single();
    if (error) throw error;
    return mapMaterial(data as MaterialRow);
  },

  async editarMaterial(input: EditarMaterialCommand) {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: await usuarioAtual(),
    };
    if (input.nome !== undefined) patch.nome = input.nome.trim();
    if (input.unidade !== undefined) patch.unidade = input.unidade.trim();
    if (input.custoReferenciaCentavos !== undefined) {
      patch.custo_referencia_centavos = input.custoReferenciaCentavos;
    }
    if (input.markupPct !== undefined) patch.markup_pct = input.markupPct;
    if (input.ativo !== undefined) patch.ativo = input.ativo;

    const { data, error } = await supabase
      .schema("comercial")
      .from("materiais")
      .update(patch)
      .eq("id", input.id)
      .select(MATERIAL_COLS)
      .single();
    if (error) throw error;
    return mapMaterial(data as MaterialRow);
  },

  async obterCustoHoraNivel(nivel: NivelTecnico): Promise<CustoHoraNivel> {
    // Sem cargo mapeado, nem vale chamar a RPC — cai direto no fallback (AC-4).
    let custoHoraFinanceiro: number | null = null;
    if (nivel.cargoPcm) {
      const { data, error } = await supabase
        .schema("financeiro")
        .rpc("fn_custo_hora_medio_por_cargo", { p_cargo: nivel.cargoPcm });
      if (error) throw error;
      // A RPC (via financeiro._fn_custo_hora_funcionario, E04-S06) já devolve centavos/hora —
      // confirmado em produção: funcionário de R$4.400/mês a 220h devolve 2000 (R$20,00/h), não
      // 20. O nome "custo_hora_reais" na E04-S06 é só um rótulo, não indica a unidade.
      custoHoraFinanceiro = data === null ? null : Number(data);
    }

    const resolvido = resolverCustoMoHora(
      custoHoraFinanceiro,
      nivel.custoMensalReferenciaCentavos,
      nivel.horasMesReferencia,
    );
    return { nivelId: nivel.id, ...resolvido };
  },

  async obterAliquotaVigente(): Promise<AliquotaVigente> {
    const { data, error } = await supabase.schema("financeiro").rpc("fn_aliquota_efetiva_atual");
    if (error) throw error;
    const linha = (Array.isArray(data) ? data[0] : data) as {
      aliquota_efetiva: number;
      tipo: "fixa" | "faixa_rbt12";
      confirmada: boolean;
    } | null;
    if (!linha) {
      return { aliquotaEfetiva: 0, tipo: "fixa", confirmada: false };
    }
    return {
      aliquotaEfetiva: Number(linha.aliquota_efetiva),
      tipo: linha.tipo,
      confirmada: linha.confirmada,
    };
  },
};

export type { OrigemCustoMo };
