/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        // Garante que o scope siga o formato E0N-S0N (ex: E00-S01, E01-S02)
        "scope-epic-story": ({ scope }) => {
          // Commits de merge ou revert podem não ter scope — deixamos passar
          if (!scope) {
            return [
              false,
              "scope obrigatório no formato E0N-S0N (ex: E00-S01). Leia docs/epics/ROADMAP.md.",
            ];
          }
          if (!/^E\d{2}-S\d{2}$/.test(scope)) {
            return [
              false,
              `scope inválido: "${scope}". Use o formato E0N-S0N (ex: E00-S01). Leia docs/epics/ROADMAP.md.`,
            ];
          }
          return [true, ""];
        },
      },
    },
  ],
  rules: {
    "scope-empty": [2, "never"],
    "scope-epic-story": [2, "always"],
  },
};
