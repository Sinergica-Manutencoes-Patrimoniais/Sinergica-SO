export type ModoCiencia = "sem_controle" | "informativa" | "obrigatoria";
export interface PoliticasCiencia {
  visita: ModoCiencia | null;
  contrato: ModoCiencia | null;
  cliente: ModoCiencia | null;
}
export interface CienciaCliente {
  confirmada: boolean;
  data: string | null;
  responsavel: string | null;
  canal: string | null;
  observacao: string | null;
}
function validarModo(modo: unknown): asserts modo is ModoCiencia {
  if (modo !== "sem_controle" && modo !== "informativa" && modo !== "obrigatoria")
    throw new Error("Política de ciência inválida.");
}
export function resolverPoliticaCiencia(politicas: PoliticasCiencia): {
  modo: ModoCiencia;
  origem: "visita" | "contrato" | "cliente" | "padrao";
} {
  for (const origem of ["visita", "contrato", "cliente"] as const) {
    const modo = politicas[origem];
    if (modo !== null) {
      validarModo(modo);
      return { modo, origem };
    }
  }
  return { modo: "sem_controle", origem: "padrao" };
}
function dataValida(valor: string | null): boolean {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith("0000")) return false;
  const instante = Date.parse(`${valor}T00:00:00.000Z`);
  return Number.isFinite(instante) && new Date(instante).toISOString().slice(0, 10) === valor;
}
/** Prévia informativa; elegibilidade e confirmação são verificadas no servidor. */
export function avaliarCienciaParaEnvio(
  modo: ModoCiencia,
  ciencia: CienciaCliente | null,
): { liberada: boolean; pendencias: string[] } {
  validarModo(modo);
  if (modo !== "obrigatoria") return { liberada: true, pendencias: [] };
  if (!ciencia?.confirmada) return { liberada: false, pendencias: ["confirmacao_cliente"] };
  const pendencias: string[] = [];
  if (!dataValida(ciencia.data)) pendencias.push("data");
  if (!ciencia.responsavel?.trim()) pendencias.push("responsavel");
  if (!ciencia.canal?.trim()) pendencias.push("canal");
  if (!ciencia.observacao?.trim()) pendencias.push("observacao");
  return { liberada: pendencias.length === 0, pendencias };
}
