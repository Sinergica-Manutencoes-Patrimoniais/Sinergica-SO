import { supabase } from "../../../lib/supabase-client";
import type {
  ChecklistTemplate,
  ChecklistTemplateItem,
  ClienteOpcao,
  CriarChecklistTemplateInput,
  CriarInspecaoImportadaInput,
  CriarInspecaoInput,
  CriarInspecaoItemInput,
  CriarLaudoSpdaInput,
  CriarPontoSpdaInput,
  CriarTipoInspecaoInput,
  EditarInspecaoInput,
  EditarInspecaoItemInput,
  EditarTipoInspecaoInput,
  InspecaoItem,
  InspecaoResumo,
  ItemInspecaoImportado,
  LaudoSpdaPonto,
  LaudoSpdaResumo,
  MidiaItem,
  QualidadeGateway,
  TipoInspecao,
} from "../application/qualidade-gateway";
import { type SistemaInspecao, classificarPontoSpda } from "../domain/inspecoes-laudos";

const MIDIA_BUCKET = "inspecoes-midia";

interface ClienteRow {
  id: string;
  nome: string;
}

interface InspecaoRow {
  id: string;
  client_id: string;
  titulo: string;
  data_inspecao: string;
  responsavel_tecnico: string | null;
  status: InspecaoResumo["status"];
  observacoes_gerais: string | null;
  total_itens: number;
  itens_conformes: number;
  itens_nao_conformes: number;
  itens_atencao: number;
  codigo: string | null;
  tipo_inspecao_id: string | null;
  edificacao: string | null;
  endereco: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  inspetor: string | null;
  responsavel_no_local: string | null;
  escopo: string | null;
  norma_tecnica: string | null;
  art: string | null;
  condicoes: string | null;
  anexos: MidiaItem[] | null;
}

interface InspecaoItemRow {
  id: string;
  inspecao_id: string;
  sistema: InspecaoItem["sistema"];
  localizacao: string | null;
  descricao: string;
  resultado: InspecaoItem["resultado"];
  severidade: InspecaoItem["severidade"];
  recomendacao: string | null;
  prazo_recomendado: string | null;
  foto_url: string | null;
  categoria: string | null;
  elemento: string | null;
  identificacao: string | null;
  grau_risco: InspecaoItem["grauRisco"];
  estado_conservacao: string | null;
  anomalia: string | null;
  medicoes: string | null;
  midias: MidiaItem[] | null;
  responsavel_acao: string | null;
  observacoes: string | null;
}

interface TipoInspecaoRow {
  id: string;
  nome: string;
  norma_tecnica: string | null;
  descricao: string | null;
  ativo: boolean;
}

interface ChecklistTemplateRow {
  id: string;
  tipo_inspecao_id: string;
  nome: string;
  ativo: boolean;
}

interface ChecklistTemplateItemRow {
  id: string;
  template_id: string;
  categoria: string | null;
  sistema: string | null;
  elemento: string | null;
  ordem: number;
  obrigatorio: boolean;
}

interface LaudoRow {
  id: string;
  client_id: string;
  numero: string;
  status: LaudoSpdaResumo["status"];
  data_vistoria: string;
  arte_numero: string | null;
  responsavel_tecnico: string | null;
  notas_gerais: string | null;
  conclusao: string | null;
  nivel_protecao: LaudoSpdaResumo["nivelProtecao"];
  necessita_spda: boolean | null;
  risco_total: number | null;
}

interface PontoRow {
  id: string;
  laudo_id: string;
  numero_ponto: number;
  localizacao: string;
  resistencia_ohm: number | null;
  status_conformidade: LaudoSpdaPonto["statusConformidade"];
  observacoes: string | null;
  foto_url: string | null;
}

const INSPECAO_COLS =
  "id,client_id,titulo,data_inspecao,responsavel_tecnico,status,observacoes_gerais,total_itens,itens_conformes,itens_nao_conformes,itens_atencao,codigo,tipo_inspecao_id,edificacao,endereco,hora_inicio,hora_fim,inspetor,responsavel_no_local,escopo,norma_tecnica,art,condicoes,anexos" as const;

const ITEM_COLS =
  "id,inspecao_id,sistema,localizacao,descricao,resultado,severidade,recomendacao,prazo_recomendado,foto_url,categoria,elemento,identificacao,grau_risco,estado_conservacao,anomalia,medicoes,midias,responsavel_acao,observacoes" as const;

