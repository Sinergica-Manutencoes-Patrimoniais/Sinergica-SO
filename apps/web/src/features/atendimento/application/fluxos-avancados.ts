import { copiarRecipe, validarFluxo } from "../domain/fluxos";
import type { FluxoGateway } from "./fluxo-gateway";

export function listarFluxoRecipes(gateway: FluxoGateway) {
  return gateway.listarRecipes();
}

export function listarFluxoLogs(gateway: FluxoGateway, fluxoId: string) {
  if (!fluxoId) throw new Error("Fluxo é obrigatório.");
  return gateway.listarLogs(fluxoId);
}

export function criarFluxoDeRecipe(
  gateway: FluxoGateway,
  input: { recipeId: string; nome: string; personaId: string; userId: string },
) {
  const recipe = input.recipeId.trim();
  if (!recipe) throw new Error("Recipe é obrigatória.");
  const validado = validarFluxo(input);
  return gateway.listarRecipes().then((recipes) => {
    const encontrada = recipes.find((item) => item.id === recipe);
    if (!encontrada) throw new Error("Recipe não encontrada.");
    return gateway.criarFluxo({
      ...validado,
      userId: input.userId,
      definicao: copiarRecipe(encontrada),
    });
  });
}
