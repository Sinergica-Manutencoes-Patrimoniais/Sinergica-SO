import { criarBordaConfigurada } from "../_shared/cronograma-xlsx/borda-configurada.ts";

type LerVariavel = (nome: string) => string | undefined;

/** Entrada fechada por padrão; nenhuma variável, credencial ou conteúdo é registrado. */
export function criarEntradaXlsx(ler: LerVariavel, transporte: typeof fetch = fetch): (req: Request) => Promise<Response> {
  let servico = ler("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!servico) {
    try {
      const valores: unknown = JSON.parse(ler("SUPABASE_SECRET_KEYS") ?? "{}");
      if (valores && typeof valores === "object" && !Array.isArray(valores)) {
        const chaves = valores as Record<string, unknown>;
        const disponiveis = [chaves.default, ...Object.values(chaves)];
        servico = disponiveis.find((valor): valor is string => typeof valor === "string" && valor.length > 0) ?? "";
      }
    } catch { servico = ""; }
  }
  return criarBordaConfigurada({
    habilitado: ler("SSO_XLSX_RECEPCAO_ENABLED") === "true",
    url: ler("SUPABASE_URL") ?? "", publica: ler("SUPABASE_ANON_KEY") ?? "", servico,
    segredo: ler("SSO_XLSX_ATTEST_KEY") ?? "",
    origens: (ler("SSO_XLSX_CORS_ALLOWED_ORIGINS") ?? "").split(",").map((origem) => origem.trim()).filter(Boolean),
    incrementalLocal: ler("SSO_XLSX_INCREMENTAL_LOCAL_EXPERIMENTAL") === "true",
  }, transporte);
}
