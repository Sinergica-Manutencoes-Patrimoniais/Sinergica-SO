import type {
  PmocCondicaoEquipamento,
  PmocSeveridadeNc,
  PmocStatusAgenda,
  PmocStatusContrato,
  PmocStatusMicrobio,
  PmocStatusNc,
  PmocTipoEquipamento,
  PmocTipoImovel,
  PmocTipoManutencao,
} from "../domain/pmoc";

export interface PmocClienteOpcao {
  id: string;
  auvoId: number | null;
  nome: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  cnpj: string | null;
  contatoNome: string | null;
  contatoTelefone: string | null;
  contatoEmail: string | null;
}

export interface PmocContratoResumo {
  id: string;
  propertyId: string;
  clientId: string | null;
  clienteNome: string;
  imovelNome: string;
  tipoImovel: PmocTipoImovel;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  contatoNome: string | null;
  contatoEmail: string | null;
  tecnicoNome: string;
  crea: string | null;
  artNumber: string | null;
  artDate: string | null;
  startDate: string;
  endDate: string;
  status: PmocStatusContrato;
  totalEquipamentos: number;
  visitasMes: number;
  visitasAtrasadas: number;
  proximaVisita: string | null;
  microbioPendentes: number;
  ncsAbertas: number;
}

export interface PmocEquipamento {
  id: string;
  propertyId: string;
  auvoEquipmentId: number | null;
  tag: string;
  type: PmocTipoEquipamento;
  brand: string | null;
  model: string | null;
  capacityBtu: number | null;
  location: string | null;
  environment: string | null;
  floor: string | null;
  refrigerant: string;
  phase: "mono" | "bi" | "tri" | null;
  condition: PmocCondicaoEquipamento;
  notes: string | null;
}

export interface PmocEquipamentoAuvoSugestao {
  auvoEquipmentId: number;
  nome: string;
  auvoCustomerId: number | null;
  updatedAt: string | null;
  jaImportado: boolean;
}

export interface PmocAgenda {
  id: string;
  contractId: string;
  propertyId: string;
  scheduledDate: string;
  maintenanceType: PmocTipoManutencao;
  monthRef: number;
  yearRef: number;
  status: PmocStatusAgenda;
  auvoOsId: string | null;
}

export interface PmocMicrobioAnalysis {
  id: string;
  contractId: string;
  propertyId: string;
  analysisDate: string;
  labName: string | null;
  fungiUfcM3: number | null;
  ieRatio: number | null;
  status: PmocStatusMicrobio;
  reportNumber: string | null;
  reportUrl: string | null;
}

export interface PmocNaoConformidade {
  id: string;
  contractId: string | null;
  equipmentId: string | null;
  tag: string | null;
  description: string;
  severity: PmocSeveridadeNc;
  recommendedAction: string | null;
  responsible: string | null;
  deadline: string | null;
  completedAt: string | null;
  status: PmocStatusNc;
}

export interface PmocDetalhe {
  contrato: PmocContratoResumo;
  equipamentos: PmocEquipamento[];
  sugestoesAuvo: PmocEquipamentoAuvoSugestao[];
  agenda: PmocAgenda[];
  microbiologia: PmocMicrobioAnalysis[];
  naoConformidades: PmocNaoConformidade[];
}

export interface CriarContratoPmocInput {
  clientId: string;
  imovelNome: string;
  tipoImovel: PmocTipoImovel;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  cnpjCpf: string | null;
  contatoNome: string | null;
  contatoCargo: string | null;
  contatoTelefone: string | null;
  contatoEmail: string | null;
  tecnicoNome: string;
  crea: string | null;
  artNumber: string | null;
  artDate: string | null;
  startDate: string;
  endDate: string;
  notes: string | null;
  equipamentos: Array<{
    auvoEquipmentId?: number | null;
    tag: string;
    type: PmocTipoEquipamento;
    location: string | null;
    capacityBtu: number | null;
  }>;
  createdBy: string;
}

export interface CriarEquipamentoPmocInput {
  propertyId: string;
  auvoEquipmentId: number | null;
  tag: string;
  type: PmocTipoEquipamento;
  brand: string | null;
  model: string | null;
  capacityBtu: number | null;
  location: string | null;
  environment: string | null;
  floor: string | null;
  refrigerant: string;
  phase: "mono" | "bi" | "tri" | null;
  condition: PmocCondicaoEquipamento;
  notes: string | null;
  createdBy: string;
}

export interface PmocGateway {
  listarClientes(): Promise<PmocClienteOpcao[]>;
  listarContratos(): Promise<PmocContratoResumo[]>;
  obterDetalheContrato(contractId: string): Promise<PmocDetalhe>;
  criarContrato(input: CriarContratoPmocInput): Promise<PmocContratoResumo>;
  criarEquipamento(input: CriarEquipamentoPmocInput): Promise<PmocEquipamento>;
}
