import { validarReabertura } from "../domain/fechamento";
import type { FinanceiroGateway } from "./financeiro-gateway";

export function listarFechamentos(gateway: FinanceiroGateway) {
  return gateway.listarFechamentos();
}

export function fecharMes(gateway: FinanceiroGateway, competencia: string, motivo?: string | null) {
  if (!competencia) throw new Error("Competência é obrigatória.");
  return gateway.fecharMes(competencia, motivo);
}

export function reabrirMes(gateway: FinanceiroGateway, competencia: string, motivo: string) {
  if (!competencia) throw new Error("Competência é obrigatória.");
  const validado = validarReabertura(motivo);
  return gateway.reabrirMes(competencia, validado);
}
