import { criarBordaLevantamentoConfigurada } from "./borda-levantamento-configurada.ts";

/** A função criada permanece indisponível sem configuração explícita. */
export function criarEntradaLevantamentoEstruturado(ler: (nome: string) => string | undefined, transporte: typeof fetch = fetch) {
  let servico = ler("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!servico) {
    try {
      const valores: unknown = JSON.parse(ler("SUPABASE_SECRET_KEYS") ?? "{}");
      if (valores && typeof valores === "object" && !Array.isArray(valores)) {
        const chaves = valores as Record<string, unknown>;
        servico = [chaves.default, ...Object.values(chaves)].find((v): v is string => typeof v === "string" && v.length > 0) ?? "";
      }
    } catch { servico = ""; }
  }
  return criarBordaLevantamentoConfigurada({
    habilitado: ler("SSO_RECEPCAO_LEVANTAMENTO_ESTRUTURADO_ENABLED") === "true",
    url: ler("SUPABASE_URL") ?? "", publica: ler("SUPABASE_ANON_KEY") ?? "", servico,
    origens: (ler("SSO_RECEPCAO_LEVANTAMENTO_CORS_ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim()).filter(Boolean),
  }, transporte);
}
