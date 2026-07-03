import type { ConfigGateway, CriarUsuarioInput } from "./config-gateway";
import { DadosUsuarioInvalidosError } from "./errors";

// Validação client-side espelha o InputSchema da Edge Function config-gerenciar-usuario (feedback
// imediato na UI); a validação de verdade continua no servidor — nunca confie só nesta camada.
export async function criarUsuario(
  gateway: ConfigGateway,
  input: CriarUsuarioInput,
): Promise<{ userId: string }> {
  if (!input.email.trim()) throw new DadosUsuarioInvalidosError("Informe o e-mail.");
  if (input.senha.length < 8) {
    throw new DadosUsuarioInvalidosError("A senha deve ter ao menos 8 caracteres.");
  }
  if (!input.nome.trim()) throw new DadosUsuarioInvalidosError("Informe o nome.");
  if (input.modo.tipo === "grupo" && !input.modo.grupoId) {
    throw new DadosUsuarioInvalidosError("Selecione um grupo.");
  }

  return gateway.criarUsuario(input);
}
