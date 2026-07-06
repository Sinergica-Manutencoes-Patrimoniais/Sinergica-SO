import { supabase } from "../../../lib/supabase-client";

export interface TecnicoAuvoOpcao {
  id: string;
  auvoUserId: number;
  nome: string;
  equipe: string | null;
  updatedAt: string | null;
}

interface TecnicoRow {
  id: string;
  auvo_user_id: number;
  nome: string;
  equipe: string | null;
  ativo: boolean;
  updated_at: string | null;
}

function isTabelaCacheAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    Boolean(error.message?.includes("schema cache") || error.message?.includes("does not exist"))
  );
}

export const supabasePlanejamentoPcmAdapter = {
  async listarTecnicos(): Promise<TecnicoAuvoOpcao[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("tecnicos_cache")
      .select("id,auvo_user_id,nome,equipe,ativo,updated_at")
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (error && isTabelaCacheAusente(error)) return [];
    if (error) throw error;

    return ((data ?? []) as TecnicoRow[]).map((tecnico) => ({
      id: tecnico.id,
      auvoUserId: tecnico.auvo_user_id,
      nome: tecnico.nome,
      equipe: tecnico.equipe,
      updatedAt: tecnico.updated_at,
    }));
  },
};
