import type { EquipamentoItem } from "./equipamentos";
import type { Area, Local, LocalTipo } from "./hierarquia";
import type { Sistema } from "./sistemas";

export const CABECALHOS = {
  Áreas: ["Ação", "Id", "Nome", "Sigla", "Ordem"],
  Locais: ["Ação", "Id", "Área", "Local pai", "Nome", "Sigla", "Tipo de Local", "Ordem"],
  Sistemas: ["Ação", "Id", "Identificador", "Nome", "Categoria", "Área", "Local", "Descrição"],
  Componentes: [
    "Ação",
    "Id",
    "Identificador",
    "Nome",
    "Categoria",
    "Área",
    "Local",
    "Sistema",
    "Observações",
  ],
} as const;

export interface EstadoEstrutura {
  cliente: { id: string; nome: string; sigla?: string | null };
  areas: Area[];
  locais: Local[];
  sistemas: Sistema[];
  componentes: EquipamentoItem[];
  membros: Array<{ sistemaId: string; itemId: string }>;
  categorias: Array<{ id: string; nome: string; sigla?: string | null }>;
  tiposLocal: LocalTipo[];
}

export interface LinhaPlanilha {
  aba: keyof typeof CABECALHOS;
  numero: number;
  acao: "CRIAR" | "EDITAR" | "EXCLUIR";
  valores: Record<string, string>;
}

export function montarPlanilhaEstrutura(estado: EstadoEstrutura): Record<string, unknown[][]> {
  const locaisPorId = new Map(estado.locais.map((local) => [local.id, local]));
  const areaNome = new Map(estado.areas.map((area) => [area.id, area.nome]));
  const caminho = (id: string | null) => {
    const nomes: string[] = [];
    let local = id ? locaisPorId.get(id) : undefined;
    while (local) {
      nomes.unshift(local.nome);
      local = local.parentId ? locaisPorId.get(local.parentId) : undefined;
    }
    return nomes.join(" > ");
  };
  const membro = new Map(estado.membros.map((m) => [m.itemId, m.sistemaId]));
  const sistemaNome = new Map(estado.sistemas.map((s) => [s.id, s.nome]));
  const locais = [...estado.locais].sort(
    (a, b) =>
      caminho(a.id).split(" > ").length - caminho(b.id).split(" > ").length ||
      a.nome.localeCompare(b.nome),
  );
  return {
    "Leia-me": [
      [
        "Edite somente linhas com Ação CRIAR, EDITAR ou EXCLUIR. Importe pelo SO para simular antes de executar.",
      ],
    ],
    Áreas: [
      Array.from(CABECALHOS.Áreas),
      ...estado.areas.map((a) => ["", a.id, a.nome, a.sigla ?? "", a.ordem]),
    ],
    Locais: [
      Array.from(CABECALHOS.Locais),
      ...locais.map((l) => [
        "",
        l.id,
        areaNome.get(l.areaId) ?? "",
        caminho(l.parentId),
        l.nome,
        l.sigla ?? "",
        l.tipoNome ?? "",
        l.ordem,
      ]),
    ],
    Sistemas: [
      Array.from(CABECALHOS.Sistemas),
      ...estado.sistemas.map((s) => [
        "",
        s.id,
        s.codigo ?? "",
        s.nome,
        s.categoria ?? "",
        areaNome.get(s.areaId ?? locaisPorId.get(s.localId ?? "")?.areaId ?? "") ?? "",
        caminho(s.localId),
        s.descricao ?? "",
      ]),
    ],
    Componentes: [
      Array.from(CABECALHOS.Componentes),
      ...estado.componentes.map((c) => [
        "",
        c.id,
        c.identificador ?? "",
        c.nome,
        c.categoria ?? "",
        areaNome.get(c.areaId ?? locaisPorId.get(c.localId ?? "")?.areaId ?? "") ?? "",
        caminho(c.localId),
        sistemaNome.get(membro.get(c.id) ?? "") ?? "",
        c.observacoes ?? "",
      ]),
    ],
    Listas: [
      ["Categorias", "Sigla"],
      ...estado.categorias.map((c) => [c.nome, c.sigla ?? ""]),
      [],
      ["Tipos de Local"],
      ...estado.tiposLocal.map((t) => [t.nome]),
    ],
  };
}

export function nomeArquivoExportacao(cliente: EstadoEstrutura["cliente"], hoje: Date) {
  const base = (cliente.sigla || cliente.nome)
    .trim()
    .replace(/\s+/g, "-")
    .toLocaleLowerCase("pt-BR");
  return `estrutura-${base}-${hoje.toISOString().slice(0, 10)}.xlsx`;
}

export function parsearPlanilhaEstrutura(abas: Record<string, unknown[][]>): {
  linhas: LinhaPlanilha[];
  errosGerais: string[];
} {
  const errosGerais: string[] = [];
  const linhas: LinhaPlanilha[] = [];
  for (const [aba, cabecalhos] of Object.entries(CABECALHOS) as Array<
    [keyof typeof CABECALHOS, readonly string[]]
  >) {
    const linhasAba = abas[aba];
    if (!linhasAba || !cabecalhosIguais(linhasAba[0] ?? [], cabecalhos)) {
      errosGerais.push(`Aba «${aba}» ausente ou com colunas diferentes do modelo.`);
      continue;
    }
    linhasAba.slice(1).forEach((linha, indice) => {
      const valores = Object.fromEntries(
        cabecalhos.map((cabecalho, i) => [cabecalho, String(linha[i] ?? "").trim()]),
      );
      const acao = normalizar(valores.Ação ?? "");
      if (!acao) return;
      if (!["CRIAR", "EDITAR", "EXCLUIR"].includes(acao)) {
        linhas.push({
          aba,
          numero: indice + 2,
          acao: "CRIAR",
          valores: {
            ...valores,
            erro: `Ação inválida: «${valores.Ação ?? ""}». Use CRIAR, EDITAR ou EXCLUIR.`,
          },
        });
        return;
      }
      linhas.push({ aba, numero: indice + 2, acao: acao as LinhaPlanilha["acao"], valores });
    });
  }
  return { linhas, errosGerais };
}

function cabecalhosIguais(atual: unknown[], esperado: readonly string[]) {
  return (
    atual.length === esperado.length &&
    atual.every((v, i) => normalizar(String(v)) === normalizar(esperado[i] ?? ""))
  );
}
function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleUpperCase("pt-BR");
}
