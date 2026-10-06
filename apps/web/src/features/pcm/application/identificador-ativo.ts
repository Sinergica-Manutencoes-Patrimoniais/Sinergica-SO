import {
  SiglasFaltantesError,
  montarIdentificador,
  montarPrefixoIdentificador,
  normalizarIdentificadorManual,
} from "../domain/identificador-ativo";
import { validarSigla } from "../domain/siglas";
import type { IdentificadorAtivoGateway, NivelComSigla } from "./identificador-ativo-gateway";

export class IdentificadorDuplicadoError extends Error {
  constructor(readonly identificador: string) {
    super(`Identificador duplicado: ${identificador}`);
    this.name = "IdentificadorDuplicadoError";
  }
}

export interface EntradaIdentificadorAtivo {
  clienteId: string;
  areaId: string | null;
  localId: string | null;
  categoriaId: string;
  nomeAtivo: string;
}

export type SiglaInformada = { nivel: NivelComSigla; id: string; sigla: string };

function aplicarSiglasInformadas(
  niveis: Awaited<ReturnType<IdentificadorAtivoGateway["obterNiveis"]>>,
  siglasInformadas: readonly SiglaInformada[],
) {
  const siglaPara = (nivel: NivelComSigla, item: { id: string; sigla: string | null }) =>
    siglasInformadas.find((sigla) => sigla.nivel === nivel && sigla.id === item.id)?.sigla ??
    item.sigla;
  return {
    cliente: { ...niveis.cliente, sigla: siglaPara("cliente", niveis.cliente) },
    area: niveis.area ? { ...niveis.area, sigla: siglaPara("area", niveis.area) } : null,
    locais: niveis.locais.map((local) => ({
      ...local,
      sigla: siglaPara("local", local),
    })),
    categoria: { ...niveis.categoria, sigla: siglaPara("categoria", niveis.categoria) },
  };
}

export async function previsualizarIdentificador(
  gateway: IdentificadorAtivoGateway,
  input: EntradaIdentificadorAtivo,
  siglasInformadas: readonly SiglaInformada[] = [],
) {
  const niveis = aplicarSiglasInformadas(await gateway.obterNiveis(input), siglasInformadas);
  try {
    const { prefixo, numeroDoNome } = montarPrefixoIdentificador({
      ...niveis,
      nomeAtivo: input.nomeAtivo,
    });
    return {
      prefixo,
      nn: numeroDoNome ?? (await gateway.proximoSequencial(prefixo)),
      faltantes: [],
    };
  } catch (erro) {
    if (erro instanceof SiglasFaltantesError)
      return { prefixo: null, nn: null, faltantes: erro.faltantes };
    throw erro;
  }
}

export async function resolverIdentificadorNaCriacao(
  gateway: IdentificadorAtivoGateway,
  input: EntradaIdentificadorAtivo,
  opcoes: {
    siglasInformadas: SiglaInformada[];
    identificadorManual: string | null;
    userId: string;
  },
) {
  if (opcoes.identificadorManual) {
    return {
      identificador: normalizarIdentificadorManual(opcoes.identificadorManual),
      nnDoSequencial: false,
    };
  }
  for (const sigla of opcoes.siglasInformadas) {
    await gateway.definirSigla(sigla.nivel, sigla.id, validarSigla(sigla.sigla), opcoes.userId);
  }
  const niveis = await gateway.obterNiveis(input);
  const { prefixo, numeroDoNome } = montarPrefixoIdentificador({
    ...niveis,
    nomeAtivo: input.nomeAtivo,
  });
  const nn = numeroDoNome ?? (await gateway.proximoSequencial(prefixo));
  return { identificador: montarIdentificador(prefixo, nn), nnDoSequencial: numeroDoNome === null };
}