const TIPO_INSPECAO_COLS = "id,nome,norma_tecnica,descricao,ativo" as const;
const TEMPLATE_COLS = "id,tipo_inspecao_id,nome,ativo" as const;
const TEMPLATE_ITEM_COLS = "id,template_id,categoria,sistema,elemento,ordem,obrigatorio" as const;

const LAUDO_COLS =
  "id,client_id,numero,status,data_vistoria,arte_numero,responsavel_tecnico,notas_gerais,conclusao,nivel_protecao,necessita_spda,risco_total" as const;

const PONTO_COLS =
  "id,laudo_id,numero_ponto,localizacao,resistencia_ohm,status_conformidade,observacoes,foto_url" as const;

const SISTEMAS_VALIDOS: SistemaInspecao[] = [
  "estrutural",
  "hidrossanitario",
  "eletrico",
  "spda",
  "cobertura",
  "fachada",
  "areas_comuns",
  "equipamentos",
  "incendio",
  "ar_condicionado",
  "elevadores",
  "geral",
];

function mapClientes(rows: ClienteRow[]): Map<string, string> {
  return new Map(rows.map((cliente) => [cliente.id, cliente.nome]));
}

function mapInspecao(
  row: InspecaoRow,
  clientes: Map<string, string>,
  tipos: Map<string, string> = new Map(),
): InspecaoResumo {
  return {
    id: row.id,
    clientId: row.client_id,
    clienteNome: clientes.get(row.client_id) ?? "Cliente não identificado",
    titulo: row.titulo,
    dataInspecao: row.data_inspecao,
    responsavelTecnico: row.responsavel_tecnico,
    status: row.status,
    observacoesGerais: row.observacoes_gerais,
    totalItens: row.total_itens,
    itensConformes: row.itens_conformes,
    itensNaoConformes: row.itens_nao_conformes,
    itensAtencao: row.itens_atencao,
    codigo: row.codigo,
    tipoInspecaoId: row.tipo_inspecao_id,
    tipoInspecaoNome: row.tipo_inspecao_id ? (tipos.get(row.tipo_inspecao_id) ?? null) : null,
    edificacao: row.edificacao,
    endereco: row.endereco,
    horaInicio: row.hora_inicio,
    horaFim: row.hora_fim,
    inspetor: row.inspetor,
    responsavelNoLocal: row.responsavel_no_local,
    escopo: row.escopo,
    normaTecnica: row.norma_tecnica,
    art: row.art,
    condicoes: row.condicoes,
    anexos: row.anexos ?? [],
  };
}

function mapItem(row: InspecaoItemRow): InspecaoItem {
  return {
    id: row.id,
    inspecaoId: row.inspecao_id,
    sistema: row.sistema,
    localizacao: row.localizacao,
    descricao: row.descricao,
    resultado: row.resultado,
    severidade: row.severidade,
    recomendacao: row.recomendacao,
    prazoRecomendado: row.prazo_recomendado,
    fotoUrl: row.foto_url,
    categoria: row.categoria,
    elemento: row.elemento,
    identificacao: row.identificacao,
    grauRisco: row.grau_risco,
    estadoConservacao: row.estado_conservacao,
    anomalia: row.anomalia,
    medicoes: row.medicoes,
    midias: row.midias ?? [],
    responsavelAcao: row.responsavel_acao,
    observacoes: row.observacoes,
  };
}

function mapTipoInspecao(row: TipoInspecaoRow): TipoInspecao {
  return {
    id: row.id,
    nome: row.nome,
    normaTecnica: row.norma_tecnica,
    descricao: row.descricao,
    ativo: row.ativo,
  };
}

function mapTemplateItem(row: ChecklistTemplateItemRow): ChecklistTemplateItem {
  return {
    id: row.id,
    categoria: row.categoria,
    sistema: row.sistema,
    elemento: row.elemento,
    ordem: row.ordem,
    obrigatorio: row.obrigatorio,
  };
}

function normalizarSistema(valor: unknown): SistemaInspecao {
  return SISTEMAS_VALIDOS.includes(valor as SistemaInspecao) ? (valor as SistemaInspecao) : "geral";
}

function severidadePorGUT(score: number): InspecaoItem["severidade"] {
  if (score >= 80) return "critica";
  if (score >= 45) return "alta";
  if (score >= 16) return "media";
  return "baixa";
}

