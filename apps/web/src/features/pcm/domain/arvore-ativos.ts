import type { EquipamentoItem } from "./equipamentos";
import type { Area, Local } from "./hierarquia";
import { areaEfetiva } from "./posicao-ativo";
import type { Sistema } from "./sistemas";

export type NoArvore = {
  tipo: "cliente" | "area" | "local" | "sistema" | "componente";
  id: string;
  nome: string;
  identificador: string | null;
  sigla: string | null;
  posicaoDivergente: string | null;
  filhos: NoArvore[];
  total: number;
};

export function montarArvoreAtivos(input: {
  cliente: { id: string; nome: string };
  areas: Area[];
  locais: Local[];
  sistemas: Sistema[];
  componentes: EquipamentoItem[];
  membros: Array<{ sistemaId: string; itemId: string }>;
}): NoArvore {
  const areas = input.areas.filter((area) => area.ativo);
  const locais = input.locais.filter((local) => local.ativo);
  const sistemas = input.sistemas.filter((sistema) => sistema.ativo);
  const componentes = input.componentes.filter((componente) => componente.ativo);
  const locaisPorId = new Map(locais.map((local) => [local.id, local]));
  const sistemaPorId = new Map(sistemas.map((sistema) => [sistema.id, sistema]));
  const componentePorId = new Map(componentes.map((componente) => [componente.id, componente]));
  const membrosPorSistema = new Map<string, EquipamentoItem[]>();
  const sistemaPorComponente = new Map<string, Sistema>();
  for (const membro of input.membros) {
    const sistema = sistemaPorId.get(membro.sistemaId);
    const componente = componentePorId.get(membro.itemId);
    if (!sistema || !componente) continue;
    membrosPorSistema.set(sistema.id, [...(membrosPorSistema.get(sistema.id) ?? []), componente]);
    sistemaPorComponente.set(componente.id, sistema);
  }
  const locaisPorPai = new Map<string | null, Local[]>();
  for (const local of locais) {
    locaisPorPai.set(local.parentId, [...(locaisPorPai.get(local.parentId) ?? []), local]);
  }
  const ordenarEstrutura = <T extends { ordem: number; nome: string }>(itens: T[]) =>
    [...itens].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
  const ordenarAtivos = <T extends { nome: string }>(itens: T[]) =>
    [...itens].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const posicao = (ativo: { areaId: string | null; localId: string | null }) => {
    const areaId = areaEfetiva(ativo, locaisPorId);
    const area = areas.find((item) => item.id === areaId)?.nome;
    if (!area) return null;
    const caminho: string[] = [];
    let local = ativo.localId ? locaisPorId.get(ativo.localId) : undefined;
    while (local) {
      caminho.unshift(local.nome);
      local = local.parentId ? locaisPorId.get(local.parentId) : undefined;
    }
    return [area, ...caminho].join(" > ");
  };
  const componenteNo = (componente: EquipamentoItem, divergente: string | null = null): NoArvore =>
    fechar({
      tipo: "componente",
      id: componente.id,
      nome: componente.nome,
      identificador: componente.identificador,
      sigla: null,
      posicaoDivergente: divergente,
      filhos: [],
      total: 0,
    });
  const sistemaNo = (sistema: Sistema): NoArvore => {
    const filhos = ordenarAtivos(membrosPorSistema.get(sistema.id) ?? []).map((componente) => {
      const mesmaPosicao = sistema.localId
        ? componente.localId === sistema.localId
        : areaEfetiva(componente, locaisPorId) === areaEfetiva(sistema, locaisPorId) &&
          !componente.localId;
      return componenteNo(componente, mesmaPosicao ? null : posicao(componente));
    });
    return fechar({
      tipo: "sistema",
      id: sistema.id,
      nome: sistema.nome,
      identificador: sistema.codigo,
      sigla: null,
      posicaoDivergente: null,
      filhos,
      total: 0,
    });
  };
  const ativosNaPosicao = (areaId: string | null, localId: string | null) => {
    const sistemasAqui = ordenarAtivos(
      sistemas.filter(
        (s) => s.localId === localId && (!localId ? areaEfetiva(s, locaisPorId) === areaId : true),
      ),
    ).map(sistemaNo);
    const componentesAqui = ordenarAtivos(
      componentes.filter((c) => {
        if (sistemaPorComponente.has(c.id) || c.localId !== localId) return false;
        return localId ? true : areaEfetiva(c, locaisPorId) === areaId;
      }),
    ).map((componente) => componenteNo(componente));
    return [...sistemasAqui, ...componentesAqui];
  };
  const localNo = (local: Local): NoArvore =>
    fechar({
      tipo: "local",
      id: local.id,
      nome: local.nome,
      identificador: null,
      sigla: local.sigla ?? null,
      posicaoDivergente: null,
      filhos: [
        ...ordenarEstrutura(locaisPorPai.get(local.id) ?? []).map(localNo),
        ...ativosNaPosicao(null, local.id),
      ],
      total: 0,
    });
  const areaNo = (area: Area): NoArvore =>
    fechar({
      tipo: "area",
      id: area.id,
      nome: area.nome,
      identificador: null,
      sigla: area.sigla ?? null,
      posicaoDivergente: null,
      filhos: [
        ...ordenarEstrutura(
          locaisPorPai.get(null)?.filter((local) => local.areaId === area.id) ?? [],
        ).map(localNo),
        ...ativosNaPosicao(area.id, null),
      ],
      total: 0,
    });
  return fechar({
    tipo: "cliente",
    id: input.cliente.id,
    nome: input.cliente.nome,
    identificador: null,
    sigla: null,
    posicaoDivergente: null,
    filhos: [...ordenarEstrutura(areas).map(areaNo), ...ativosNaPosicao(null, null)],
    total: 0,
  });
}

export function filtrarArvore(no: NoArvore, termo: string): NoArvore | null {
  if (normalizar(termo).length < 2) return no;
  const filhos = no.filhos
    .map((filho) => filtrarArvore(filho, termo))
    .filter((filho): filho is NoArvore => filho !== null);
  const busca = normalizar(termo);
  const corresponde = normalizar(`${no.nome} ${no.identificador ?? ""}`).includes(busca);
  return corresponde || filhos.length > 0 ? { ...no, filhos } : null;
}

function fechar(no: NoArvore): NoArvore {
  return {
    ...no,
    total: no.filhos.reduce(
      (total, filho) => total + filho.total,
      no.tipo === "sistema" || no.tipo === "componente" ? 1 : 0,
    ),
  };
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}
