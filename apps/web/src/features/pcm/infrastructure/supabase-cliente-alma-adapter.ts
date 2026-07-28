import { supabase } from "../../../lib/supabase-client";
import type { ClienteAlmaGateway } from "../application/cliente-alma-gateway";

export const supabaseClienteAlmaAdapter: ClienteAlmaGateway = {
  async obter(clienteId: string): Promise<string> {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("cliente_alma")
      .select("conteudo")
      .eq("cliente_id", clienteId)
      .maybeSingle();
    if (error) throw error;
    return (data?.conteudo as string | undefined) ?? "";
  },

  async salvar(clienteId: string, conteudo: string, userId: string): Promise<void> {
    const { error } = await supabase.schema("atendimento").from("cliente_alma").upsert(
      {
        cliente_id: clienteId,
        conteudo,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: "cliente_id" },
    );
    if (error) throw error;
  },
};
