import { supabase } from "../../../lib/supabase-client";
import type {
  ClienteOpcao,
  CriarInspecaoInput,
  CriarInspecaoItemInput,
  CriarLaudoSpdaInput,
  CriarPontoSpdaInput,
  InspecaoItem,
  InspecaoResumo,
  LaudoSpdaPonto,
  LaudoSpdaResumo,
  QualidadeGateway,
} from "../application/qualidade-gateway";
import { classificarPontoSpda } from "../domain/inspecoes-laudos";

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
  "id,client_id,titulo,data_inspecao,responsavel_tecnico,status,observacoes_gerais,total_itens,itens_conformes,itens_nao_conformes,itens_atencao" as const;

const ITEM_COLS =
  "id,inspecao_id,sistema,localizacao,descricao,resultado,severidade,recomendacao,prazo_recomendado,foto_url" as const;

const LAUDO_COLS =
  "id,client_id,numero,status,data_vistoria,arte_numero,responsavel_tecnico,notas_gerais,conclusao,nivel_protecao,necessita_spda,risco_total" as const;

const PONTO_COLS =
  "id,laudo_id,numero_ponto,localizacao,resistencia_ohm,status_conformidade,observacoes,foto_url" as const;

function mapClientes(rows: ClienteRow[]): Map<string, string> {
  return new Map(rows.map((cliente) => [cliente.id, cliente.nome]));
}

function mapInspecao(row: InspecaoRow, clientes: Map<string, string>): InspecaoResumo {
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
    const [clientes, { data, error }] = await Promise.all([
      clientesPorId(),
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
    return ((data ?? []) as InspecaoRow[]).map((row) => mapInspecao(row, clientes));
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
      })
      .select(INSPECAO_COLS)
      .single();

    if (error) throw error;
    const clientes = await clientesPorId();
    return mapInspecao(data as InspecaoRow, clientes);
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
};
