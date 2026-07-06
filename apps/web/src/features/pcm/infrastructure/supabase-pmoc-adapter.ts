import { supabase } from "../../../lib/supabase-client";
import type {
  CriarContratoPmocInput,
  CriarEquipamentoPmocInput,
  PmocAgenda,
  PmocClienteOpcao,
  PmocContratoResumo,
  PmocDetalhe,
  PmocEquipamento,
  PmocEquipamentoAuvoSugestao,
  PmocGateway,
  PmocMicrobioAnalysis,
  PmocNaoConformidade,
} from "../application/pmoc-gateway";
import { gerarCronogramaPmoc } from "../domain/pmoc";
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

interface ClienteRow {
  id: string;
  auvo_id: number | null;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
}

interface PropertyRow {
  id: string;
  client_id: string | null;
  name: string;
  type: PmocTipoImovel;
  address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  cnpj_cpf: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

interface ContractRow {
  id: string;
  property_id: string;
  technician_name: string;
  crea: string | null;
  art_number: string | null;
  art_date: string | null;
  start_date: string;
  end_date: string;
  status: PmocStatusContrato;
  notes: string | null;
}

interface EquipmentRow {
  id: string;
  property_id: string;
  auvo_equipment_id: number | null;
  tag: string;
  type: PmocTipoEquipamento;
  brand: string | null;
  model: string | null;
  capacity_btu: number | null;
  location: string | null;
  environment: string | null;
  floor: string | null;
  refrigerant: string;
  phase: "mono" | "bi" | "tri" | null;
  condition: PmocCondicaoEquipamento;
  notes: string | null;
}

interface ScheduleRow {
  id: string;
  contract_id: string;
  property_id: string;
  scheduled_date: string;
  maintenance_type: PmocTipoManutencao;
  month_ref: number;
  year_ref: number;
  status: PmocStatusAgenda;
  auvo_os_id: string | null;
}

interface MicrobioRow {
  id: string;
  contract_id: string;
  property_id: string;
  analysis_date: string;
  lab_name: string | null;
  fungi_ufc_m3: number | null;
  ie_ratio: number | null;
  status: PmocStatusMicrobio;
  report_number: string | null;
  report_url: string | null;
}

interface NcRow {
  id: string;
  contract_id: string | null;
  equipment_id: string | null;
  tag: string | null;
  description: string;
  severity: PmocSeveridadeNc;
  recommended_action: string | null;
  responsible: string | null;
  deadline: string | null;
  completed_at: string | null;
  status: PmocStatusNc;
}

interface AuvoEquipmentCacheRow {
  auvo_equipment_id: number;
  nome: string;
  auvo_customer_id: number | null;
  ativo: boolean;
  updated_at: string | null;
}

const PROPERTY_COLS =
  "id,client_id,name,type,address,city,state,zipcode,cnpj_cpf,contact_name,contact_role,contact_phone,contact_email" as const;
const CONTRACT_COLS =
  "id,property_id,technician_name,crea,art_number,art_date,start_date,end_date,status,notes" as const;
const EQUIPMENT_COLS =
  "id,property_id,auvo_equipment_id,tag,type,brand,model,capacity_btu,location,environment,floor,refrigerant,phase,condition,notes" as const;
const SCHEDULE_COLS =
  "id,contract_id,property_id,scheduled_date,maintenance_type,month_ref,year_ref,status,auvo_os_id" as const;
const MICROBIO_COLS =
  "id,contract_id,property_id,analysis_date,lab_name,fungi_ufc_m3,ie_ratio,status,report_number,report_url" as const;
const NC_COLS =
  "id,contract_id,equipment_id,tag,description,severity,recommended_action,responsible,deadline,completed_at,status" as const;

function isMissingPmocTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    Boolean(
      error.message?.includes("pmoc_") &&
        (error.message.includes("does not exist") || error.message.includes("schema cache")),
    )
  );
}

function hojeIso(): string {
  const hoje = new Date();
  hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  return hoje.toISOString().slice(0, 10);
}

function mesmoMes(dataIso: string, referencia = new Date()): boolean {
  const data = new Date(`${dataIso}T00:00:00`);
  return (
    data.getFullYear() === referencia.getFullYear() && data.getMonth() === referencia.getMonth()
  );
}

function mapClientes(rows: ClienteRow[]): Map<string, ClienteRow> {
  return new Map(rows.map((cliente) => [cliente.id, cliente]));
}

function mapEquipamento(row: EquipmentRow): PmocEquipamento {
  return {
    id: row.id,
    propertyId: row.property_id,
    auvoEquipmentId: row.auvo_equipment_id,
    tag: row.tag,
    type: row.type,
    brand: row.brand,
    model: row.model,
    capacityBtu: row.capacity_btu,
    location: row.location,
    environment: row.environment,
    floor: row.floor,
    refrigerant: row.refrigerant,
    phase: row.phase,
    condition: row.condition,
    notes: row.notes,
  };
}

