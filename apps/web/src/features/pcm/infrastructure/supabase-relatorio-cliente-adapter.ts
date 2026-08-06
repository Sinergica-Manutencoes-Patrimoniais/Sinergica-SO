import { supabase } from "../../../lib/supabase-client";
import type { RelatorioCliente } from "../domain/relatorio-cliente";

export const supabaseRelatorioClienteAdapter = {
  async publicar(relatorio: RelatorioCliente, userId: string): Promise<string> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("relatorios_cliente_publicados")
      .insert({
        cliente_id: relatorio.clienteId,
        titulo: `Relatório de Atividades — ${relatorio.clienteNome}`,
        periodo_inicio: relatorio.inicio,
        periodo_fim: relatorio.fim,
        conteudo: relatorio,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  },
};
