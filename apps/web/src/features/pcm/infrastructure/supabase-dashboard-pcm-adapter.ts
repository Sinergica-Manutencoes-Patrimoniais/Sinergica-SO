import { supabase } from "../../../lib/supabase-client";
import type { ClienteEquipamentosAuvo, DashboardPcmAuvoResumo } from "../domain/dashboard-pcm";

interface ClienteAuvoRow {
  nome: string;
  auvo_id: number | null;
  ativo: boolean;
  endereco: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  updated_at: string | null;
}

interface TecnicoAuvoRow {
  auvo_user_id: number;
  equipe: string | null;
  ativo: boolean;
  updated_at: string | null;
}

interface EquipamentoAuvoRow {
  auvo_equipment_id: number;
  auvo_customer_id: number | null;
  ativo: boolean;
  updated_at: string | null;
}

interface AuvoTaskSnapshotRow {
  anexos: unknown;
  checklist: unknown;
  pecas_consumidas: unknown;
  controle_horas: unknown;
  checkin_em: string | null;
  concluida_em: string | null;
  last_webhook_received_at: string | null;
}

interface OsEquipamentoAuvoRow {
  ordem_servico_id: string;
}

function maxIso(datas: Array<string | null | undefined>): string | null {
  const ordenadas = datas
    .filter((data): data is string => Boolean(data))
    .sort((a, b) => b.localeCompare(a));
  return ordenadas[0] ?? null;
}

function temConteudoJson(valor: unknown): boolean {
  if (Array.isArray(valor)) return valor.length > 0;
  if (valor && typeof valor === "object") return Object.keys(valor).length > 0;
  return false;
}

function isTabelaCampoAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    Boolean(error.message?.includes("schema cache") || error.message?.includes("does not exist"))
  );
}

function contarEquipes(tecnicos: TecnicoAuvoRow[]): number {
  const equipes = new Set(
    tecnicos
      .map((tecnico) => tecnico.equipe?.trim())
      .filter((equipe): equipe is string => Boolean(equipe)),
  );
  return equipes.size;
}

function topClientesPorEquipamento(
  clientes: ClienteAuvoRow[],
  equipamentos: EquipamentoAuvoRow[],
): ClienteEquipamentosAuvo[] {
  const clientesPorAuvoId = new Map(
    clientes
      .filter(
        (cliente): cliente is ClienteAuvoRow & { auvo_id: number } => cliente.auvo_id !== null,
      )
      .map((cliente) => [cliente.auvo_id, cliente.nome]),
  );
  const totais = new Map<number, number>();

  for (const equipamento of equipamentos) {
    if (equipamento.auvo_customer_id === null) continue;
    totais.set(equipamento.auvo_customer_id, (totais.get(equipamento.auvo_customer_id) ?? 0) + 1);
  }

  return [...totais.entries()]
    .map(([auvoId, total]) => ({
      auvoId,
      total,
      nome: clientesPorAuvoId.get(auvoId) ?? `Cliente Auvo ${auvoId}`,
    }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))
    .slice(0, 5);
}

