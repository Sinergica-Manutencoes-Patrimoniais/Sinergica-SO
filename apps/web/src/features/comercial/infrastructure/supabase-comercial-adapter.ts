/** Adapter Supabase do Comercial (E03-S01). Roda sob RLS do usuário — nunca `service_role`.
 *
 * Regra que este arquivo carrega: a Conta é lida da view `relacionamento.contas`, NUNCA de
 * `pcm.clientes` direto. `pcm.clientes` é Shared Kernel do PCM; a view é o contrato (ADR-0019 R2).
 * Se um dia precisar de coluna que a view não tem, o caminho é pedir ao PCM que a exponha — não
 * furar para a tabela. */

import { supabase } from "../../../lib/supabase-client";
import type {
  ComercialGateway,
  ContaComFunil,
  CriarOportunidadeCommand,
  EditarEtapaCommand,
  EditarMotivoPerdaCommand,
  EtapaCommand,
  FiltroContas,
  MotivoPerdaCommand,
  MoverOportunidadeCommand,
} from "../application/comercial-gateway";
import {
  aplicarTransicao,
  type Etapa,
  etapaPadrao,
  type MotivoPerda,
  type Oportunidade,
  transicaoInvalida,
  validarTituloOportunidade,
  validarValorEstimado,
} from "../domain/funil";

const CONTA_COLS =
  "id,nome,cnpj,ativo,cidade,estado,contato_nome,contato_telefone,contato_email,auvo_id";
const ETAPA_COLS = "id,nome,ordem,cor,tipo,ativo";
const MOTIVO_COLS = "id,nome,ativo";
// String literal única, sem concatenação: o supabase-js infere o tipo da linha a partir dela, e
// quebrar em duas partes faz a inferência cair para `GenericStringError`.
const OPORTUNIDADE_COLS =
  "id,cliente_id,etapa_id,titulo,descricao,valor_estimado_centavos,score,resumo,origem,lead_tier,cluster_nome,conversa_id,responsavel_id,motivo_perda_id,fechada_em,created_at";

interface ContaRow {
  id: string;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  cidade: string | null;
  estado: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  auvo_id: string | null;
}

interface EtapaRow {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
  tipo: Etapa["tipo"];
  ativo: boolean;
}

interface OportunidadeRow {
  id: string;
  cliente_id: string;
  etapa_id: string;
  titulo: string;
  descricao: string | null;
  valor_estimado_centavos: number | null;
  score: number | null;
  resumo: string | null;
  origem: string | null;
  lead_tier: string | null;
  cluster_nome: string | null;
  conversa_id: string | null;
  responsavel_id: string | null;
  motivo_perda_id: string | null;
  fechada_em: string | null;
  created_at: string;
}

function mapEtapa(row: EtapaRow): Etapa {
  return {
    id: row.id,
    nome: row.nome,
    ordem: row.ordem,
    cor: row.cor,
    tipo: row.tipo,
    ativo: row.ativo,
  };
}

function mapOportunidade(row: OportunidadeRow): Oportunidade {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    etapaId: row.etapa_id,
    titulo: row.titulo,
    descricao: row.descricao,
    valorEstimadoCentavos: row.valor_estimado_centavos,
    score: row.score,
    resumo: row.resumo,
    origem: row.origem,
    leadTier: row.lead_tier,
    clusterNome: row.cluster_nome,
    conversaId: row.conversa_id,
    responsavelId: row.responsavel_id,
    motivoPerdaId: row.motivo_perda_id,
    fechadaEm: row.fechada_em,
    criadaEm: row.created_at,
  };
}

