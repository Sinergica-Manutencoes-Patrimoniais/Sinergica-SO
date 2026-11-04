import { describe, expect, it } from "vitest";
import { resumirProgressoChamado } from "./progresso-chamado";

describe("progresso de OS do Chamado", () => {
  it("apresenta contagem e indica etapas mistas com status efetivos", () => {
    expect(resumirProgressoChamado(["planejamento", "em_execucao", "finalizado"], true)).toEqual({
      total: 3,
      finalizadas: 1,
      etapasMistas: true,
    });
    expect(resumirProgressoChamado(["finalizado", "cancelado"], true)).toEqual({
      total: 2,
      finalizadas: 1,
      etapasMistas: true,
    });
  });
  it("não calcula resumo para dados parciais, vazios ou status desconhecidos", () => {
    expect(resumirProgressoChamado(["finalizado"], false)).toBeNull();
    expect(resumirProgressoChamado([], true)).toBeNull();
    expect(resumirProgressoChamado(["finalizado", "legado_desconhecido"], true)).toEqual({
      total: 2,
      finalizadas: 1,
      etapasMistas: false,
    });
  });
});
