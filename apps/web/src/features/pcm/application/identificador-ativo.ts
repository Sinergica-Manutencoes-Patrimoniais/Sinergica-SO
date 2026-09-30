import {
  SiglasFaltantesError,
  montarIdentificador,
  montarPrefixoIdentificador,
  normalizarIdentificadorManual,
} from "../domain/identificador-ativo";
import type { IdentificadorAtivoGateway, NivelComSigla } from "./identificador-ativo-gateway";

export interface EntradaIdentificadorAtivo {
  clienteId: string;
  areaId: string | null;
  localId: string | null;
  categoriaId: string;
  nomeAtivo: string;
}

export async function previsualizarIdentificador(
  gateway: IdentificadorAtivoGateway,
  input: EntradaIdentificadorAtivo,
) {
  const niveis = await gateway.obterNiveis(input);
  try {
    const { prefixo, numeroDoNome } = montarPrefixoIdentificador({
      ...niveis,
      nomeAtivo: input.nomeAtivo,
    });
    return { prefixo, nn: numeroDoNome, faltantes: [] };
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
    siglasInformadas: Array<{ nivel: NivelComSigla; id: string; sigla: string }>;
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
    await gateway.definirSigla(sigla.nivel, sigla.id, sigla.sigla, opcoes.userId);
  }
  const niveis = await gateway.obterNiveis(input);
  const { prefixo, numeroDoNome } = montarPrefixoIdentificador({
    ...niveis,
    nomeAtivo: input.nomeAtivo,
  });
  const nn = numeroDoNome ?? (await gateway.proximoSequencial(prefixo));
  return { identificador: montarIdentificador(prefixo, nn), nnDoSequencial: numeroDoNome === null };
}
