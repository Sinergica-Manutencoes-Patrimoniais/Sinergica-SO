import type { EquipamentoItem } from "./equipamentos";
import type { Area, Local, LocalTipo } from "./hierarquia";
import { montarPrefixoIdentificador } from "./identificador-ativo";
import { sugerirSiglaUnica } from "./siglas";
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

export interface ResultadoPlano {
  linha: LinhaPlanilha;
  resultado: "CRIAR" | "EDITAR" | "EXCLUIR" | "SEM MUDANÇA" | "ERRO" | "AVISO";
  detalhes: string[];
  dependeDe: number[];
  /** Valores já normalizados/resolvidos pelo dry-run. Nunca altera a planilha original. */
  valoresExecutar?: Record<string, string>;
}
export interface PlanoImportacao {
  resultados: ResultadoPlano[];
  temErros: boolean;
  alteracoes: number;
  resumo: Record<ResultadoPlano["resultado"], number>;
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
  for (const aba of ["Leia-me", "Listas"]) {
    if (!abas[aba]) errosGerais.push(`Aba «${aba}» ausente ou com colunas diferentes do modelo.`);
  }
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

/** Planejamento puro e conservador: valida antes de qualquer escrita. */
export function planejarImportacao(
  linhas: LinhaPlanilha[],
  estado: EstadoEstrutura,
): PlanoImportacao {
  const porTipo = {
    Áreas: new Map(estado.areas.map((item) => [item.id, item])),
    Locais: new Map(estado.locais.map((item) => [item.id, item])),
    Sistemas: new Map(estado.sistemas.map((item) => [item.id, item])),
    Componentes: new Map(estado.componentes.map((item) => [item.id, item])),
  };
  const categorias = new Map(estado.categorias.map((item) => [normalizar(item.nome), item]));
  const tipos = new Map(estado.tiposLocal.map((item) => [normalizar(item.nome), item]));
  const areasPorNome = new Map(estado.areas.map((item) => [normalizar(item.nome), item]));
  const sistemasPorNome = new Map(estado.sistemas.map((item) => [normalizar(item.nome), item]));
  const resultados: ResultadoPlano[] = [];
  const criadosArea = new Map<string, ResultadoPlano>();
  const criadosSistema = new Map<string, ResultadoPlano>();
  const criadosLocal = new Map<string, ResultadoPlano>();
  const areasCriadasNaPlanilha = new Map(
    linhas
      .filter((linha) => linha.aba === "Áreas" && linha.acao === "CRIAR")
      .map((linha) => [normalizar(linha.valores.Nome ?? ""), linha.numero]),
  );
  const sistemasCriadosNaPlanilha = new Map(
    linhas
      .filter((linha) => linha.aba === "Sistemas" && linha.acao === "CRIAR")
      .map((linha) => [normalizar(linha.valores.Nome ?? ""), linha.numero]),
  );
  const locaisCriadosNaPlanilha = new Map(
    linhas
      .filter((linha) => linha.aba === "Locais" && linha.acao === "CRIAR")
      .map((linha) => [
        chaveLocal(
          linha.valores.Área ?? "",
          [linha.valores["Local pai"], linha.valores.Nome].filter(Boolean).join(" > "),
        ),
        linha.numero,
      ]),
  );

  const idsRepetidos = new Map<string, number[]>();
  for (const linha of linhas) {
    const id = linha.valores.Id?.trim();
    if (id) idsRepetidos.set(id, [...(idsRepetidos.get(id) ?? []), linha.numero]);
  }

  for (const linha of linhas) {
    const valores = { ...linha.valores };
    const erros: string[] = [];
    const avisos: string[] = [];
    const id = valores.Id?.trim() ?? "";
    const atual = porTipo[linha.aba].get(id);
    const dependeDe: number[] = [];
    if (valores.erro) erros.push(valores.erro);
    if (linhas.length > 2000) erros.push("Planilha com mais de 2000 alterações. Divida em partes.");
    if (id && (idsRepetidos.get(id)?.length ?? 0) > 1) {
      const repetidas = idsRepetidos.get(id) ?? [];
      erros.push(`Id repetido na planilha (linhas ${repetidas.join(" e ")}).`);
    }
    if ((linha.acao === "EDITAR" || linha.acao === "EXCLUIR") && !atual)
      erros.push("Id não encontrado neste cliente.");
    if (linha.acao === "CRIAR" && id) erros.push("Linha de CRIAR não pode ter Id.");
    if (linha.acao !== "EXCLUIR" && !(valores.Nome ?? "").trim()) erros.push("Nome é obrigatório.");

    const areaNome = valores.Área ?? "";
    const area = areaNome ? areasPorNome.get(normalizar(areaNome)) : undefined;
    if (linha.aba === "Locais" && linha.acao !== "EXCLUIR" && !area) {
      const criada = criadosArea.get(normalizar(areaNome));
      if (criada) dependeDe.push(criada.linha.numero);
      else if (areasCriadasNaPlanilha.has(normalizar(areaNome)))
        dependeDe.push(areasCriadasNaPlanilha.get(normalizar(areaNome)) as number);
      else erros.push(`Área «${areaNome}» não existe.`);
    }
    if (["Sistemas", "Componentes"].includes(linha.aba) && linha.acao !== "EXCLUIR") {
      const categoriaNome = valores.Categoria ?? "";
      if (!categoriaNome) erros.push("Categoria é obrigatória.");
      else if (!categorias.has(normalizar(categoriaNome)))
        erros.push(`Categoria «${categoriaNome}» não existe. Cadastre em Categorias de Ativo.`);
      if (areaNome && !area && !criadosArea.has(normalizar(areaNome))) {
        const criada = areasCriadasNaPlanilha.get(normalizar(areaNome));
        if (criada) dependeDe.push(criada);
        else erros.push(`Área «${areaNome}» não existe.`);
      }
    }
    if (linha.aba === "Locais" && linha.acao !== "EXCLUIR") {
      const tipo = valores["Tipo de Local"] ?? "";
      if (tipo && !tipos.has(normalizar(tipo)))
        erros.push(`Tipo de Local «${tipo}» não existe para este cliente.`);
    }
    if (linha.aba === "Componentes" && linha.acao !== "EXCLUIR" && valores.Sistema) {
      const sistema = sistemasPorNome.get(normalizar(valores.Sistema));
      const criado = criadosSistema.get(normalizar(valores.Sistema));
      const criadoDepois = sistemasCriadosNaPlanilha.get(normalizar(valores.Sistema));
      if (!sistema && !criado && !criadoDepois)
        erros.push(`Sistema «${valores.Sistema}» não existe.`);
      if (
        sistema &&
        linhas.some(
          (outra) =>
            outra.aba === "Sistemas" && outra.acao === "EXCLUIR" && outra.valores.Id === sistema.id,
        )
      )
        erros.push(`Sistema «${valores.Sistema}» não existe.`);
      if (criado) dependeDe.push(criado.linha.numero);
      if (criadoDepois) dependeDe.push(criadoDepois);
    }

    const areaId = area?.id ?? null;
    const caminhoLocal = valores[linha.aba === "Locais" ? "Local pai" : "Local"] ?? "";
    if (caminhoLocal && linha.acao !== "EXCLUIR") {
      const local = resolverLocal(
        caminhoLocal,
        areaNome,
        areaId,
        estado.locais,
        criadosLocal,
        locaisCriadosNaPlanilha,
      );
      if (local.erro) erros.push(local.erro);
      if (local.dependeDe) dependeDe.push(local.dependeDe);
    }

    const sigla = valores.Sigla?.trim() ?? "";
    if (sigla && !/^[A-Za-z0-9]{3}$/.test(sigla))
      erros.push("Sigla deve ter exatamente 3 letras ou números.");
    if (linha.acao === "CRIAR" && !sigla && (linha.aba === "Áreas" || linha.aba === "Locais")) {
      const emUso = siglasNoNivel(
        linha,
        estado,
        resultados,
        area?.id ?? null,
        valores["Local pai"] ?? "",
      );
      try {
        valores.Sigla = sugerirSiglaUnica(valores.Nome ?? "", emUso, { manterNumero: true });
        avisos.push(
          `Sigla ${linha.aba === "Áreas" ? "da Área" : "do Local"} «${valores.Nome}»: ${valores.Sigla} (sugerida)`,
        );
      } catch (erro) {
        erros.push(erro instanceof Error ? erro.message : "Não foi possível sugerir sigla única.");
      }
    }
    if (sigla && siglaDuplicada(linha, valores, estado, resultados, area?.id ?? null))
      erros.push(`Sigla «${sigla.toUpperCase()}» já usada neste nível.`);

    if (linha.acao === "CRIAR" && linha.aba === "Áreas") {
      const existente = areasPorNome.get(normalizar(valores.Nome ?? ""));
      if (existente || criadosArea.has(normalizar(valores.Nome ?? "")))
        erros.push(`Já existe uma Área «${valores.Nome}».`);
    }
    if (linha.acao === "CRIAR" && linha.aba === "Sistemas") {
      if (
        sistemasPorNome.has(normalizar(valores.Nome ?? "")) ||
        criadosSistema.has(normalizar(valores.Nome ?? ""))
      )
        erros.push(`Já existe um Sistema «${valores.Nome}».`);
    }
    if (linha.acao === "EDITAR" && ["Sistemas", "Componentes"].includes(linha.aba)) {
      const identificadorAtual =
        linha.aba === "Sistemas"
          ? (atual as Sistema).codigo
          : (atual as EquipamentoItem).identificador;
      if (valores.Identificador && valores.Identificador !== identificadorAtual)
        avisos.push("Identificador não é alterado pela planilha (use a tela do ativo).");
      if (identificadorAtual && (valores.Nome !== atual?.nome || valores.Área || valores.Local))
        avisos.push("O identificador continua o mesmo (fixo).");
    }
    if (
      linha.acao === "CRIAR" &&
      ["Sistemas", "Componentes"].includes(linha.aba) &&
      !valores.Identificador
    ) {
      const categoria = categorias.get(normalizar(valores.Categoria ?? ""));
      const areaParaPrefixo = area ?? (areaNome ? undefined : null);
      if (categoria && estado.cliente.sigla && (!areaParaPrefixo || areaParaPrefixo.sigla)) {
        try {
          const prefixo = montarPrefixoIdentificador({
            cliente: {
              id: estado.cliente.id,
              nome: estado.cliente.nome,
              sigla: estado.cliente.sigla,
            },
            area: areaParaPrefixo
              ? {
                  id: areaParaPrefixo.id,
                  nome: areaParaPrefixo.nome,
                  sigla: areaParaPrefixo.sigla ?? null,
                }
              : null,
            locais: [],
            categoria: { id: categoria.id, nome: categoria.nome, sigla: categoria.sigla ?? null },
            nomeAtivo: valores.Nome ?? "",
          }).prefixo;
          avisos.push(`Identificador previsto: ${prefixo}-##`);
        } catch {
          // As siglas faltantes serão persistidas pelo fluxo normal e o identificador será resolvido nele.
        }
      }
    }

    const detalhes = [...erros, ...avisos];
    const diff = atual && linha.acao === "EDITAR" ? diffDaLinha(linha, valores, atual, estado) : [];
    if (!erros.length) detalhes.push(...diff);
    const resultado: ResultadoPlano = {
      linha,
      resultado: erros.length
        ? "ERRO"
        : linha.acao === "EDITAR" && diff.length === 0
          ? "SEM MUDANÇA"
          : linha.acao,
      detalhes,
      dependeDe: [...new Set(dependeDe)],
      valoresExecutar: valores,
    };
    resultados.push(resultado);
    if (linha.acao === "CRIAR" && !erros.length) {
      if (linha.aba === "Áreas") criadosArea.set(normalizar(valores.Nome ?? ""), resultado);
      if (linha.aba === "Locais") {
        const chave = chaveLocal(
          areaNome,
          [caminhoLocal, valores.Nome ?? ""].filter(Boolean).join(" > "),
        );
        criadosLocal.set(chave, resultado);
      }
      if (linha.aba === "Sistemas") criadosSistema.set(normalizar(valores.Nome ?? ""), resultado);
    }
  }

  validarExclusoes(resultados, estado);
  const ordenados = ordenarExecucao(resultados);
  const resumo = { CRIAR: 0, EDITAR: 0, EXCLUIR: 0, "SEM MUDANÇA": 0, ERRO: 0, AVISO: 0 };
  for (const resultado of ordenados) {
    resumo[resultado.resultado] += 1;
    resumo.AVISO += resultado.detalhes.filter(
      (detalhe) =>
        detalhe.includes("(sugerida)") ||
        detalhe.startsWith("Identificador") ||
        detalhe.startsWith("O identificador"),
    ).length;
  }
  return {
    resultados: ordenados,
    temErros: resumo.ERRO > 0,
    alteracoes: resumo.CRIAR + resumo.EDITAR + resumo.EXCLUIR,
    resumo,
  };
}

function resolverLocal(
  caminho: string,
  areaNome: string,
  areaId: string | null,
  locais: Local[],
  criados: Map<string, ResultadoPlano>,
  criadosNaPlanilha: Map<string, number>,
) {
  const chave = chaveLocalPorId(areaId, caminho);
  const encontrados = locais.filter(
    (local) =>
      local.areaId === areaId && normalizar(caminhoDoLocal(local, locais)) === normalizar(caminho),
  );
  if (encontrados.length > 1)
    return { erro: `Local «${caminho}» é ambíguo na Área «${areaNome}».` };
  if (encontrados.length === 1) return {};
  const chavePorNome = chaveLocal(areaNome, caminho);
  const criado = criados.get(chavePorNome);
  if (criado) return { dependeDe: criado.linha.numero };
  const criadoDepois = criadosNaPlanilha.get(chavePorNome);
  if (criadoDepois) return { dependeDe: criadoDepois };
  void chave;
  return { erro: `Local «${caminho}» não existe na Área «${areaNome}».` };
}

function chaveLocal(area: string, caminho: string) {
  return `${normalizar(area)}|${normalizar(caminho)}`;
}
function chaveLocalPorId(areaId: string | null, caminho: string) {
  return `${areaId ?? ""}|${normalizar(caminho)}`;
}
function caminhoDoLocal(local: Local, locais: Local[]) {
  const porId = new Map(locais.map((item) => [item.id, item]));
  const nomes = [local.nome];
  let pai = local.parentId ? porId.get(local.parentId) : undefined;
  while (pai) {
    nomes.unshift(pai.nome);
    pai = pai.parentId ? porId.get(pai.parentId) : undefined;
  }
  return nomes.join(" > ");
}
function siglasNoNivel(
  linha: LinhaPlanilha,
  estado: EstadoEstrutura,
  anteriores: ResultadoPlano[],
  areaId: string | null,
  pai: string,
) {
  const emUso = new Set<string>();
  if (linha.aba === "Áreas") {
    for (const item of estado.areas) if (item.sigla) emUso.add(item.sigla);
  }
  if (linha.aba === "Locais") {
    const paiId =
      estado.locais.find(
        (item) => item.areaId === areaId && caminhoDoLocal(item, estado.locais) === pai,
      )?.id ?? null;
    for (const item of estado.locais) {
      if (item.areaId === areaId && item.parentId === paiId && item.sigla) emUso.add(item.sigla);
    }
  }
  for (const item of anteriores) {
    if (item.linha.aba === linha.aba && item.resultado === "CRIAR") {
      const sigla = item.valoresExecutar?.Sigla;
      if (sigla) emUso.add(sigla);
    }
  }
  return emUso;
}
function siglaDuplicada(
  linha: LinhaPlanilha,
  valores: Record<string, string>,
  estado: EstadoEstrutura,
  anteriores: ResultadoPlano[],
  areaId: string | null,
) {
  if (linha.aba !== "Áreas" && linha.aba !== "Locais") return false;
  const iguais = siglasNoNivel(linha, estado, anteriores, areaId, valores["Local pai"] ?? "");
  const atual = linha.valores.Id;
  if (atual) {
    const registro =
      linha.aba === "Áreas"
        ? estado.areas.find((item) => item.id === atual)
        : estado.locais.find((item) => item.id === atual);
    if (registro?.sigla === valores.Sigla) return false;
  }
  return iguais.has((valores.Sigla ?? "").toUpperCase());
}
function diffDaLinha(
  linha: LinhaPlanilha,
  valores: Record<string, string>,
  atual: Area | Local | Sistema | EquipamentoItem,
  estado: EstadoEstrutura,
) {
  const campos: Array<[string, string, string | null | undefined]> =
    linha.aba === "Áreas"
      ? [
          ["Nome", valores.Nome ?? "", atual.nome],
          ["Sigla", valores.Sigla ?? "", (atual as Area).sigla],
          ["Ordem", valores.Ordem ?? "", String((atual as Area).ordem)],
        ]
      : linha.aba === "Locais"
        ? [
            ["Nome", valores.Nome ?? "", atual.nome],
            ["Sigla", valores.Sigla ?? "", (atual as Local).sigla],
            ["Ordem", valores.Ordem ?? "", String((atual as Local).ordem)],
          ]
        : linha.aba === "Sistemas"
          ? [
              ["Nome", valores.Nome ?? "", atual.nome],
              ["Categoria", valores.Categoria ?? "", (atual as Sistema).categoria],
              ["Descrição", valores.Descrição ?? "", (atual as Sistema).descricao],
            ]
          : [
              ["Nome", valores.Nome ?? "", atual.nome],
              ["Categoria", valores.Categoria ?? "", (atual as EquipamentoItem).categoria],
              ["Observações", valores.Observações ?? "", (atual as EquipamentoItem).observacoes],
            ];
  void estado;
  return campos
    .filter(([, novo, antigo]) => normalizar(novo ?? "") !== normalizar(antigo ?? ""))
    .map(([campo, novo, antigo]) => `${campo}: ${antigo ?? ""} → ${novo ?? ""}`);
}
function validarExclusoes(resultados: ResultadoPlano[], estado: EstadoEstrutura) {
  const exclusoes = new Set(
    resultados.filter((item) => item.resultado === "EXCLUIR").map((item) => item.linha.valores.Id),
  );
  for (const resultado of resultados) {
    if (resultado.resultado !== "EXCLUIR") continue;
    const id = resultado.linha.valores.Id ?? "";
    const locaisFilhos =
      resultado.linha.aba === "Áreas"
        ? estado.locais.filter((item) => item.areaId === id)
        : estado.locais.filter((item) => item.parentId === id);
    const ativos =
      resultado.linha.aba === "Áreas"
        ? [
            ...estado.sistemas.filter((item) => item.areaId === id),
            ...estado.componentes.filter((item) => item.areaId === id),
          ]
        : [
            ...estado.sistemas.filter((item) => item.localId === id),
            ...estado.componentes.filter((item) => item.localId === id),
          ];
    if (
      locaisFilhos.some((item) => !exclusoes.has(item.id)) ||
      ativos.some((item) => !exclusoes.has(item.id))
    ) {
      resultado.resultado = "ERRO";
      resultado.detalhes.push("Não é possível excluir: ainda tem Locais ou ativos.");
    }
  }
}
function ordenarExecucao(resultados: ResultadoPlano[]) {
  const ordemAba: Record<LinhaPlanilha["aba"], number> = {
    Áreas: 0,
    Locais: 1,
    Sistemas: 2,
    Componentes: 3,
  };
  const profundidade = (item: ResultadoPlano) =>
    item.linha.aba === "Locais"
      ? (item.valoresExecutar?.["Local pai"] ?? "").split(" > ").filter(Boolean).length
      : 0;
  return [...resultados].sort((a, b) => {
    const fase = (item: ResultadoPlano) => (item.resultado === "EXCLUIR" ? 1 : 0);
    if (fase(a) !== fase(b)) return fase(a) - fase(b);
    if (fase(a) === 1)
      return ordemAba[b.linha.aba] - ordemAba[a.linha.aba] || profundidade(b) - profundidade(a);
    return (
      ordemAba[a.linha.aba] - ordemAba[b.linha.aba] ||
      profundidade(a) - profundidade(b) ||
      a.linha.numero - b.linha.numero
    );
  });
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
