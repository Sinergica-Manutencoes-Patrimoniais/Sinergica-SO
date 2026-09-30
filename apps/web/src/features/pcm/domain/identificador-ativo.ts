import { sugerirSigla } from "./siglas";

export type NivelIdentificador = {
  id: string;
  nome: string;
  sigla: string | null;
};

export type NivelSiglaFaltante = {
  nivel: "cliente" | "area" | "local" | "categoria";
  id: string;
  nome: string;
};

export interface EntradaPrefixo {
  cliente: NivelIdentificador;
  area: NivelIdentificador | null;
  locais: readonly NivelIdentificador[];
  categoria: NivelIdentificador;
  nomeAtivo: string;
}

export class SiglasFaltantesError extends Error {
  readonly faltantes: readonly NivelSiglaFaltante[];

  constructor(faltantes: readonly NivelSiglaFaltante[]) {
    super("Há siglas obrigatórias faltando.");
    this.name = "SiglasFaltantesError";
    this.faltantes = faltantes;
  }
}

function coletarSiglasFaltantes(entrada: EntradaPrefixo): NivelSiglaFaltante[] {
  const faltantes: NivelSiglaFaltante[] = [];
  const adicionarSeFaltar = (nivel: NivelSiglaFaltante["nivel"], item: NivelIdentificador) => {
    if (item.sigla === null) {
      faltantes.push({ nivel, id: item.id, nome: item.nome });
    }
  };

  adicionarSeFaltar("cliente", entrada.cliente);
  if (entrada.area !== null) adicionarSeFaltar("area", entrada.area);
  for (const local of entrada.locais) adicionarSeFaltar("local", local);
  adicionarSeFaltar("categoria", entrada.categoria);

  return faltantes;
}

function siglaObrigatoria(item: NivelIdentificador): string {
  if (item.sigla === null) {
    throw new Error("Sigla obrigatória ausente após validação.");
  }
  return item.sigla;
}

export function montarPrefixoIdentificador(entrada: EntradaPrefixo): {
  prefixo: string;
  numeroDoNome: string | null;
} {
  const faltantes = coletarSiglasFaltantes(entrada);
  if (faltantes.length > 0) throw new SiglasFaltantesError(faltantes);

  const nome = sugerirSigla(entrada.nomeAtivo, { manterNumero: false });
  const blocos = [
    siglaObrigatoria(entrada.cliente),
    ...(entrada.area === null ? [] : [siglaObrigatoria(entrada.area)]),
    ...entrada.locais.map(siglaObrigatoria),
    siglaObrigatoria(entrada.categoria),
    nome.sigla,
  ];

  return { prefixo: blocos.join("-"), numeroDoNome: nome.numeroFinal };
}

export function montarIdentificador(prefixo: string, nn: string): string {
  return `${prefixo}-${nn}`;
}

export function normalizarIdentificadorManual(valor: string): string {
  const normalizado = valor.trim().toUpperCase();
  if (normalizado.length === 0 || /\s/.test(normalizado)) {
    throw new Error("Identificador inválido.");
  }
  return normalizado;
}
