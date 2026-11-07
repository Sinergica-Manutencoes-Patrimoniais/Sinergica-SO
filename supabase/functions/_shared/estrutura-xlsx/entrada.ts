import { criarBordaEstruturaConfigurada } from "./borda-configurada.ts";

type LerVariavel = (nome: string) => string | undefined;

/** Factory sem registro Deno.serve; nenhuma credencial ou conteúdo é impresso. */
export function criarEntradaEstruturaXlsx(ler: LerVariavel, transporte: typeof fetch = fetch) {
  let servico = ler("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!servico) {
    try {
      const valores: unknown = JSON.parse(ler("SUPABASE_SECRET_KEYS") ?? "{}");
      if (valores && typeof valores === "object" && !Array.isArray(valores)) {
        const chaves = valores as Record<string, unknown>;
        servico = [chaves.default, ...Object.values(chaves)].find((valor): valor is string => typeof valor === "string" && valor.length > 0) ?? "";
      }
    } catch { servico = ""; }
  }
  return criarBordaEstruturaConfigurada({
    habilitado: ler("SSO_ESTRUTURA_XLSX_RECEPCAO_ENABLED") === "true",
    url: ler("SUPABASE_URL") ?? "", publica: ler("SUPABASE_ANON_KEY") ?? "", servico,
    segredo: ler("SSO_ESTRUTURA_XLSX_ATTEST_KEY") ?? "",
    origens: (ler("SSO_ESTRUTURA_XLSX_CORS_ALLOWED_ORIGINS") ?? "").split(",").map((origem) => origem.trim()).filter(Boolean),
  }, transporte);
}