function mapItemImportado(raw: Record<string, unknown>): ItemInspecaoImportado {
  const gravidade = Number(raw.gravidade ?? 3);
  const urgencia = Number(raw.urgencia ?? 3);
  const tendencia = Number(raw.tendencia ?? 3);
  return {
    local: String(raw.local ?? raw.localizacao ?? "").trim(),
    relatoOriginal: String(raw.relato_original ?? raw.relatoOriginal ?? "").trim(),
    sistema: normalizarSistema(raw.sistema),
    tituloBacklog: String(
      raw.titulo_backlog ?? raw.tituloBacklog ?? "Inconformidade importada",
    ).trim(),
    descricaoTecnica: String(
      raw.descricao_tecnica ?? raw.descricaoTecnica ?? raw.relato_original ?? "",
    ).trim(),
    citacaoNormativa:
      typeof raw.citacao_normativa === "string" && raw.citacao_normativa.trim()
        ? raw.citacao_normativa.trim()
        : null,
    prioridade: String(raw.prioridade ?? "media"),
    categoria: String(raw.categoria ?? "corretiva"),
    gravidade: Number.isFinite(gravidade) ? gravidade : 3,
    urgencia: Number.isFinite(urgencia) ? urgencia : 3,
    tendencia: Number.isFinite(tendencia) ? tendencia : 3,
    esforcoHoras: Number(raw.esforco_horas ?? raw.esforcoHoras ?? 0),
    justificativaEsforco:
      typeof raw.justificativa_esforco === "string" && raw.justificativa_esforco.trim()
        ? raw.justificativa_esforco.trim()
        : null,
    fotoUrls: Array.isArray(raw.foto_urls)
      ? raw.foto_urls.filter((url): url is string => typeof url === "string" && Boolean(url.trim()))
      : undefined,
  };
}

function mapLaudo(row: LaudoRow, clientes: Map<string, string>): LaudoSpdaResumo {
  return {
    id: row.id,
    clientId: row.client_id,
    clienteNome: clientes.get(row.client_id) ?? "Cliente não identificado",
    numero: row.numero,
    status: row.status,
    dataVistoria: row.data_vistoria,
    arteNumero: row.arte_numero,
    responsavelTecnico: row.responsavel_tecnico,
    notasGerais: row.notas_gerais,
    conclusao: row.conclusao,
    nivelProtecao: row.nivel_protecao,
    necessitaSpda: row.necessita_spda,
    riscoTotal: row.risco_total,
  };
}

function mapPonto(row: PontoRow): LaudoSpdaPonto {
  return {
    id: row.id,
    laudoId: row.laudo_id,
    numeroPonto: row.numero_ponto,
    localizacao: row.localizacao,
    resistenciaOhm: row.resistencia_ohm,
    statusConformidade: row.status_conformidade,
    observacoes: row.observacoes,
    fotoUrl: row.foto_url,
  };
}

