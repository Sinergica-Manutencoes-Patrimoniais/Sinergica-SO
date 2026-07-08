import { validarEvolutionCriar } from "../domain/evolution";
import type { EvolutionCriarForm } from "../domain/evolution";
import type { EvolutionGateway } from "./evolution-gateway";

function exigirId(id: string): string {
  const normalizado = id.trim();
  if (!normalizado) throw new Error("Instância Evolution é obrigatória.");
  return normalizado;
}

export function listarEvolution(gateway: EvolutionGateway) {
  return gateway.listar();
}

export function criarEvolution(
  gateway: EvolutionGateway,
  input: EvolutionCriarForm & { userId: string },
) {
  return gateway.criar({ ...validarEvolutionCriar(input), userId: input.userId });
}

export function conectarEvolution(gateway: EvolutionGateway, id: string) {
  return gateway.conectar(exigirId(id));
}

export function desconectarEvolution(gateway: EvolutionGateway, id: string) {
  return gateway.desconectar(exigirId(id));
}
