import type { ConfigGateway, ModoPermissaoInput } from "./config-gateway";
import { DadosUsuarioInvalidosError } from "./errors";

// Sempre passa pela RPC atômica config.definir_permissao_usuario (via gateway) — nunca duas
// escritas de tabela separadas, para não deixar o usuário num estado grupo+individual inválido.
export async function definirPermissaoUsuario(
  gateway: ConfigGateway,
  userId: string,
  modo: ModoPermissaoInput,
): Promise<void> {
  if (!userId) throw new DadosUsuarioInvalidosError("Usuário inválido.");
  if (modo.tipo === "grupo" && !modo.grupoId) {
    throw new DadosUsuarioInvalidosError("Selecione um grupo.");
  }

  return gateway.definirPermissaoUsuario(userId, modo);
}
