import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { semanaCapacidade } from "../domain/semana-capacidade";
import type { CapacidadeCronograma } from "../application/cronograma-fotografia";

const minutos = z.number().int().nonnegative().safe();
const snapshot = z.object({ clienteId: z.string().uuid(), semanaInicio: z.string().date(), completude: z.literal("desconhecida"),
  limiteDisponibilidadesAtingido: z.boolean(), disponibilidades: z.array(z.object({ id: z.string().uuid(), funcionario_id: z.string().uuid(),
    semana_inicio: z.string().date(), revisao: z.number().int().positive(), destinados_minutos: minutos, reservas_minutos: minutos,
    ausencias_minutos: minutos }).passthrough()).max(100) }).passthrough();

/** Subtotais declarados, sem saldo, deduplicação de intervalos ou prova de cobertura. */
export async function consultarCapacidadeCronograma(userId: string, clienteId: string, inicio: string, fim: string, signal?: AbortSignal): Promise<CapacidadeCronograma> {
  const primeira = semanaCapacidade(inicio); const ultima = semanaCapacidade(fim);
  if (!primeira || !ultima || primeira.inicio > ultima.inicio) throw new Error("Período inválido.");
  const dados: CapacidadeCronograma = [];
  let semana = primeira.inicio;
  while (semana <= ultima.inicio) {
    if (dados.length >= 54) throw new Error("Período de capacidade excede limite.");
    signal?.throwIfAborted();
    const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
    let chamada = supabase.schema("pcm").rpc("sso_snapshot_capacidade_autorizado", { p_cliente_id: clienteId, p_semana_inicio: semana, p_versao: 4 });
    if (signal) chamada = chamada.abortSignal(signal);
    const { data, error } = await chamada; if (error) throw error;
    const r = snapshot.parse(data); if (r.clienteId.toLowerCase() !== clienteId.toLowerCase() || r.semanaInicio !== semana) throw new Error("Capacidade divergente.");
    const ids = new Set<string>(); const funcionarios = new Set<string>(); let destinados = 0, reservas = 0, ausencias = 0;
    for (const d of r.disponibilidades) {
      const id = d.id.toLowerCase(), funcionario = d.funcionario_id.toLowerCase();
      if (d.semana_inicio !== semana || ids.has(id) || funcionarios.has(funcionario)) throw new Error("Disponibilidade divergente.");
      ids.add(id); funcionarios.add(funcionario); destinados += d.destinados_minutos; reservas += d.reservas_minutos; ausencias += d.ausencias_minutos;
      if (![destinados, reservas, ausencias].every(Number.isSafeInteger)) throw new Error("Capacidade excede precisão segura.");
    }
    const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
    // Compara também as identidades e revisões: totais iguais podem ocultar
    // alterações compensadas entre funcionários durante a exportação.
    const identidadeFonte = JSON.stringify(r.disponibilidades.map((d) => [d.id.toLowerCase(), d.funcionario_id.toLowerCase(), d.revisao, d.destinados_minutos, d.reservas_minutos, d.ausencias_minutos]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
    dados.push({ semana, registros: ids.size, destinados, reservas, ausencias, limiteAtingido: r.limiteDisponibilidadesAtingido, identidadeFonte });
    const proxima = new Date(`${semana}T00:00:00.000Z`); proxima.setUTCDate(proxima.getUTCDate() + 7); semana = proxima.toISOString().slice(0, 10);
  }
  return dados;
}
