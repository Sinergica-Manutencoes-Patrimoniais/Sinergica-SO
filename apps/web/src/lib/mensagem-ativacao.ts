// E01-S189 (AC-5) — distingue "a ação não está liberada ainda" de "você não tem permissão",
// porque a correção é diferente em cada caso: a primeira não se resolve tentando de novo nem
// falando com o administrador de papéis; a segunda, sim. Sem isto, as duas caem no mesmo erro
// genérico e o usuário tenta de novo algo que nunca vai funcionar sozinho.
//
// `55000` é o errcode que os mediadores de E01-S189 usam quando o gate está fechado (ver
// `supabase/migrations/1851_E01-S189_gates_escritores_sem_grant.sql`); `42501` é quem o núcleo já
// usava para "sem permissão/autorização", antes desta story.
export function mensagemFalhaAtivacao(erro: unknown): "indisponivel" | "sem_permissao" | null {
  const codigo = (erro as { code?: unknown } | null)?.code;
  if (codigo === "55000") return "indisponivel";
  if (codigo === "42501") return "sem_permissao";
  return null;
}

export const TEXTO_FALHA_ATIVACAO: Record<"indisponivel" | "sem_permissao", string> = {
  indisponivel:
    "Esta ação ainda não foi liberada pela administração. Não é necessário tentar novamente agora.",
  sem_permissao: "Você não tem permissão para esta ação. Procure quem administra os acessos.",
};
