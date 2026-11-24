#!/usr/bin/env node
// E01-S190 task 1 — inventário das ações/views alcançáveis pela navegação do SSO (AC-7).
//
// POR QUE ESTE SCRIPT EXISTE
// Reorganizar menu é onde se perde funcionalidade sem ninguém perceber: a tela continua no
// código, o componente continua montando, só que nenhum caminho de navegação chega até ela.
// O gate desta story é comparativo — `node scripts/inventariar-navegacao.mjs` ANTES e DEPOIS da
// mudança, e o diff vai no corpo do PR. Ação que sumiu sem decisão registrada é regressão.
//
// O QUE ELE LÊ
// A árvore de navegação é dado literal no front. Até E01-S190 ela morava inteira dentro de
// `apps/web/src/app/HomePage.tsx`; a task 2 moveu os mesmos literais, sem trocar rótulo, para
// `apps/web/src/app/navegacao-sso.ts`. Por isso o script procura cada constante nos dois
// arquivos, na ordem, e usa a primeira que encontrar — a saída é idêntica antes e depois da
// extração, que é exatamente o que a task 2 precisa provar.
//
// O QUE ELE *NÃO* É
// Não é o runtime. A autorização real é resolvida no servidor (`config.minhas_permissoes`,
// `config.sso_autorizar_acao`) e a regra do produto é explícita: ocultar é consequência da
// permissão, nunca lista fixa por papel (AC-6). Os perfis abaixo são uma SIMULAÇÃO de concessões
// — "um usuário com estas permissões e estas capacidades enxerga isto" —, serve para diffar
// alcance entre duas versões do menu, não para decidir acesso.
//
// Uso:
//   node scripts/inventariar-navegacao.mjs                 # árvore vigente (flag desligada)
//   node scripts/inventariar-navegacao.mjs --nova          # árvore Trabalho/Gestão/Administração
//   node scripts/inventariar-navegacao.mjs --perfil pcm    # só um perfil simulado
import { existsSync, readFileSync } from "node:fs";

const CANDIDATOS_NAV = ["apps/web/src/app/navegacao-sso.ts", "apps/web/src/app/HomePage.tsx"];
const ARQUIVO_MODULOS = "apps/web/src/app/modulos.ts";

// ─── leitura dos literais ────────────────────────────────────────────────────

/** Texto do array literal atribuído a `const <nome>` — do primeiro `[` depois do `=` até o `]`
 * que o fecha. Começar no `[` (e não no `const`) descarta a anotação de tipo, que em
 * `CONFIG_NAV: Array<{...}>` também tem chaves e confundiria o leitor de objetos. */
function blocoDoConst(texto, nome) {
  const decl = texto.indexOf(`const ${nome}`);
  if (decl === -1) return null;
  const igual = texto.indexOf("=", decl);
  const abre = texto.indexOf("[", igual);
  if (igual === -1 || abre === -1) return null;
  let profundidade = 0;
  for (let i = abre; i < texto.length; i++) {
    if (texto[i] === "[") profundidade++;
    else if (texto[i] === "]") {
      profundidade--;
      if (profundidade === 0) return texto.slice(abre, i + 1);
    }
  }
  return null;
}

function lerConst(nome) {
  for (const arquivo of CANDIDATOS_NAV) {
    if (!existsSync(arquivo)) continue;
    const bloco = blocoDoConst(readFileSync(arquivo, "utf8"), nome);
    if (bloco) return { bloco, arquivo };
  }
  return null;
}

function campo(objeto, chave) {
  const m = new RegExp(`\\b${chave}\\s*:\\s*"([^"]*)"`).exec(objeto);
  return m ? m[1] : null;
}

function temBandeira(objeto, chave) {
  return new RegExp(`\\b${chave}\\s*:\\s*true`).test(objeto);
}

/** Objetos-folha (sem chaves aninhadas) do bloco, na ordem do arquivo, cada um já com o `titulo:`
 * do grupo que o antecede. Grupo também pode vir de um campo `grupo:` dentro do próprio objeto —
 * é a forma da árvore nova, que é plana. */