async function usuarioAtual(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function carregarEtapas(): Promise<Etapa[]> {
  const { data, error } = await supabase
    .schema("comercial")
    .from("etapas_funil")
    .select(ETAPA_COLS)
    .order("ordem", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as EtapaRow[]).map(mapEtapa);
}

/** Grava o evento de mudança de etapa. A oportunidade já foi escrita quando isto roda: o evento é
 * o histórico (fonte do ciclo de venda em E03-S08), e perdê-lo não pode desfazer a movimentação —
 * por isso o erro é propagado mas a ordem é esta, nunca o contrário. */
async function registrarEvento(
  oportunidadeId: string,
  etapaDe: string | null,
  etapaPara: string,
): Promise<void> {
  const { error } = await supabase
    .schema("comercial")
    .from("oportunidade_eventos")
    .insert({
      oportunidade_id: oportunidadeId,
      etapa_de: etapaDe,
      etapa_para: etapaPara,
      ator_id: await usuarioAtual(),
    });
  if (error) throw error;
}

export const supabaseComercialAdapter: ComercialGateway = {
  async listarContas(filtro: FiltroContas = {}) {
    // Conta vem da view (R2). Sem filtro implícito de `ativo` — o Comercial vê tudo (AC-7).
    let query = supabase.schema("relacionamento").from("contas").select(CONTA_COLS);

    if (filtro.situacao === "ativas") query = query.eq("ativo", true);
    if (filtro.situacao === "inativas") query = query.eq("ativo", false);

    const texto = filtro.texto?.trim();
    if (texto) query = query.or(`nome.ilike.%${texto}%,cnpj.ilike.%${texto}%`);

    const { data, error } = await query.order("nome", { ascending: true });
    if (error) throw error;
    const contas = (data ?? []) as ContaRow[];

    // Oportunidades abertas de todas as Contas de uma vez (evita N+1 por linha da lista).
    const [etapas, abertas] = await Promise.all([
      carregarEtapas(),
      supabase
        .schema("comercial")
        .from("oportunidades")
        .select("id,cliente_id,etapa_id,created_at")
        .is("fechada_em", null)
        .is("deleted_at", null),
    ]);
    if (abertas.error) throw abertas.error;

    const etapaPorId = new Map(etapas.map((e) => [e.id, e]));
    const porCliente = new Map<string, { etapaId: string; criadaEm: string }[]>();
    for (const row of (abertas.data ?? []) as {
      cliente_id: string;
      etapa_id: string;
      created_at: string;
    }[]) {
      const lista = porCliente.get(row.cliente_id) ?? [];
      lista.push({ etapaId: row.etapa_id, criadaEm: row.created_at });
      porCliente.set(row.cliente_id, lista);
    }

    const resultado: ContaComFunil[] = contas.map((row) => {
      const oportunidades = porCliente.get(row.id) ?? [];
      // Mais de uma oportunidade aberta é permitido; a lista mostra a mais recente.
      const maisRecente = oportunidades
        .slice()
        .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))[0];
      return {
        id: row.id,
        nome: row.nome,
        cnpj: row.cnpj,
        ativo: row.ativo,
        cidade: row.cidade,
        estado: row.estado,
        contatoNome: row.contato_nome,
        contatoTelefone: row.contato_telefone,
        contatoEmail: row.contato_email,
        auvoId: row.auvo_id,
        etapa: maisRecente ? (etapaPorId.get(maisRecente.etapaId) ?? null) : null,
        oportunidadesAbertas: oportunidades.length,
      };
    });

    // Filtro por etapa é aplicado depois porque a etapa vive na oportunidade, não na Conta.
    if (filtro.etapaId) {
      return resultado.filter((c) => c.etapa?.id === filtro.etapaId);
    }
    return resultado;
  },

  listarEtapas: carregarEtapas,

  async criarEtapa(input: EtapaCommand) {
    const { data, error } = await supabase
      .schema("comercial")
      .from("etapas_funil")
      .insert({
        nome: input.nome.trim(),
        ordem: input.ordem,
        cor: input.cor,
        tipo: input.tipo,
        created_by: await usuarioAtual(),
      })
      .select(ETAPA_COLS)
      .single();
    if (error) throw error;
    return mapEtapa(data as EtapaRow);
  },

  async editarEtapa(input: EditarEtapaCommand) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.nome !== undefined) patch.nome = input.nome.trim();
    if (input.ordem !== undefined) patch.ordem = input.ordem;
    if (input.cor !== undefined) patch.cor = input.cor;
    if (input.tipo !== undefined) patch.tipo = input.tipo;
    if (input.ativo !== undefined) patch.ativo = input.ativo;
    patch.updated_by = await usuarioAtual();

    const { data, error } = await supabase
      .schema("comercial")
      .from("etapas_funil")
      .update(patch)
      .eq("id", input.id)
      .select(ETAPA_COLS)
      .single();
    if (error) throw error;
    return mapEtapa(data as EtapaRow);
  },

  async listarMotivosPerda() {
    const { data, error } = await supabase
      .schema("comercial")
      .from("motivos_perda")
      .select(MOTIVO_COLS)
      .order("nome", { ascending: true });
    if (error) throw error;
    return (data ?? []) as MotivoPerda[];
  },

  async criarMotivoPerda(input: MotivoPerdaCommand) {
    const { data, error } = await supabase
      .schema("comercial")
      .from("motivos_perda")
      .insert({ nome: input.nome.trim(), created_by: await usuarioAtual() })
      .select(MOTIVO_COLS)
      .single();
    if (error) throw error;
    return data as MotivoPerda;
  },

  async editarMotivoPerda(input: EditarMotivoPerdaCommand) {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: await usuarioAtual(),
    };
    if (input.nome !== undefined) patch.nome = input.nome.trim();
    if (input.ativo !== undefined) patch.ativo = input.ativo;

    const { data, error } = await supabase
      .schema("comercial")
      .from("motivos_perda")
      .update(patch)
      .eq("id", input.id)
      .select(MOTIVO_COLS)
      .single();
    if (error) throw error;
    return data as MotivoPerda;
  },

  async listarOportunidadesDaConta(clienteId: string) {
    const { data, error } = await supabase
      .schema("comercial")
      .from("oportunidades")
      .select(OPORTUNIDADE_COLS)
      .eq("cliente_id", clienteId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as OportunidadeRow[]).map(mapOportunidade);
  },

  async criarOportunidade(input: CriarOportunidadeCommand) {
    const etapas = await carregarEtapas();
    // Sem etapa escolhida, nasce na primeira aberta. `etapaPadrao` lança se o funil não tiver
    // nenhuma — mensagem clara em vez de FK violation vinda do banco.
    const etapa = input.etapaId
      ? etapas.find((e) => e.id === input.etapaId)
      : etapaPadrao(etapas);
    if (!etapa) throw new Error("Etapa informada não existe no funil.");

    const problema = transicaoInvalida({ destino: etapa });
    if (problema) throw new Error(problema);

    const autor = await usuarioAtual();
    const { data, error } = await supabase
      .schema("comercial")
      .from("oportunidades")
      .insert({
        cliente_id: input.clienteId,
        etapa_id: etapa.id,
        titulo: validarTituloOportunidade(input.titulo),
        descricao: input.descricao ?? null,
        valor_estimado_centavos: validarValorEstimado(input.valorEstimadoCentavos),
        responsavel_id: input.responsavelId ?? autor,
        origem: input.origem ?? null,
        created_by: autor,
      })
      .select(OPORTUNIDADE_COLS)
      .single();
    if (error) throw error;

    const criada = mapOportunidade(data as OportunidadeRow);
    // Evento de entrada: `etapa_de` nulo marca o nascimento da oportunidade (AC-4).
    await registrarEvento(criada.id, null, etapa.id);
    return criada;
  },

  async moverOportunidade(input: MoverOportunidadeCommand) {
    const [etapas, atualRes] = await Promise.all([
      carregarEtapas(),
      supabase
        .schema("comercial")
        .from("oportunidades")
        .select("id,etapa_id")
        .eq("id", input.oportunidadeId)
        .single(),
    ]);
    if (atualRes.error) throw atualRes.error;

    const destino = etapas.find((e) => e.id === input.etapaDestinoId);
    if (!destino) throw new Error("Etapa de destino não existe no funil.");

    const problema = transicaoInvalida({
      destino,
      motivoPerdaId: input.motivoPerdaId ?? null,
    });
    if (problema) throw new Error(problema);

    const etapaAnterior = (atualRes.data as { etapa_id: string }).etapa_id;
    const mudanca = aplicarTransicao(destino, input.motivoPerdaId ?? null);

    const { data, error } = await supabase
      .schema("comercial")
      .from("oportunidades")
      .update({
        etapa_id: mudanca.etapaId,
        motivo_perda_id: mudanca.motivoPerdaId,
        fechada_em: mudanca.fechadaEm,
        updated_at: new Date().toISOString(),
        updated_by: await usuarioAtual(),
      })
      .eq("id", input.oportunidadeId)
      .select(OPORTUNIDADE_COLS)
      .single();
    if (error) throw error;

    // Etapa igual não gera evento — recarregar a tela ou soltar o card na mesma coluna não é
    // movimentação, e poluiria o cálculo de conversão do dashboard.
    if (etapaAnterior !== destino.id) {
      await registrarEvento(input.oportunidadeId, etapaAnterior, destino.id);
    }
    return mapOportunidade(data as OportunidadeRow);
  },
};
