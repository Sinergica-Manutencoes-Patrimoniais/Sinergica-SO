import { supabase } from "../../../lib/supabase-client";
import type {
  TriggerAutomaticoConfig,
  TriggerAutomaticoGateway,
} from "../application/trigger-automatico-gateway";

export const supabaseTriggerAutomaticoAdapter: TriggerAutomaticoGateway = {
  async obter(personaId: string): Promise<TriggerAutomaticoConfig> {
    const [{ data: persona, error: personaError }, { data: janelas, error: janelasError }] =
      await Promise.all([
        supabase
          .schema("atendimento")
          .from("personas")
          .select("auto_resposta_ativo,auto_min_sem_resposta")
          .eq("id", personaId)
          .maybeSingle(),
        supabase
          .schema("atendimento")
          .from("persona_janela_automatica")
          .select("dia_semana,inicio,fim")
          .eq("persona_id", personaId)
          .order("dia_semana"),
      ]);
    if (personaError) throw personaError;
    if (janelasError) throw janelasError;
    return {
      personaId,
      ativo: Boolean(persona?.auto_resposta_ativo),
      minMinutosSemResposta: (persona?.auto_min_sem_resposta as number | undefined) ?? 30,
      janelas: (janelas ?? []).map((j) => ({
        dia: j.dia_semana as number,
        // `time` volta como "HH:MM:SS"; o `<input type="time">` quer "HH:MM".
        inicio: String(j.inicio).slice(0, 5),
        fim: String(j.fim).slice(0, 5),
      })),
    };
  },

  async salvar(input): Promise<void> {
    const { error: personaError } = await supabase
      .schema("atendimento")
      .from("personas")
      .update({
        auto_resposta_ativo: input.ativo,
        auto_min_sem_resposta: input.minMinutosSemResposta,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.personaId);
    if (personaError) throw personaError;

    // Dia sem janela = dia sem atendimento humano (AC-6). Por isso a escrita é "apaga o que não
    // veio e grava o que veio": a AUSÊNCIA de linha é informação, não lacuna.
    const dias = input.janelas.map((j) => j.dia);
    let remocao = supabase
      .schema("atendimento")
      .from("persona_janela_automatica")
      .delete()
      .eq("persona_id", input.personaId);
    if (dias.length > 0) remocao = remocao.not("dia_semana", "in", `(${dias.join(",")})`);
    const { error: deleteError } = await remocao;
    if (deleteError) throw deleteError;

    if (input.janelas.length === 0) return;
    const { error: upsertError } = await supabase
      .schema("atendimento")
      .from("persona_janela_automatica")
      .upsert(
        input.janelas.map((j) => ({
          persona_id: input.personaId,
          dia_semana: j.dia,
          inicio: j.inicio,
          fim: j.fim,
          updated_at: new Date().toISOString(),
          updated_by: input.userId,
        })),
        { onConflict: "persona_id,dia_semana" },
      );
    if (upsertError) throw upsertError;
  },
};