function itensDoBloco(bloco, grupoPadrao) {
  const titulos = [];
  const rxTitulo = /\btitulo\s*:\s*"([^"]*)"/g;
  let t = rxTitulo.exec(bloco);
  while (t) {
    titulos.push({ pos: t.index, titulo: t[1] });
    t = rxTitulo.exec(bloco);
  }

  const itens = [];
  const rxFolha = /\{[^{}]*\}/g;
  let f = rxFolha.exec(bloco);
  while (f) {
    const objeto = f[0];
    const label = campo(objeto, "label");
    const id = campo(objeto, "id");
    if (label || id) {
      let grupo = grupoPadrao;
      for (const candidato of titulos) if (candidato.pos < f.index) grupo = candidato.titulo;
      itens.push({
        grupo: campo(objeto, "grupo") ?? grupo,
        label: label ?? id,
        view: campo(objeto, "view") ?? id ?? "—",
        nivel: campo(objeto, "nivel"),
        modulo: campo(objeto, "modulo"),
        exigeNivel: campo(objeto, "exigeNivel"),
        capacidade: campo(objeto, "capacidade"),
        atalhoConfigGrupos: temBandeira(objeto, "atalhoConfigGrupos"),
      });
    }
    f = rxFolha.exec(bloco);
  }
  return itens;
}

function navDe(nome, grupoPadrao) {
  const achado = lerConst(nome);
  if (!achado) return [];
  return itensDoBloco(achado.bloco, grupoPadrao);
}

function modulosDeNegocio() {
  const bloco = blocoDoConst(readFileSync(ARQUIVO_MODULOS, "utf8"), "MODULOS");
  if (!bloco) throw new Error(`MODULOS não encontrado em ${ARQUIVO_MODULOS}`);
  return itensDoBloco(bloco, "MÓDULOS")
    .map((item) => ({ id: item.view, label: item.label }))
    .filter((m) => m.id !== "inicio");
}

// ─── perfis simulados ────────────────────────────────────────────────────────
//
// `modulos` = nível resolvido por `config.minhas_permissoes` para cada módulo.
// `capacidades` = concessões de `config.sso_acoes` (`*` só para superadmin, que faz bypass).
// `pcm-leitura` existe para provar o AC do Fabrício "Administração não aparece sem autorização":
// é o mesmo módulo do operador, só que sem escrita.
const TODOS_MODULOS = {
  pcm: "escrita",
  atendimento: "escrita",
  comercial: "escrita",
  financeiro: "escrita",
  marketing: "escrita",
  gestao: "escrita",
  "area-cliente": "escrita",
};

const PERFIS = [
  { nome: "superadmin", papel: "superadmin", modulos: TODOS_MODULOS, capacidades: ["*"] },
  {
    nome: "supervisor",
    papel: "supervisor",
    modulos: TODOS_MODULOS,
    capacidades: ["cadastro.gerir"],
  },
  { nome: "operador-pcm", papel: "colaborador", modulos: { pcm: "escrita" }, capacidades: [] },
  { nome: "pcm-leitura", papel: "colaborador", modulos: { pcm: "leitura" }, capacidades: [] },
  {
    nome: "financeiro",
    papel: "colaborador",
    modulos: { financeiro: "escrita" },
    capacidades: [],
  },
  {
    nome: "cliente-sindico",
    papel: "cliente-sindico",
    modulos: { "area-cliente": "leitura" },
    capacidades: [],
  },
];

const FLAGS_LIGADAS = new Set(); // nenhuma — a navegação nova é opt-in (AC-F2/E00-S28)

function veModulo(perfil, id) {
  return perfil.papel === "superadmin" || perfil.modulos[id] !== undefined;
}

function temNivel(perfil, id, nivel) {
  if (perfil.papel === "superadmin") return true;
  const atual = perfil.modulos[id];
  if (atual === undefined) return false;
  return nivel === "leitura" ? true : atual === "escrita";
}

function temCapacidade(perfil, capacidade) {
  if (!capacidade) return true;
  return perfil.capacidades.includes("*") || perfil.capacidades.includes(capacidade);
}

function podeGerenciarConfig(perfil) {
  return perfil.papel === "superadmin" || perfil.papel === "supervisor";
}