function mapSugestoesAuvo(params: {
  auvoCustomerId: number | null | undefined;
  equipamentosAuvo: AuvoEquipmentCacheRow[];
  equipamentosPmoc: EquipmentRow[];
}): PmocEquipamentoAuvoSugestao[] {
  if (!params.auvoCustomerId) return [];
  const importados = new Set(
    params.equipamentosPmoc
      .map((equipamento) => equipamento.auvo_equipment_id)
      .filter((id): id is number => id !== null),
  );

  return params.equipamentosAuvo
    .filter(
      (equipamento) => equipamento.ativo && equipamento.auvo_customer_id === params.auvoCustomerId,
    )
    .map((equipamento) => ({
      auvoEquipmentId: equipamento.auvo_equipment_id,
      nome: equipamento.nome,
      auvoCustomerId: equipamento.auvo_customer_id,
      updatedAt: equipamento.updated_at,
      jaImportado: importados.has(equipamento.auvo_equipment_id),
    }))
    .sort((a, b) => Number(a.jaImportado) - Number(b.jaImportado) || a.nome.localeCompare(b.nome));
}

function mapAgenda(row: ScheduleRow): PmocAgenda {
  return {
    id: row.id,
    contractId: row.contract_id,
    propertyId: row.property_id,
    scheduledDate: row.scheduled_date,
    maintenanceType: row.maintenance_type,
    monthRef: row.month_ref,
    yearRef: row.year_ref,
    status: row.status,
    auvoOsId: row.auvo_os_id,
  };
}

function mapMicrobio(row: MicrobioRow): PmocMicrobioAnalysis {
  return {
    id: row.id,
    contractId: row.contract_id,
    propertyId: row.property_id,
    analysisDate: row.analysis_date,
    labName: row.lab_name,
    fungiUfcM3: row.fungi_ufc_m3,
    ieRatio: row.ie_ratio,
    status: row.status,
    reportNumber: row.report_number,
    reportUrl: row.report_url,
  };
}

function mapNc(row: NcRow): PmocNaoConformidade {
  return {
    id: row.id,
    contractId: row.contract_id,
    equipmentId: row.equipment_id,
    tag: row.tag,
    description: row.description,
    severity: row.severity,
    recommendedAction: row.recommended_action,
    responsible: row.responsible,
    deadline: row.deadline,
    completedAt: row.completed_at,
    status: row.status,
  };
}

function mapContratoResumo(params: {
  contrato: ContractRow;
  property: PropertyRow | undefined;
  clientes: Map<string, ClienteRow>;
  equipamentos: EquipmentRow[];
  agenda: ScheduleRow[];
  microbiologia: MicrobioRow[];
  ncs: NcRow[];
}): PmocContratoResumo {
  const property = params.property;
  const cliente = property?.client_id ? params.clientes.get(property.client_id) : undefined;
  const hoje = hojeIso();
  const agendaAberta = params.agenda
    .filter((agenda) => agenda.status === "agendado" || agenda.status === "atrasado")
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  return {
    id: params.contrato.id,
    propertyId: params.contrato.property_id,
    clientId: property?.client_id ?? null,
    clienteNome: cliente?.nome ?? property?.name ?? "Cliente não identificado",
    imovelNome: property?.name ?? "Imóvel PMOC",
    tipoImovel: property?.type ?? "outro",
    endereco: property?.address ?? cliente?.endereco ?? null,
    cidade: property?.city ?? cliente?.cidade ?? null,
    estado: property?.state ?? cliente?.estado ?? null,
    contatoNome: property?.contact_name ?? cliente?.contato_nome ?? null,
    contatoEmail: property?.contact_email ?? cliente?.contato_email ?? null,
    tecnicoNome: params.contrato.technician_name,
    crea: params.contrato.crea,
    artNumber: params.contrato.art_number,
    artDate: params.contrato.art_date,
    startDate: params.contrato.start_date,
    endDate: params.contrato.end_date,
    status: params.contrato.status,
    totalEquipamentos: params.equipamentos.length,
    visitasMes: params.agenda.filter((agenda) => mesmoMes(agenda.scheduled_date)).length,
    visitasAtrasadas: params.agenda.filter(
      (agenda) =>
        agenda.status === "atrasado" ||
        (agenda.status === "agendado" && agenda.scheduled_date < hoje),
    ).length,
    proximaVisita:
      agendaAberta.find((agenda) => agenda.scheduled_date >= hoje)?.scheduled_date ??
      agendaAberta[0]?.scheduled_date ??
      null,
    microbioPendentes: params.microbiologia.filter((item) => item.status === "pendente").length,
    ncsAbertas: params.ncs.filter((nc) => nc.status !== "fechado").length,
  };
}