async function listarClientesAtivos(): Promise<ClienteOpcao[]> {
  const { data, error } = await supabase
    .schema("pcm")
    .from("clientes")
    .select("id,nome")
    .eq("ativo", true)
    .is("deleted_at", null)
    .order("nome", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((cliente) => ({
    id: cliente.id as string,
    nome: cliente.nome as string,
  }));
}

async function clientesPorId(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .schema("pcm")
    .from("clientes")
    .select("id,nome")
    .is("deleted_at", null);

  if (error) throw error;
  return mapClientes((data ?? []) as ClienteRow[]);
}

async function tiposPorId(): Promise<Map<string, string>> {
  const { data, error } = await supabase.schema("pcm").from("tipos_inspecao").select("id,nome");
  if (error) throw error;
  return new Map((data ?? []).map((tipo) => [tipo.id as string, tipo.nome as string]));
}

async function proximoNumeroLaudo(): Promise<string> {
  const { count, error } = await supabase
    .schema("pcm")
    .from("laudos_spda")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return `SPDA-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export const supabaseQualidadeAdapter: QualidadeGateway = {
  listarClientes: listarClientesAtivos,

  async listarInspecoes(): Promise<InspecaoResumo[]> {
    const [clientes, tipos, { data, error }] = await Promise.all([
      clientesPorId(),
      tiposPorId(),
      supabase
        .schema("pcm")
        .from("inspecoes")
        .select(INSPECAO_COLS)
        .is("deleted_at", null)
        .order("data_inspecao", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (error) throw error;
    return ((data ?? []) as InspecaoRow[]).map((row) => mapInspecao(row, clientes, tipos));
  },

  async criarInspecao(input: CriarInspecaoInput): Promise<InspecaoResumo> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("inspecoes")
      .insert({
        client_id: input.clientId,
        titulo: input.titulo,
        data_inspecao: input.dataInspecao,
        responsavel_tecnico: input.responsavelTecnico,
        observacoes_gerais: input.observacoesGerais,
        status: "em_andamento",
        created_by: input.createdBy,
        tipo_inspecao_id: input.tipoInspecaoId ?? null,
        edificacao: input.edificacao ?? null,
        endereco: input.endereco ?? null,
        hora_inicio: input.horaInicio ?? null,
        hora_fim: input.horaFim ?? null,
        inspetor: input.inspetor ?? null,
        responsavel_no_local: input.responsavelNoLocal ?? null,
        escopo: input.escopo ?? null,
        norma_tecnica: input.normaTecnica ?? null,
        art: input.art ?? null,
        condicoes: input.condicoes ?? null,
      })
      .select(INSPECAO_COLS)
      .single();

    if (error) throw error;
    const [clientes, tipos] = await Promise.all([clientesPorId(), tiposPorId()]);
    return mapInspecao(data as InspecaoRow, clientes, tipos);
  },

  async editarInspecao(input: EditarInspecaoInput): Promise<InspecaoResumo> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("inspecoes")
      .update({
        client_id: input.clientId,
        titulo: input.titulo,
        data_inspecao: input.dataInspecao,
        responsavel_tecnico: input.responsavelTecnico,
        observacoes_gerais: input.observacoesGerais,
        tipo_inspecao_id: input.tipoInspecaoId ?? null,
        edificacao: input.edificacao ?? null,
        endereco: input.endereco ?? null,
        hora_inicio: input.horaInicio ?? null,
        hora_fim: input.horaFim ?? null,
        inspetor: input.inspetor ?? null,
        responsavel_no_local: input.responsavelNoLocal ?? null,
        escopo: input.escopo ?? null,
        norma_tecnica: input.normaTecnica ?? null,
        art: input.art ?? null,
        condicoes: input.condicoes ?? null,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy,
      })
      .eq("id", input.id)
      .select(INSPECAO_COLS)
      .single();

    if (error) throw error;
    const [clientes, tipos] = await Promise.all([clientesPorId(), tiposPorId()]);
    return mapInspecao(data as InspecaoRow, clientes, tipos);
  },

  async listarItensInspecao(inspecaoId: string): Promise<InspecaoItem[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("inspecao_itens")
      .select(ITEM_COLS)
      .eq("inspecao_id", inspecaoId)
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as InspecaoItemRow[]).map(mapItem);
  },

  async criarItemInspecao(input: CriarInspecaoItemInput): Promise<InspecaoItem> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("inspecao_itens")
      .insert({
        inspecao_id: input.inspecaoId,
        client_id: input.clientId,
        sistema: input.sistema,
        localizacao: input.localizacao,
        descricao: input.descricao,
        resultado: input.resultado,
        severidade: input.severidade,
        recomendacao: input.recomendacao,
        prazo_recomendado: input.prazoRecomendado,
        foto_url: input.fotoUrl,
        categoria: input.categoria ?? null,
        elemento: input.elemento ?? null,
        identificacao: input.identificacao ?? null,
        grau_risco: input.grauRisco ?? null,
        estado_conservacao: input.estadoConservacao ?? null,
        anomalia: input.anomalia ?? null,
        medicoes: input.medicoes ?? null,
        responsavel_acao: input.responsavelAcao ?? null,
        observacoes: input.observacoes ?? null,
        // `ordem` é `int` (int4, máx. ~2.1bi) no schema — `Date.now()` (ms, ~1.75tri) estoura a
        // coluna. Segundos desde epoch cabe em int4 até 2038, suficiente como chave de ordenação.
        ordem: Math.floor(Date.now() / 1000),
        created_by: input.createdBy,
      })
      .select(ITEM_COLS)
      .single();

    if (error) throw error;
    return mapItem(data as InspecaoItemRow);
  },

  async editarItemInspecao(input: EditarInspecaoItemInput): Promise<InspecaoItem> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("inspecao_itens")
      .update({
        sistema: input.sistema,
        localizacao: input.localizacao,
        descricao: input.descricao,
        resultado: input.resultado,
        severidade: input.severidade,
        recomendacao: input.recomendacao,
        prazo_recomendado: input.prazoRecomendado,
        foto_url: input.fotoUrl,
        categoria: input.categoria ?? null,
        elemento: input.elemento ?? null,
        identificacao: input.identificacao ?? null,
        grau_risco: input.grauRisco ?? null,
        estado_conservacao: input.estadoConservacao ?? null,
        anomalia: input.anomalia ?? null,
        medicoes: input.medicoes ?? null,
        responsavel_acao: input.responsavelAcao ?? null,
        observacoes: input.observacoes ?? null,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy,
      })
      .eq("id", input.id)
      .select(ITEM_COLS)
      .single();

    if (error) throw error;
    return mapItem(data as InspecaoItemRow);
  },

  async excluirItemInspecao(id: string): Promise<void> {
    const { error } = await supabase.schema("pcm").from("inspecao_itens").delete().eq("id", id);
    if (error) throw error;
  },

  async processarRelatorioInspecao(texto: string): Promise<ItemInspecaoImportado[]> {
    const { data, error } = await supabase.functions.invoke("importar-relatorio-pdf", {
      body: { texto },
    });
    if (error) throw error;
    const payload = data as { itens?: Record<string, unknown>[] } | null;
    const itens = Array.isArray(payload?.itens) ? payload.itens : [];
    return itens.map((item: Record<string, unknown>) => mapItemImportado(item));
  },

  async criarInspecaoImportada(input: CriarInspecaoImportadaInput): Promise<InspecaoResumo> {
    const { data: inspecao, error: inspecaoError } = await supabase
      .schema("pcm")
      .from("inspecoes")
      .insert({
        client_id: input.clientId,
        titulo: input.titulo,
        data_inspecao: input.dataInspecao,
        responsavel_tecnico: input.responsavelTecnico,
        observacoes_gerais: input.observacoesGerais,
        status: "concluida",
        created_by: input.createdBy,
      })
      .select(INSPECAO_COLS)
      .single();
    if (inspecaoError) throw inspecaoError;

    const inspecaoId = (inspecao as InspecaoRow).id;
    if (input.itens.length > 0) {
      const linhas = input.itens.map((item, index) => {
        const score = item.gravidade * item.urgencia * item.tendencia;
        const fotos = item.fotoUrls ?? [];
        return {
          inspecao_id: inspecaoId,
          client_id: input.clientId,
          sistema: item.sistema,
          localizacao: item.local || null,
          descricao: item.descricaoTecnica || item.relatoOriginal || item.tituloBacklog,
          resultado: "nao_conforme",
          severidade: severidadePorGUT(score),
          recomendacao:
            [item.tituloBacklog, item.citacaoNormativa].filter(Boolean).join(" · ") || null,
          foto_url: fotos[0] ?? null,
          ordem: index + 1,
          created_by: input.createdBy,
        };
      });
      const { error: itensError } = await supabase
        .schema("pcm")
        .from("inspecao_itens")
        .insert(linhas);
      if (itensError) throw itensError;
    }

    const [{ data: atualizada, error: atualizadaError }, clientes, tipos] = await Promise.all([
      supabase.schema("pcm").from("inspecoes").select(INSPECAO_COLS).eq("id", inspecaoId).single(),
      clientesPorId(),
      tiposPorId(),
    ]);
    if (atualizadaError) throw atualizadaError;
    return mapInspecao(atualizada as InspecaoRow, clientes, tipos);
  },

  async listarLaudosSpda(): Promise<LaudoSpdaResumo[]> {
    const [clientes, { data, error }] = await Promise.all([
      clientesPorId(),
      supabase
        .schema("pcm")
        .from("laudos_spda")
        .select(LAUDO_COLS)
        .is("deleted_at", null)
        .order("data_vistoria", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (error) throw error;
    return ((data ?? []) as LaudoRow[]).map((row) => mapLaudo(row, clientes));
  },

  async criarLaudoSpda(input: CriarLaudoSpdaInput): Promise<LaudoSpdaResumo> {
    const numero = await proximoNumeroLaudo();
    const { data, error } = await supabase
      .schema("pcm")
      .from("laudos_spda")
      .insert({
        client_id: input.clientId,
        numero,
        data_vistoria: input.dataVistoria,
        arte_numero: input.arteNumero,
        responsavel_tecnico: input.responsavelTecnico,
        notas_gerais: input.notasGerais,
        nivel_protecao: input.nivelProtecao,
        status: "em_andamento",
        created_by: input.createdBy,
      })
      .select(LAUDO_COLS)
      .single();

    if (error) throw error;
    const clientes = await clientesPorId();
    return mapLaudo(data as LaudoRow, clientes);
  },

  async listarPontosSpda(laudoId: string): Promise<LaudoSpdaPonto[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("laudo_spda_pontos")
      .select(PONTO_COLS)
      .eq("laudo_id", laudoId)
      .order("numero_ponto", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as PontoRow[]).map(mapPonto);
  },

  async criarPontoSpda(input: CriarPontoSpdaInput): Promise<LaudoSpdaPonto> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("laudo_spda_pontos")
      .insert({
        laudo_id: input.laudoId,
        numero_ponto: input.numeroPonto,
        localizacao: input.localizacao,
        resistencia_ohm: input.resistenciaOhm,
        status_conformidade:
          input.statusConformidade === "pendente"
            ? classificarPontoSpda(input.resistenciaOhm)
            : input.statusConformidade,
        observacoes: input.observacoes,
        foto_url: input.fotoUrl,
        created_by: input.createdBy,
      })
      .select(PONTO_COLS)
      .single();

    if (error) throw error;
    return mapPonto(data as PontoRow);
  },

  // ── E01-S73: parametrização ────────────────────────────────────────────────────────────────

  async listarTiposInspecao(): Promise<TipoInspecao[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("tipos_inspecao")
      .select(TIPO_INSPECAO_COLS)
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as TipoInspecaoRow[]).map(mapTipoInspecao);
  },

  async criarTipoInspecao(input: CriarTipoInspecaoInput): Promise<TipoInspecao> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("tipos_inspecao")
      .insert({
        nome: input.nome,
        norma_tecnica: input.normaTecnica,
        descricao: input.descricao,
        created_by: input.createdBy,
        updated_by: input.createdBy,
      })
      .select(TIPO_INSPECAO_COLS)
      .single();
    if (error) throw error;
    return mapTipoInspecao(data as TipoInspecaoRow);
  },

  async editarTipoInspecao(input: EditarTipoInspecaoInput): Promise<TipoInspecao> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("tipos_inspecao")
      .update({
        nome: input.nome,
        norma_tecnica: input.normaTecnica,
        descricao: input.descricao,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy,
      })
      .eq("id", input.id)
      .select(TIPO_INSPECAO_COLS)
      .single();
    if (error) throw error;
    return mapTipoInspecao(data as TipoInspecaoRow);
  },

  async listarTemplates(): Promise<ChecklistTemplate[]> {
    const [{ data: templates, error: templatesError }, { data: itens, error: itensError }] =
      await Promise.all([
        supabase
          .schema("pcm")
          .from("checklist_templates")
          .select(TEMPLATE_COLS)
          .eq("ativo", true)
          .order("nome", { ascending: true }),
        supabase
          .schema("pcm")
          .from("checklist_template_itens")
          .select(TEMPLATE_ITEM_COLS)
          .order("ordem", { ascending: true }),
      ]);
    if (templatesError) throw templatesError;
    if (itensError) throw itensError;
    const itensPorTemplate = new Map<string, ChecklistTemplateItem[]>();
    for (const row of (itens ?? []) as ChecklistTemplateItemRow[]) {
      const lista = itensPorTemplate.get(row.template_id) ?? [];
      lista.push(mapTemplateItem(row));
      itensPorTemplate.set(row.template_id, lista);
    }
    return ((templates ?? []) as ChecklistTemplateRow[]).map((row) => ({
      id: row.id,
      tipoInspecaoId: row.tipo_inspecao_id,
      nome: row.nome,
      ativo: row.ativo,
      itens: itensPorTemplate.get(row.id) ?? [],
    }));
  },

  async criarTemplate(input: CriarChecklistTemplateInput): Promise<ChecklistTemplate> {
    const { data: template, error: templateError } = await supabase
      .schema("pcm")
      .from("checklist_templates")
      .insert({
        tipo_inspecao_id: input.tipoInspecaoId,
        nome: input.nome,
        created_by: input.createdBy,
        updated_by: input.createdBy,
      })
      .select(TEMPLATE_COLS)
      .single();
    if (templateError) throw templateError;
    const templateRow = template as ChecklistTemplateRow;

    const { data: itens, error: itensError } = await supabase
      .schema("pcm")
      .from("checklist_template_itens")
      .insert(
        input.itens.map((item, index) => ({
          template_id: templateRow.id,
          categoria: item.categoria,
          sistema: item.sistema,
          elemento: item.elemento,
          ordem: index,
          obrigatorio: item.obrigatorio,
          created_by: input.createdBy,
        })),
      )
      .select(TEMPLATE_ITEM_COLS);
    if (itensError) throw itensError;

    return {
      id: templateRow.id,
      tipoInspecaoId: templateRow.tipo_inspecao_id,
      nome: templateRow.nome,
      ativo: templateRow.ativo,
      itens: ((itens ?? []) as ChecklistTemplateItemRow[]).map(mapTemplateItem),
    };
  },

  async aplicarTemplate(
    inspecaoId: string,
    templateId: string,
    userId: string,
  ): Promise<InspecaoItem[]> {
    const [{ data: inspecao, error: inspecaoError }, { data: itensTemplate, error: itensError }] =
      await Promise.all([
        supabase.schema("pcm").from("inspecoes").select("client_id").eq("id", inspecaoId).single(),
        supabase
          .schema("pcm")
          .from("checklist_template_itens")
          .select(TEMPLATE_ITEM_COLS)
          .eq("template_id", templateId)
          .order("ordem", { ascending: true }),
      ]);
    if (inspecaoError) throw inspecaoError;
    if (itensError) throw itensError;
    const clientId = (inspecao as { client_id: string }).client_id;

    const linhas = ((itensTemplate ?? []) as ChecklistTemplateItemRow[]).map((item, index) => ({
      inspecao_id: inspecaoId,
      client_id: clientId,
      sistema: normalizarSistema(item.sistema),
      categoria: item.categoria,
      elemento: item.elemento,
      localizacao: null,
      descricao: [item.categoria, item.elemento].filter(Boolean).join(" — ") || "Item do checklist",
      resultado: "nao_avaliado",
      severidade: "media",
      ordem: index,
      created_by: userId,
    }));
    if (linhas.length === 0) return [];

    const { data, error } = await supabase
      .schema("pcm")
      .from("inspecao_itens")
      .insert(linhas)
      .select(ITEM_COLS);
    if (error) throw error;
    return ((data ?? []) as InspecaoItemRow[]).map(mapItem);
  },

  // ── E01-S73: mídia (Storage privado) ───────────────────────────────────────────────────────

  async uploadMidiaItem(itemId: string, file: File, tipo: MidiaItem["tipo"]): Promise<MidiaItem> {
    const extensao = file.name.split(".").pop() ?? "bin";
    const path = `inspecoes/${itemId}/${crypto.randomUUID()}.${extensao}`;
    const upload = await supabase.storage
      .from(MIDIA_BUCKET)
      .upload(path, file, { contentType: file.type || undefined });
    if (upload.error) throw upload.error;

    const midia: MidiaItem = { tipo, path, nome: file.name };
    const atual = await supabase
      .schema("pcm")
      .from("inspecao_itens")
      .select("midias")
      .eq("id", itemId)
      .single();
    if (atual.error) throw atual.error;
    const midias = [...((atual.data?.midias as MidiaItem[] | null) ?? []), midia];
    const { error } = await supabase
      .schema("pcm")
      .from("inspecao_itens")
      .update({ midias })
      .eq("id", itemId);
    if (error) throw error;
    return midia;
  },

  async removerMidiaItem(itemId: string, midia: MidiaItem): Promise<void> {
    const remove = await supabase.storage.from(MIDIA_BUCKET).remove([midia.path]);
    if (remove.error) throw remove.error;

    const atual = await supabase
      .schema("pcm")
      .from("inspecao_itens")
      .select("midias")
      .eq("id", itemId)
      .single();
    if (atual.error) throw atual.error;
    const midias = ((atual.data?.midias as MidiaItem[] | null) ?? []).filter(
      (item) => item.path !== midia.path,
    );
    const { error } = await supabase
      .schema("pcm")
      .from("inspecao_itens")
      .update({ midias })
      .eq("id", itemId);
    if (error) throw error;
  },

  async urlAssinadaMidia(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from(MIDIA_BUCKET).createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },
};