export const supabaseDashboardPcmAdapter = {
  async obterResumoAuvo(): Promise<DashboardPcmAuvoResumo> {
    const [clientes, tecnicos, equipamentos, snapshots, osEquipamentos] = await Promise.all([
      supabase
        .schema("pcm")
        .from("clientes")
        .select("nome,auvo_id,ativo,endereco,contato_telefone,contato_email,updated_at")
        .is("deleted_at", null),
      supabase.schema("pcm").from("funcionarios").select("auvo_user_id,equipe,ativo,updated_at"),
      supabase
        .schema("pcm")
        .from("equipamentos")
        .select("auvo_equipment_id,auvo_customer_id,ativo,updated_at"),
      supabase
        .schema("pcm")
        .from("auvo_task_snapshots")
        .select(
          "anexos,checklist,pecas_consumidas,controle_horas,checkin_em,concluida_em,last_webhook_received_at",
        ),
      supabase.schema("pcm").from("os_equipamentos_auvo").select("ordem_servico_id"),
    ]);

    if (clientes.error) throw clientes.error;
    if (tecnicos.error) throw tecnicos.error;
    if (equipamentos.error) throw equipamentos.error;
    if (snapshots.error && !isTabelaCampoAusente(snapshots.error)) throw snapshots.error;
    if (osEquipamentos.error && !isTabelaCampoAusente(osEquipamentos.error)) {
      throw osEquipamentos.error;
    }

    const clientesRows = (clientes.data ?? []) as ClienteAuvoRow[];
    const snapshotsRows = snapshots.error ? [] : ((snapshots.data ?? []) as AuvoTaskSnapshotRow[]);
    const osEquipamentosRows = osEquipamentos.error
      ? []
      : ((osEquipamentos.data ?? []) as OsEquipamentoAuvoRow[]);
    const tecnicosAtivos = ((tecnicos.data ?? []) as TecnicoAuvoRow[]).filter(
      (tecnico) => tecnico.ativo,
    );
    const equipamentosAtivos = ((equipamentos.data ?? []) as EquipamentoAuvoRow[]).filter(
      (equipamento) => equipamento.ativo,
    );
    const clientesAtivos = clientesRows.filter((cliente) => cliente.ativo);
    const clientesComEquipamentos = new Set(
      equipamentosAtivos
        .map((equipamento) => equipamento.auvo_customer_id)
        .filter((id): id is number => id !== null),
    ).size;

    return {
      clientesAtivos: clientesAtivos.length,
      clientesSincronizados: clientesAtivos.filter((cliente) => cliente.auvo_id !== null).length,
      clientesComEndereco: clientesAtivos.filter((cliente) => Boolean(cliente.endereco)).length,
      clientesComContato: clientesAtivos.filter(
        (cliente) => Boolean(cliente.contato_telefone) || Boolean(cliente.contato_email),
      ).length,
      tecnicosAtivos: tecnicosAtivos.length,
      equipesTecnicas: contarEquipes(tecnicosAtivos),
      equipamentosAtivos: equipamentosAtivos.length,
      equipamentosVinculados: equipamentosAtivos.filter(
        (equipamento) => equipamento.auvo_customer_id !== null,
      ).length,
      equipamentosSemCliente: equipamentosAtivos.filter(
        (equipamento) => equipamento.auvo_customer_id === null,
      ).length,
      clientesComEquipamentos,
      ultimaAtualizacao: maxIso([
        ...clientesRows.map((cliente) => cliente.updated_at),
        ...tecnicosAtivos.map((tecnico) => tecnico.updated_at),
        ...equipamentosAtivos.map((equipamento) => equipamento.updated_at),
        ...snapshotsRows.map((snapshot) => snapshot.last_webhook_received_at),
      ]),
      topClientesEquipamentos: topClientesPorEquipamento(clientesAtivos, equipamentosAtivos),
      campo: {
        snapshotsRecebidos: snapshotsRows.length,
        snapshotsComAnexos: snapshotsRows.filter((snapshot) => temConteudoJson(snapshot.anexos))
          .length,
        checklistsRecebidos: snapshotsRows.filter((snapshot) => temConteudoJson(snapshot.checklist))
          .length,
        pecasRegistradas: snapshotsRows.filter((snapshot) =>
          temConteudoJson(snapshot.pecas_consumidas),
        ).length,
        controlesHoras: snapshotsRows.filter((snapshot) => temConteudoJson(snapshot.controle_horas))
          .length,
        osComEquipamentoVinculado: new Set(osEquipamentosRows.map((item) => item.ordem_servico_id))
          .size,
        ultimaExecucaoCampo: maxIso(
          snapshotsRows.flatMap((snapshot) => [
            snapshot.concluida_em,
            snapshot.checkin_em,
            snapshot.last_webhook_received_at,
          ]),
        ),
      },
    };
  },
};
