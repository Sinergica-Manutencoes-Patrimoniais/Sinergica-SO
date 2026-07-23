export type TipoAliquotaImposto = "fixa" | "faixa_rbt12";

export interface FaixaRbt12 {
  /** Limite superior do RBT12 (receita bruta acumulada 12 meses) da faixa, em centavos. `null` na
   * última faixa (sem teto — acima disso o Simples Nacional não se aplica mais). */
  ateRbt12Centavos: number | null;
  aliquotaNominal: number; // 0-1 (ex.: 0.06 = 6%)
  parcelaDeduzirCentavos: number;
}

/** Anexo III da LC 123/2006 (serviços em geral — perfil típico de manutenção predial), tabela
 * vigente em 2026. Referência: fórmula oficial `aliquota_efetiva = (RBT12*aliquota - parcela)/RBT12`.
 * Semeada como sugestão inicial — o anexo real depende do CNAE/atividade do contribuinte, sempre
 * confirmar com o contador antes de usar como provisão definitiva (AC-1 permite editar). */
export const FAIXAS_ANEXO_III_PADRAO: FaixaRbt12[] = [
  { ateRbt12Centavos: 18_000_000, aliquotaNominal: 0.06, parcelaDeduzirCentavos: 0 },
  { ateRbt12Centavos: 36_000_000, aliquotaNominal: 0.112, parcelaDeduzirCentavos: 936_000 },
  { ateRbt12Centavos: 72_000_000, aliquotaNominal: 0.135, parcelaDeduzirCentavos: 1_764_000 },
  { ateRbt12Centavos: 180_000_000, aliquotaNominal: 0.16, parcelaDeduzirCentavos: 3_564_000 },
  { ateRbt12Centavos: 360_000_000, aliquotaNominal: 0.21, parcelaDeduzirCentavos: 12_564_000 },
  { ateRbt12Centavos: null, aliquotaNominal: 0.33, parcelaDeduzirCentavos: 64_800_000 },
];

export interface ConfigImpostos {
  tipo: TipoAliquotaImposto;
  aliquotaFixa: number | null; // 0-1, usado quando tipo='fixa'
  faixas: FaixaRbt12[]; // usado quando tipo='faixa_rbt12'
  diaVencimento: number; // dia do mês seguinte à competência (ex.: 20 = dia 20 do Simples/DAS)
}

/** AC-3: alíquota efetiva a partir do RBT12 (receita bruta acumulada 12 meses) — fórmula oficial do
 * Simples Nacional. `tipo='fixa'` ignora o RBT12 e devolve a alíquota configurada direto (AC-3
 * "fallback para alíquota fixa se o PO preferir simplicidade"). RBT12 zero ou negativo → 0 (evita
 * divisão por zero; sem receita acumulada não há o que tributar). */
export function calcularAliquotaEfetiva(config: ConfigImpostos, rbt12Centavos: number): number {
  if (config.tipo === "fixa") return config.aliquotaFixa ?? 0;
  if (rbt12Centavos <= 0) return 0;

  const faixa =
    config.faixas.find((f) => f.ateRbt12Centavos === null || rbt12Centavos <= f.ateRbt12Centavos) ??
    config.faixas[config.faixas.length - 1];
  if (!faixa) return 0;

  const efetiva =
    (rbt12Centavos * faixa.aliquotaNominal - faixa.parcelaDeduzirCentavos) / rbt12Centavos;
  return Math.max(efetiva, 0);
}

/** AC-2: valor do imposto a provisionar — receita da competência × alíquota efetiva, arredondado
 * pro centavo mais próximo (nunca fração de centavo). Receita zero → 0 (edge case "sem provisão"). */
export function calcularProvisaoImposto(receitaCentavos: number, aliquotaEfetiva: number): number {
  if (receitaCentavos <= 0 || aliquotaEfetiva <= 0) return 0;
  return Math.round(receitaCentavos * aliquotaEfetiva);
}

export interface ProvisaoImposto {
  competencia: string;
  receitaCentavos: number;
  rbt12Centavos: number;
  aliquotaEfetiva: number;
  valorCentavos: number;
  lancamentoId: string | null;
}

export function validarConfigImpostos(config: ConfigImpostos): ConfigImpostos {
  if (config.tipo === "fixa" && (config.aliquotaFixa == null || config.aliquotaFixa <= 0)) {
    throw new Error("Informe uma alíquota fixa maior que zero.");
  }
  if (config.tipo === "faixa_rbt12" && config.faixas.length === 0) {
    throw new Error("Informe ao menos uma faixa de RBT12.");
  }
  if (
    !Number.isInteger(config.diaVencimento) ||
    config.diaVencimento < 1 ||
    config.diaVencimento > 28
  ) {
    throw new Error("Dia de vencimento deve ser entre 1 e 28.");
  }
  return config;
}