async function listarClientes(): Promise<PmocClienteOpcao[]> {
  const { data, error } = await supabase
    .schema("pcm")
    .from("clientes")
    .select(
      "id,auvo_id,nome,cnpj,endereco,cidade,estado,cep,contato_nome,contato_telefone,contato_email",
    )
    .eq("ativo", true)
    .is("deleted_at", null)
    .order("nome", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as ClienteRow[]).map((cliente) => ({
    id: cliente.id,
    auvoId: cliente.auvo_id,
    nome: cliente.nome,
    endereco: cliente.endereco,
    cidade: cliente.cidade,
    estado: cliente.estado,
    cep: cliente.cep,
    cnpj: cliente.cnpj,
    contatoNome: cliente.contato_nome,
    contatoTelefone: cliente.contato_telefone,
    contatoEmail: cliente.contato_email,
  }));
}

async function carregarDataset() {
  const [
    clientes,
    properties,
    contratos,
    equipamentos,
    equipamentosAuvo,
    agenda,
    microbiologia,
    ncs,
  ] = await Promise.all([
    supabase
      .schema("pcm")
      .from("clientes")
      .select(
        "id,auvo_id,nome,cnpj,endereco,cidade,estado,cep,contato_nome,contato_telefone,contato_email",
      )
      .is("deleted_at", null),
    supabase.schema("pcm").from("pmoc_properties").select(PROPERTY_COLS).is("deleted_at", null),
    supabase
      .schema("pcm")
      .from("pmoc_contracts")
      .select(CONTRACT_COLS)
      .is("deleted_at", null)
      .order("end_date", { ascending: true }),
    supabase
      .schema("pcm")
      .from("pmoc_equipment")
      .select(EQUIPMENT_COLS)
      .eq("active", true)
      .is("deleted_at", null),
    supabase
      .schema("pcm")
      .from("equipamentos_cache")
      .select("auvo_equipment_id,nome,auvo_customer_id,ativo,updated_at"),
    supabase
      .schema("pcm")
      .from("pmoc_schedules")
      .select(SCHEDULE_COLS)
      .order("scheduled_date", { ascending: true }),
    supabase
      .schema("pcm")
      .from("pmoc_microbio_analysis")
      .select(MICROBIO_COLS)
      .order("analysis_date", { ascending: false }),
    supabase.schema("pcm").from("pmoc_nonconformity_log").select(NC_COLS),
  ]);

  if (clientes.error) throw clientes.error;
  if (
    [
      properties.error,
      contratos.error,
      equipamentos.error,
      equipamentosAuvo.error,
      agenda.error,
      microbiologia.error,
      ncs.error,
    ].some(isMissingPmocTable)
  ) {
    return {
      clientes: (clientes.data ?? []) as ClienteRow[],
      properties: [],
      contratos: [],
      equipamentos: [],
      equipamentosAuvo: [],
      agenda: [],
      microbiologia: [],
      ncs: [],
    };
  }
  if (properties.error) throw properties.error;
  if (contratos.error) throw contratos.error;
  if (equipamentos.error) throw equipamentos.error;
  if (equipamentosAuvo.error) throw equipamentosAuvo.error;
  if (agenda.error) throw agenda.error;
  if (microbiologia.error) throw microbiologia.error;
  if (ncs.error) throw ncs.error;

  return {
    clientes: (clientes.data ?? []) as ClienteRow[],
    properties: (properties.data ?? []) as PropertyRow[],
    contratos: (contratos.data ?? []) as ContractRow[],
    equipamentos: (equipamentos.data ?? []) as EquipmentRow[],
    equipamentosAuvo: (equipamentosAuvo.data ?? []) as AuvoEquipmentCacheRow[],
    agenda: (agenda.data ?? []) as ScheduleRow[],
    microbiologia: (microbiologia.data ?? []) as MicrobioRow[],
    ncs: (ncs.data ?? []) as NcRow[],
  };
}

