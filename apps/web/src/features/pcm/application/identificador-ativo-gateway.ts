import type { NivelIdentificador } from "../domain/identificador-ativo";

export type NivelComSigla = "cliente" | "area" | "local" | "categoria";

export interface NiveisIdentificador {
  cliente: NivelIdentificador;
  area: NivelIdentificador | null;
  locais: readonly NivelIdentificador[];
  categoria: NivelIdentificador;
}

export interface IdentificadorAtivoGateway {
  obterNiveis(input: {
    clienteId: string;
    areaId: string | null;
    localId: string | null;
    categoriaId: string;
  }): Promise<NiveisIdentificador>;
  definirSigla(
    nivel: NivelComSigla,
    id: string,
    sigla: string | null,
    userId: string,
  ): Promise<void>;
  proximoSequencial(prefixo: string): Promise<string>;
}
