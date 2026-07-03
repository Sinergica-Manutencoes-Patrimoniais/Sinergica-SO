import type { Grupo } from "../domain/grupo";
import type { ConfigGateway, PatchGrupo } from "./config-gateway";
import { NomeGrupoObrigatorioError } from "./errors";

export async function editarGrupo(
  gateway: ConfigGateway,
  id: string,
  patch: PatchGrupo,
): Promise<Grupo> {
  if (patch.nome !== undefined && !patch.nome.trim()) {
    throw new NomeGrupoObrigatorioError();
  }

  const patchNormalizado: PatchGrupo = {
    ...patch,
    ...(patch.nome !== undefined ? { nome: patch.nome.trim() } : {}),
    ...(patch.descricao !== undefined ? { descricao: patch.descricao?.trim() || null } : {}),
  };

  return gateway.editarGrupo(id, patchNormalizado);
}