export const supabasePmocAdapter: PmocGateway = {
  listarClientes,

  async listarContratos(): Promise<PmocContratoResumo[]> {
    const dataset = await carregarDataset();
    const clientes = mapClientes(dataset.clientes);
    const properties = new Map(dataset.properties.map((property) => [property.id, property]));

    return dataset.contratos.map((contrato) =>
      mapContratoResumo({
        contrato,
        property: properties.get(contrato.property_id),
        clientes,
        equipamentos: dataset.equipamentos.filter(
          (item) => item.property_id === contrato.property_id,
        ),
        agenda: dataset.agenda.filter((item) => item.contract_id === contrato.id),
        microbiologia: dataset.microbiologia.filter((item) => item.contract_id === contrato.id),
        ncs: dataset.ncs.filter((item) => item.contract_id === contrato.id),
      }),
    );
  },

  async obterDetalheContrato(contractId: string): Promise<PmocDetalhe> {
    const dataset = await carregarDataset();
    const contrato = dataset.contratos.find((item) => item.id === contractId);
    if (!contrato) throw new Error("Contrato PMOC não encontrado.");
    const clientes = mapClientes(dataset.clientes);
    const property = dataset.properties.find((item) => item.id === contrato.property_id);
    const cliente = property?.client_id ? clientes.get(property.client_id) : undefined;
    const equipamentos = dataset.equipamentos.filter(
      (item) => item.property_id === contrato.property_id,
    );
    const agenda = dataset.agenda.filter((item) => item.contract_id === contrato.id);
    const microbiologia = dataset.microbiologia.filter((item) => item.contract_id === contrato.id);
    const ncs = dataset.ncs.filter((item) => item.contract_id === contrato.id);

    return {
      contrato: mapContratoResumo({
        contrato,
        property,
        clientes,
        equipamentos,
        agenda,
        microbiologia,
        ncs,
      }),
      equipamentos: equipamentos.map(mapEquipamento),
      sugestoesAuvo: mapSugestoesAuvo({
        auvoCustomerId: cliente?.auvo_id,
        equipamentosAuvo: dataset.equipamentosAuvo,
        equipamentosPmoc: equipamentos,
      }),
      agenda: agenda.map(mapAgenda),
      microbiologia: microbiologia.map(mapMicrobio),
      naoConformidades: ncs.map(mapNc),
    };
  },

  async criarContrato(input: CriarContratoPmocInput): Promise<PmocContratoResumo> {
    const { data: property, error: propertyError } = await supabase
      .schema("pcm")
      .from("pmoc_properties")
      .insert({
        client_id: input.clientId,
        name: input.imovelNome,
        type: input.tipoImovel,
        address: input.endereco,
        city: input.cidade,
        state: input.estado,
        zipcode: input.cep,
        cnpj_cpf: input.cnpjCpf,
        contact_name: input.contatoNome,
        contact_role: input.contatoCargo,
        contact_phone: input.contatoTelefone,
        contact_email: input.contatoEmail,
        created_by: input.createdBy,
      })
      .select(PROPERTY_COLS)
      .single();
    if (propertyError) throw propertyError;

    const propertyRow = property as PropertyRow;
    const { data: contrato, error: contratoError } = await supabase
      .schema("pcm")
      .from("pmoc_contracts")
      .insert({
        property_id: propertyRow.id,
        technician_name: input.tecnicoNome,
        crea: input.crea,
        art_number: input.artNumber,
        art_date: input.artDate,
        start_date: input.startDate,
        end_date: input.endDate,
        notes: input.notes,
        created_by: input.createdBy,
      })
      .select(CONTRACT_COLS)
      .single();
    if (contratoError) throw contratoError;

    const contratoRow = contrato as ContractRow;
    const agenda = gerarCronogramaPmoc(input.startDate).map((item) => ({
      contract_id: contratoRow.id,
      property_id: propertyRow.id,
      scheduled_date: item.scheduledDate,
      maintenance_type: item.maintenanceType,
      month_ref: item.monthRef,
      year_ref: item.yearRef,
      created_by: input.createdBy,
    }));
    const { error: agendaError } = await supabase
      .schema("pcm")
      .from("pmoc_schedules")
      .insert(agenda);
    if (agendaError) throw agendaError;

    if (input.equipamentos.length > 0) {
      const { error: equipamentosError } = await supabase
        .schema("pcm")
        .from("pmoc_equipment")
        .insert(
          input.equipamentos.map((equipamento) => ({
            property_id: propertyRow.id,
            auvo_equipment_id: equipamento.auvoEquipmentId ?? null,
            tag: equipamento.tag,
            type: equipamento.type,
            location: equipamento.location,
            capacity_btu: equipamento.capacityBtu,
            created_by: input.createdBy,
          })),
        );
      if (equipamentosError) throw equipamentosError;
    }

    const detalhe = await this.obterDetalheContrato(contratoRow.id);
    return detalhe.contrato;
  },

  async criarEquipamento(input: CriarEquipamentoPmocInput): Promise<PmocEquipamento> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("pmoc_equipment")
      .insert({
        property_id: input.propertyId,
        auvo_equipment_id: input.auvoEquipmentId,
        tag: input.tag,
        type: input.type,
        brand: input.brand,
        model: input.model,
        capacity_btu: input.capacityBtu,
        location: input.location,
        environment: input.environment,
        floor: input.floor,
        refrigerant: input.refrigerant,
        phase: input.phase,
        condition: input.condition,
        notes: input.notes,
        created_by: input.createdBy,
      })
      .select(EQUIPMENT_COLS)
      .single();

    if (error) throw error;
    return mapEquipamento(data as EquipmentRow);
  },
};
