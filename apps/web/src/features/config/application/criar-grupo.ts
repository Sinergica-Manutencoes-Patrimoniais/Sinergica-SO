import type { Grupo, PermissaoModulo } from "../domain/grupo";
import type { ConfigGateway } from "./config-gateway";
import { NomeGrupoObrigatorioError } from "./errors";

export async function criarGrupo(
  gateway: ConfigGateway,
  nome: string,
  descricao: string | null,
  permissoes: PermissaoModulo[],
): Promise<Grupo> {
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) throw new NomeGrupoObrigatorioError();

  const descricaoLimpa = descricao?.trim() || null;
  return gateway.criarGrupo(nomeLimpo, descricaoLimpa, permissoes);
}
