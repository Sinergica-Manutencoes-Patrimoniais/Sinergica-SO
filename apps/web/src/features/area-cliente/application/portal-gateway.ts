export interface PortalCliente {
  id: string;
  nome: string;
  cnpj: string | null;
}

export interface PortalOs {
  id: string;
  numero: string;
  titulo: string;
  status: string;
  categoria: string;
  createdAt: string;
}

export interface PortalChamado {
  id: string;
  numero: string;
  titulo: string;
  descricao: string | null;
  status: string;
  createdAt: string;
}

export interface PortalHistoricoItem {
  id: string;
  referenciaId: string;
  texto: string;
  autor: string | null;
  createdAt: string;
}

export interface PortalAssessmentItem {
  id: string;
  descricao: string;
  resultado: string;
  responsavel: string | null;
  fotoPath: string | null;
}

export interface PortalAssessment {
  id: string;
  titulo: string;
  data: string;
  status: string;
  itens: PortalAssessmentItem[];
}

export interface PortalVisita {
  id: string;
  data: string;
  tipo: string;
  status: string;
}

export interface PortalConformidade {
  id: string;
  titulo: string;
  venceEm: string;
  status: "vigente" | "vencendo" | "vencido";
}

export interface PortalDocumento {
  id: string;
  tipo: "PMOC" | "SPDA" | "Assessment" | "Relatório";
  titulo: string;
  data: string;
  bucket: string | null;
  path: string | null;
  conteudo: string | null;
}

export interface PortalNotificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lidaAt: string | null;
  createdAt: string;
}

// E03-S06: proposta comercial vista pelo síndico (via `comercial.portal_propostas`, migration
// 0188). `payload` é o snapshot da versão vigente (`proposta_versoes.payload`) — é dele que o
// PDF é montado (AC-2), com `formatarTextoProposta` do domínio `comercial`.
export interface PortalProposta {
  id: string;
  tipo: string;
  status: string;
  escopo: string | null;
  precoCentavos: number;
  validoAte: string | null;
  versaoAtual: number;
  payload: unknown;
}

export interface PortalOrcamento {
  id: string;
  numero: string;
  titulo: string;
  itens: Array<{ descricao?: string; quantidade?: number; valor_centavos?: number }>;
  valorCentavos: number;
  status: string;
  validoAte: string | null;
}

export interface PortalFatura {
  id: string;
  descricao: string | null;
  valorCentavos: number;
  vencimento: string | null;
  pagamento: string | null;
  status: string;
  segundaVia: {
    tipo: string;
    linhaDigitavel: string | null;
    qrCode: string | null;
    link: string | null;
  } | null;
}

export interface PortalSnapshot {
  cliente: PortalCliente;
  os: PortalOs[];
  chamados: PortalChamado[];
  chamadoEventos: PortalHistoricoItem[];
  chamadoInteracoes: PortalHistoricoItem[];
  osNotas: PortalHistoricoItem[];
  assessments: PortalAssessment[];
  visitas: PortalVisita[];
  conformidade: PortalConformidade[];
  documentos: PortalDocumento[];
  notificacoes: PortalNotificacao[];
  orcamentos: PortalOrcamento[];
  propostas: PortalProposta[];
  faturas: PortalFatura[];
  osAguardandoAvaliacao: PortalOs[];
}

export interface PortalGateway {
  carregar(): Promise<PortalSnapshot>;
  abrirChamado(titulo: string, descricao: string, arquivo?: File): Promise<void>;
  comentarChamado(chamadoId: string, mensagem: string, arquivo?: File): Promise<void>;
  adicionarNotaOs(osId: string, mensagem: string, arquivo?: File): Promise<void>;
  marcarNotificacaoLida(id: string): Promise<void>;
  responderSatisfacao(osId: string, csat: number, nps: number, comentario: string): Promise<void>;
  decidirOrcamento(id: string, decisao: "aprovado" | "recusado", motivo?: string): Promise<void>;
  /** E03-S06 AC-5/AC-6/AC-7/AC-8: aceite/recusa da proposta — RPC `comercial.fn_decidir_proposta`
   * (migration 0189), idempotente e com a guarda de validade no próprio banco. */
  decidirProposta(id: string, decisao: "aceita" | "recusada", motivo?: string): Promise<void>;
  urlAssinada(bucket: string, path: string): Promise<string>;
}
