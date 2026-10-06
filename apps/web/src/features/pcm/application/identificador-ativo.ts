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

export type IdentificadorPreparado = {
  identificador: string;
  nnDoSequencial: boolean;
  /** Compensa apenas siglas que esta operação persistiu; seguro chamar uma única vez. */
  desfazer: () => Promise<void>;
};

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
  const preparado = await prepararIdentificadorNaCriacao(gateway, input, opcoes);
  return {
    identificador: preparado.identificador,
    nnDoSequencial: preparado.nnDoSequencial,
  };
}

/**
 * Resolve o identificador e oferece uma compensação das siglas persistidas. O chamador deve
 * invocar `desfazer` se a criação/edição do ativo falhar, para não deixar o caminho parcialmente
 * alterado por uma operação que não chegou a concluir.
 */
export async function prepararIdentificadorNaCriacao(
  gateway: IdentificadorAtivoGateway,
  input: EntradaIdentificadorAtivo,
  opcoes: {
    siglasInformadas: SiglaInformada[];
    identificadorManual: string | null;
    userId: string;
  },
): Promise<IdentificadorPreparado> {
  if (opcoes.identificadorManual) {
    return {
      identificador: normalizarIdentificadorManual(opcoes.identificadorManual),
      nnDoSequencial: false,
      desfazer: async () => undefined,
    };
  }

  const niveisOriginais = await gateway.obterNiveis(input);
  const siglaOriginal = (nivel: NivelComSigla, id: string): string | null => {
    if (nivel === "cliente" && niveisOriginais.cliente.id === id)
      return niveisOriginais.cliente.sigla;
    if (nivel === "area" && niveisOriginais.area?.id === id) return niveisOriginais.area.sigla;
    if (nivel === "categoria" && niveisOriginais.categoria.id === id)
      return niveisOriginais.categoria.sigla;
    if (nivel === "local") {
      const local = niveisOriginais.locais.find((item) => item.id === id);
      if (local) return local.sigla;
    }
    throw new Error("Nível de sigla inválido para o identificador.");
  };
  const alteradas: Array<SiglaInformada & { anterior: string | null }> = [];
  const desfazer = async () => {
    for (const sigla of [...alteradas].reverse()) {
      await gateway.definirSigla(sigla.nivel, sigla.id, sigla.anterior, opcoes.userId);
    }
  };

  try {
    for (const sigla of opcoes.siglasInformadas) {
      const validada = validarSigla(sigla.sigla);
      const anterior = siglaOriginal(sigla.nivel, sigla.id);
      if (anterior === validada) continue;
      await gateway.definirSigla(sigla.nivel, sigla.id, validada, opcoes.userId);
      alteradas.push({ ...sigla, anterior });
    }
  } catch (erro) {
    await desfazer();
    throw erro;
  }

  try {
    const niveis = await gateway.obterNiveis(input);
    const { prefixo, numeroDoNome } = montarPrefixoIdentificador({
      ...niveis,
      nomeAtivo: input.nomeAtivo,
    });
    const nn = numeroDoNome ?? (await gateway.proximoSequencial(prefixo));
    return {
      identificador: montarIdentificador(prefixo, nn),
      nnDoSequencial: numeroDoNome === null,
      desfazer,
    };
  } catch (erro) {
    await desfazer();
    throw erro;
  }
}