// ─── projeção por perfil ─────────────────────────────────────────────────────

function linhasLegadas(perfil, arvores, modulos) {
  const linhas = [];
  for (const m of modulos) if (veModulo(perfil, m.id)) linhas.push(["modulo", "MÓDULOS", m.label, m.id]);
  // Guia do SO não é módulo permissionável — qualquer usuário logado alcança.
  linhas.push(["guia", "TOPO", "Guia do SO", "guia"]);

  if (veModulo(perfil, "pcm")) for (const i of arvores.pcm) linhas.push(["pcm", i.grupo, i.label, i.atalhoConfigGrupos ? "config:grupos" : i.view]);
  if (veModulo(perfil, "atendimento")) for (const i of arvores.atendimento) linhas.push(["atendimento", i.grupo, i.label, i.view]);
  if (veModulo(perfil, "financeiro")) for (const i of arvores.financeiro) linhas.push(["financeiro", i.grupo, i.label, i.view]);
  if (veModulo(perfil, "comercial")) for (const i of arvores.comercial) linhas.push(["comercial", i.grupo, i.label, i.view]);
  for (const i of arvores.guia) linhas.push(["guia", i.grupo, i.label, i.view]);

  if (podeGerenciarConfig(perfil)) {
    for (const i of arvores.config) {
      if (i.view === "capacidades" && perfil.papel !== "superadmin") continue;
      if (i.view === "ativacao") {
        const liberado =
          perfil.papel === "superadmin" && FLAGS_LIGADAS.has("VITE_SSO_DIAGNOSTICO_ATIVACAO_ENABLED");
        if (!liberado) continue;
      }
      linhas.push(["config", i.grupo, i.label, i.view]);
    }
  }
  return linhas;
}

function linhasNovas(perfil, arvores) {
  const linhas = [];
  for (const i of arvores.nova) {
    const modulo = i.modulo ?? "pcm";
    if (!temNivel(perfil, modulo, i.exigeNivel ?? "leitura")) continue;
    if (!temCapacidade(perfil, i.capacidade)) continue;
    linhas.push([
      `${modulo}:${i.nivel ?? "trabalho"}`,
      i.grupo,
      i.label,
      i.atalhoConfigGrupos ? "config:grupos" : i.view,
    ]);
  }
  return linhas;
}

function main() {
  const argv = process.argv.slice(2);
  const usarNova = argv.includes("--nova");
  const perfilFiltro = argv.includes("--perfil") ? argv[argv.indexOf("--perfil") + 1] : null;

  const arvores = {
    pcm: navDe("PCM_NAV", "PCM"),
    config: navDe("CONFIG_NAV", "CONFIGURAÇÕES"),
    atendimento: navDe("ATENDIMENTO_NAV", "ATENDIMENTO"),
    financeiro: navDe("FINANCEIRO_NAV", "FINANCEIRO"),
    comercial: navDe("COMERCIAL_NAV", "COMERCIAL"),
    guia: navDe("GUIA_NAV", "GUIA DO SO"),
    nova: navDe("NAVEGACAO_SSO", "TRABALHO"),
  };
  const modulos = modulosDeNegocio();

  if (usarNova && arvores.nova.length === 0) {
    console.error("✗ NAVEGACAO_SSO não existe ainda — rode sem --nova para a árvore vigente.");
    process.exit(1);
  }

  console.log(`# INVENTÁRIO DE NAVEGAÇÃO — árvore ${usarNova ? "nova (Trabalho/Gestão/Administração)" : "vigente"}`);
  console.log("# perfil\tarea\tgrupo\trotulo\tview");
  for (const perfil of PERFIS) {
    if (perfilFiltro && perfil.nome !== perfilFiltro) continue;
    const linhas = usarNova ? linhasNovas(perfil, arvores) : linhasLegadas(perfil, arvores, modulos);
    console.log(`\n## PERFIL ${perfil.nome} (papel=${perfil.papel})`);
    console.log(`## alcança ${linhas.length} entrada(s)`);
    for (const [area, grupo, rotulo, view] of linhas) {
      console.log(`${perfil.nome}\t${area}\t${grupo}\t${rotulo}\t${view}`);
    }
  }
}

main();
