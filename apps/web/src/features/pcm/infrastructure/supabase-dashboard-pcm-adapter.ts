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

function maxIso(datas: Array<string | null | undefined>): string | null {
  const ordenadas = datas
    .filter((data): data is string => Boolean(data))
    .sort((a, b) => b.localeCompare(a));
  return ordenadas[0] ?? null;
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
    const [clientes, tecnicos, equipamentos] = await Promise.all([
      supabase
        .schema("pcm")
        .from("clientes")
        .select("nome,auvo_id,ativo,endereco,contato_telefone,contato_email,updated_at")
        .is("deleted_at", null),
      supabase.schema("pcm").from("tecnicos_cache").select("auvo_user_id,equipe,ativo,updated_at"),
      supabase
        .schema("pcm")
        .from("equipamentos_cache")
        .select("auvo_equipment_id,auvo_customer_id,ativo,updated_at"),
    ]);

    if (clientes.error) throw clientes.error;
    if (tecnicos.error) throw tecnicos.error;
    if (equipamentos.error) throw equipamentos.error;

    const clientesRows = (clientes.data ?? []) as ClienteAuvoRow[];
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
      ]),
      topClientesEquipamentos: topClientesPorEquipamento(clientesAtivos, equipamentosAtivos),
    };
  },
};
