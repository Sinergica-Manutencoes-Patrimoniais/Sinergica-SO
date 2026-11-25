import { supabase } from "../../../lib/supabase-client";
import type { MateriaisClientesGateway } from "../application/materiais-clientes-queries";
import { supabaseEquipamentosAdapter } from "./supabase-equipamentos-adapter";
export const supabaseMateriaisClientesAdapter: MateriaisClientesGateway = {
  async listar(usuario, signal) {
    const antes = await supabase.auth.getUser();
    if (antes.error || antes.data.user?.id !== usuario || signal?.aborted)
      throw new Error("Sessão alterada.");
    const clientes = await supabaseEquipamentosAdapter.listarClientes();
    const depois = await supabase.auth.getUser();
    if (depois.error || depois.data.user?.id !== usuario || signal?.aborted)
      throw new Error("Sessão alterada.");
    return clientes;
  },
};
