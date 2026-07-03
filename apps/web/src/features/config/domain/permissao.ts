// Regra pura de resolução de acesso — usada pelo PermissoesProvider (app/) sem depender de React
// nem de I/O, para ficar testável isoladamente (ver dependency-cruiser: domain/ não importa framework).
import type { PermissaoModulo } from "./grupo";
import type { ModuloId, NivelAcesso } from "./modulo";

// Superadmin bypassa qualquer checagem — mesmo comportamento da RLS (ver migrations 0008/0009).
// Presença de uma permissão implica ao menos leitura; escrita exige nivel === "escrita".
export function podeAcessarModulo(
  papel: string,
  permissoes: readonly PermissaoModulo[],
  modulo: ModuloId,
  nivelRequerido: NivelAcesso,
): boolean {
  if (papel === "superadmin") return true;

  const permissao = permissoes.find((p) => p.modulo === modulo);
  if (!permissao) return false;

  return nivelRequerido === "leitura" || permissao.nivel === "escrita";
}
