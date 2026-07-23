import { supabase } from "../../../lib/supabase-client";
import type {
  PortalAssessment,
  PortalChamado,
  PortalConformidade,
  PortalDocumento,
  PortalFatura,
  PortalGateway,
  PortalHistoricoItem,
  PortalNotificacao,
  PortalOrcamento,
  PortalOs,
  PortalSnapshot,
  PortalVisita,
} from "../application/portal-gateway";
import { statusConformidade } from "../domain/conformidade";

function falha(error: { message?: string } | null, contexto: string) {
  if (error) throw new Error(`${contexto}: ${error.message ?? "erro desconhecido"}`);
}

function decodificarJwt(token: string): Record<string, unknown> {
  const trecho = token.split(".")[1];
  if (!trecho) return {};
  const base64 = trecho
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(trecho.length / 4) * 4, "=");
  return JSON.parse(atob(base64)) as Record<string, unknown>;
}

async function contexto() {
  const { data } = await supabase.auth.getSession();
  const sessao = data.session;
  if (!sessao) throw new Error("Sessão expirada.");
  const claims = decodificarJwt(sessao.access_token);
  const clienteId = typeof claims.cliente_id === "string" ? claims.cliente_id : null;
  if (!clienteId) throw new Error("Acesso sem condomínio vinculado.");
  return { clienteId, userId: sessao.user.id };
}

