/**
 * Fitness function da arquitetura (gate: pnpm run arch:check).
 * Verifica POR MÁQUINA a regra de dependência do CLAUDE.md:
 *   interfaces → application → domain ← infrastructure
 * Adaptado à estrutura real do monorepo OS: apps/web/src/features/<domínio>/
 * {domain,application,infrastructure,pages,components,hooks}. domain/ não importa
 * framework, I/O nem outras camadas. Falha o build se violar.
 */
module.exports = {
  forbidden: [
    {
      name: "domain-nao-importa-camadas",
      severity: "error",
      comment:
        "domain/ é puro: não importa application/, infrastructure/ nem a borda (pages/components/hooks)",
      from: { path: "^apps/web/src/features/[^/]+/domain" },
      to: {
        path: "^apps/web/src/features/[^/]+/(application|infrastructure|pages|components|hooks)",
      },
    },
    {
      name: "domain-nao-importa-framework",
      severity: "error",
      comment: "domain/ não importa nada de node_modules (framework/I-O) — lógica pura",
      from: { path: "^apps/web/src/features/[^/]+/domain" },
      to: { dependencyTypes: ["npm", "npm-dev"] },
    },
    {
      name: "application-nao-importa-borda-nem-infra",
      severity: "error",
      comment:
        "application/ orquestra casos de uso; não importa infrastructure/ nem a borda (pages/components/hooks)",
      from: { path: "^apps/web/src/features/[^/]+/application" },
      to: { path: "^apps/web/src/features/[^/]+/(infrastructure|pages|components|hooks)" },
    },
    {
      name: "sem-dependencia-circular",
      severity: "error",
      comment: "Ciclo entre módulos é acoplamento escondido",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: require("node:path").join(__dirname, "apps/web/tsconfig.json") },
    exclude: { path: "\\.(test|spec)\\.tsx?$" },
  },
};