async function upload(bucket: string, clienteId: string, arquivo: File): Promise<string> {
  if (arquivo.size > 10 * 1024 * 1024) throw new Error("Arquivo excede 10 MB.");
  if (!["image/jpeg", "image/png", "application/pdf"].includes(arquivo.type)) {
    throw new Error("Tipo de arquivo não permitido.");
  }
  const nomeSeguro = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${clienteId}/${crypto.randomUUID()}-${nomeSeguro}`;
  const { error } = await supabase.storage.from(bucket).upload(path, arquivo, { upsert: false });
  falha(error, "Falha no envio do arquivo");
  return path;
}

export const supabasePortalAdapter: PortalGateway = {
  async carregar(): Promise<PortalSnapshot> {
    const { clienteId } = await contexto();
    const pcm = supabase.schema("pcm");

    const [
      clienteR,
      osR,
      chamadosR,
      chamadoEventosR,
      chamadoInteracoesR,
      osNotasR,
      inspecoesR,
      propsR,
      spdaR,
      notificacoesR,
      orcamentosR,
      satisfacaoR,
      faturasR,
      cobrancasR,
    ] = await Promise.all([
      pcm.from("clientes").select("id,nome,cnpj").eq("id", clienteId).single(),
      pcm
        .from("ordens_servico")
        .select("id,numero,titulo,status,categoria,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      pcm
        .from("chamados")
        .select("id,numero,titulo,descricao,status,created_at")
        .order("created_at", { ascending: false }),
      pcm.from("chamados_eventos").select("id,chamado_id,tipo,created_at").order("created_at"),
      pcm
        .from("chamados_interacoes")
        .select("id,chamado_id,mensagem,autor_tipo,created_at")
        .order("created_at"),
      pcm
        .from("os_notas")
        .select("id,ordem_servico_id,mensagem,autor_tipo,created_at")
        .order("created_at"),
      pcm
        .from("inspecoes")
        .select("id,titulo,data_inspecao,status")
        .eq("e_assessment", true)
        .order("data_inspecao", { ascending: false }),
      pcm.from("pmoc_properties").select("id").eq("client_id", clienteId),
      pcm
        .from("laudos_spda")
        .select("id,numero,data_vistoria,status")
        .order("data_vistoria", { ascending: false }),
      pcm
        .from("portal_notificacoes")
        .select("id,titulo,mensagem,tipo,lida_at,created_at")
        .order("created_at", { ascending: false }),
      pcm
        .from("orcamentos_servico")
        .select("id,numero,titulo,itens,valor_total_centavos,status,valido_ate")
        .order("created_at", { ascending: false }),
      pcm.from("portal_satisfacao").select("ordem_servico_id"),
      supabase
        .schema("financeiro")
        .from("portal_faturas")
        .select("id,descricao,valor_centavos,data_vencimento,data_pagamento,status")
        .order("data_vencimento", { ascending: false }),
      supabase
        .schema("financeiro")
        .from("portal_cobrancas")
        .select("lancamento_id,tipo,linha_digitavel,qr_code,link_pagamento,status"),
    ]);

    for (const [r, nome] of [
      [clienteR, "cliente"],
      [osR, "OS"],
      [chamadosR, "chamados"],
      [chamadoEventosR, "histórico de chamados"],
      [chamadoInteracoesR, "interações de chamados"],
      [osNotasR, "notas de OS"],
      [inspecoesR, "assessments"],
      [propsR, "PMOC"],
      [notificacoesR, "notificações"],
      [orcamentosR, "orçamentos"],
      [faturasR, "financeiro"],
    ] as const) {
      falha(r.error, `Falha ao carregar ${nome}`);
    }

    const os: PortalOs[] = (osR.data ?? []).map((row) => ({
      id: row.id,
      numero: row.numero,
      titulo: row.titulo,
      status: row.status,
      categoria: row.categoria,
      createdAt: row.created_at,
    }));

    const chamados: PortalChamado[] = (chamadosR.data ?? []).map((row) => ({
      id: row.id,
      numero: row.numero,
      titulo: row.titulo,
      descricao: row.descricao,
      status: row.status,
      createdAt: row.created_at,
    }));
    const chamadoEventos: PortalHistoricoItem[] = (chamadoEventosR.data ?? []).map((row) => ({
      id: row.id,
      referenciaId: row.chamado_id,
      texto: row.tipo.replaceAll("_", " "),
      autor: null,
      createdAt: row.created_at,
    }));
    const chamadoInteracoes: PortalHistoricoItem[] = (chamadoInteracoesR.data ?? []).map((row) => ({
      id: row.id,
      referenciaId: row.chamado_id,
      texto: row.mensagem ?? "Anexo enviado",
      autor: row.autor_tipo,
      createdAt: row.created_at,
    }));
    const osNotas: PortalHistoricoItem[] = (osNotasR.data ?? []).map((row) => ({
      id: row.id,
      referenciaId: row.ordem_servico_id,
      texto: row.mensagem ?? "Anexo enviado",
      autor: row.autor_tipo,
      createdAt: row.created_at,
    }));

    const inspecaoIds = (inspecoesR.data ?? []).map((row) => row.id);
    const itensR = inspecaoIds.length
      ? await pcm
          .from("inspecao_itens")
          .select("id,inspecao_id,descricao,resultado,destino_responsavel,foto_url,midias")
          .in("inspecao_id", inspecaoIds)
          .order("ordem")
      : { data: [], error: null };
    falha(itensR.error, "Falha ao carregar itens de assessment");
    const assessments: PortalAssessment[] = (inspecoesR.data ?? []).map((row) => ({
      id: row.id,
      titulo: row.titulo,
      data: row.data_inspecao,
      status: row.status,
      itens: (itensR.data ?? [])
        .filter((item) => item.inspecao_id === row.id)
        .map((item) => ({
          id: item.id,
          descricao: item.descricao,
          resultado: item.resultado,
          responsavel: item.destino_responsavel,
          fotoPath:
            item.foto_url ??
            (Array.isArray(item.midias) && typeof item.midias[0]?.path === "string"
              ? item.midias[0].path
              : null),
        })),
    }));

    const propertyIds = (propsR.data ?? []).map((row) => row.id);
    const [contratosR, visitasR, recordsR] = propertyIds.length
      ? await Promise.all([
          pcm
            .from("pmoc_contracts")
            .select("id,art_number,end_date,status")
            .in("property_id", propertyIds),
          pcm
            .from("pmoc_schedules")
            .select("id,scheduled_date,maintenance_type,status")
            .in("property_id", propertyIds)
            .order("scheduled_date"),
          pcm
            .from("pmoc_records")
            .select("id,executed_date,pdf_url,auvo_os_number")
            .in("property_id", propertyIds)
            .order("executed_date", { ascending: false }),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];
    falha(contratosR.error, "Falha ao carregar conformidade");
    falha(visitasR.error, "Falha ao carregar cronograma");
    falha(recordsR.error, "Falha ao carregar documentos PMOC");

    const visitas: PortalVisita[] = (visitasR.data ?? []).map((row) => ({
      id: row.id,
      data: row.scheduled_date,
      tipo: row.maintenance_type,
      status: row.status,
    }));
    const conformidade: PortalConformidade[] = (contratosR.data ?? []).map((row) => ({
      id: row.id,
      titulo: row.art_number ? `ART ${row.art_number}` : "Contrato PMOC",
      venceEm: row.end_date,
      status: statusConformidade(row.end_date),
    }));

    const documentos: PortalDocumento[] = [
      ...(recordsR.data ?? []).map((row) => ({
        id: row.id,
        tipo: "PMOC" as const,
        titulo: row.auvo_os_number ? `Laudo PMOC ${row.auvo_os_number}` : "Laudo PMOC",
        data: row.executed_date,
        bucket: row.pdf_url ? "pmoc-laudos" : null,
        path: row.pdf_url,
      })),
      ...(spdaR.data ?? []).map((row) => ({
        id: row.id,
        tipo: "SPDA" as const,
        titulo: `Laudo SPDA ${row.numero}`,
        data: row.data_vistoria,
        bucket: null,
        path: null,
      })),
    ].sort((a, b) => b.data.localeCompare(a.data));

    const notificacoes: PortalNotificacao[] = (notificacoesR.data ?? []).map((row) => ({
      id: row.id,
      titulo: row.titulo,
      mensagem: row.mensagem,
      tipo: row.tipo,
      lidaAt: row.lida_at,
      createdAt: row.created_at,
    }));
    const orcamentos: PortalOrcamento[] = (orcamentosR.data ?? []).map((row) => ({
      id: row.id,
      numero: row.numero,
      titulo: row.titulo,
      itens: Array.isArray(row.itens) ? row.itens : [],
      valorCentavos: row.valor_total_centavos,
      status: row.status,
      validoAte: row.valido_ate,
    }));
    const cobrancas = new Map((cobrancasR.data ?? []).map((c) => [c.lancamento_id, c]));
    const faturas: PortalFatura[] = (faturasR.data ?? []).map((row) => {
      const c = cobrancas.get(row.id);
      return {
        id: row.id,
        descricao: row.descricao,
        valorCentavos: row.valor_centavos,
        vencimento: row.data_vencimento,
        pagamento: row.data_pagamento,
        status: row.status,
        segundaVia: c
          ? {
              tipo: c.tipo,
              linhaDigitavel: c.linha_digitavel,
              qrCode: c.qr_code,
              link: c.link_pagamento,
            }
          : null,
      };
    });
    const avaliadas = new Set((satisfacaoR.data ?? []).map((row) => row.ordem_servico_id));

    if (!clienteR.data) throw new Error("Condomínio vinculado não encontrado.");
    return {
      cliente: clienteR.data,
      os,
      chamados,
      chamadoEventos,
      chamadoInteracoes,
      osNotas,
      assessments,
      visitas,
      conformidade,
      documentos,
      notificacoes,
      orcamentos,
      faturas,
      osAguardandoAvaliacao: os.filter(
        (item) => item.status === "concluida" && !avaliadas.has(item.id),
      ),
    };
  },

  async abrirChamado(titulo, descricao, arquivo) {
    const { clienteId, userId } = await contexto();
    const { data: numero, error: numeroError } = await supabase
      .schema("pcm")
      .rpc("fn_proximo_numero_chamado");
    falha(numeroError, "Falha ao numerar chamado");
    const { data: chamado, error } = await supabase
      .schema("pcm")
      .from("chamados")
      .insert({
        numero,
        cliente_id: clienteId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        origem: "cliente_portal",
        status: "aberto",
        solicitante: "Portal do Cliente",
        created_by: userId,
      })
      .select("id")
      .single();
    falha(error, "Falha ao abrir chamado");
    if (chamado) {
      const { error: eventoError } = await supabase.schema("pcm").from("chamados_eventos").insert({
        chamado_id: chamado.id,
        tipo: "criado",
        metadata: { numero },
        created_by: userId,
      });
      falha(eventoError, "Chamado criado, mas o histórico não pôde ser iniciado");
    }
    if (arquivo && chamado) {
      const anexoPath = await upload("portal-chamados-anexos", clienteId, arquivo);
      const { error: anexoError } = await supabase
        .schema("pcm")
        .from("chamados_interacoes")
        .insert({
          chamado_id: chamado.id,
          cliente_id: clienteId,
          anexo_path: anexoPath,
          autor_tipo: "cliente",
          created_by: userId,
        });
      falha(anexoError, "Chamado criado, mas o anexo não pôde ser vinculado");
    }
  },

  async comentarChamado(chamadoId, mensagem, arquivo) {
    const { clienteId, userId } = await contexto();
    const anexoPath = arquivo ? await upload("portal-chamados-anexos", clienteId, arquivo) : null;
    const { error } = await supabase
      .schema("pcm")
      .from("chamados_interacoes")
      .insert({
        chamado_id: chamadoId,
        cliente_id: clienteId,
        mensagem: mensagem.trim() || null,
        anexo_path: anexoPath,
        autor_tipo: "cliente",
        created_by: userId,
      });
    falha(error, "Falha ao comentar chamado");
  },

  async adicionarNotaOs(osId, mensagem, arquivo) {
    const { clienteId, userId } = await contexto();
    const anexoPath = arquivo ? await upload("os-anexos", clienteId, arquivo) : null;
    const { error } = await supabase
      .schema("pcm")
      .from("os_notas")
      .insert({
        ordem_servico_id: osId,
        cliente_id: clienteId,
        mensagem: mensagem.trim() || null,
        anexo_path: anexoPath,
        autor_tipo: "cliente",
        created_by: userId,
      });
    falha(error, "Falha ao adicionar nota");
  },

  async marcarNotificacaoLida(id) {
    const { error } = await supabase
      .schema("pcm")
      .rpc("portal_marcar_notificacao_lida", { p_notificacao_id: id });
    falha(error, "Falha ao marcar notificação");
  },

  async responderSatisfacao(osId, csat, nps, comentario) {
    const { clienteId, userId } = await contexto();
    const { error } = await supabase
      .schema("pcm")
      .from("portal_satisfacao")
      .insert({
        ordem_servico_id: osId,
        cliente_id: clienteId,
        csat,
        nps,
        comentario: comentario.trim() || null,
        created_by: userId,
      });
    falha(error, "Falha ao registrar avaliação");
  },

  async decidirOrcamento(id, decisao, motivo) {
    const { error } = await supabase.schema("pcm").rpc("portal_decidir_orcamento", {
      p_orcamento_id: id,
      p_decisao: decisao,
      p_motivo: motivo?.trim() || null,
    });
    falha(error, "Falha ao decidir orçamento");
  },

  async urlAssinada(bucket, path) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    falha(error, "Falha ao gerar link temporário");
    if (!data?.signedUrl) throw new Error("Link temporário indisponível.");
    return data.signedUrl;
  },
};
