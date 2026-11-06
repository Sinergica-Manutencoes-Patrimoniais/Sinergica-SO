import { describe, expect, it } from "vitest";
import { type ContextoEnvioT24, avaliarEnvioT24, avaliarReconciliacaoTarefa } from "./envio-t24";

const contexto: ContextoEnvioT24 = {
  agora: "2026-10-31T11:00:00Z",
  inicioVisita: "2026-11-01T08:00:00-03:00",
  estadoVisita: "confirmada",
  revisaoVisita: 3,
  revisaoConfirmada: 3,
  politicaCiencia: "nao_exigida",
  cienciaConfirmada: false,
  estadoOs: "aberta",
  integracao: "sem_tarefa",
  tarefaId: null,
  contratoComprovado: true,
  camposComprovados: true,
};

describe("elegibilidade informativa T−24", () => {
  it("aguarda antes do limite e libera exatamente no limite em UTC equivalente a Brasília", () => {
    expect(avaliarEnvioT24({ ...contexto, agora: "2026-10-31T10:59:59Z" })).toEqual({
      situacao: "aguardando",
      elegivelEm: "2026-10-31T11:00:00.000Z",
    });
    expect(avaliarEnvioT24(contexto)).toEqual({ situacao: "elegivel", operacao: "criar" });
  });
  it("permite confirmação tardia mas recusa confirmação de revisão antiga", () => {
    expect(avaliarEnvioT24({ ...contexto, agora: "2026-11-01T12:00:00Z" })).toEqual({
      situacao: "elegivel",
      operacao: "criar",
    });
    expect(avaliarEnvioT24({ ...contexto, revisaoConfirmada: 2 })).toEqual({
      situacao: "bloqueada",
      motivo: "confirmacao_invalida",
    });
  });
  it("exige ciência somente quando obrigatória", () => {
    expect(avaliarEnvioT24({ ...contexto, politicaCiencia: "obrigatoria" })).toEqual({
      situacao: "bloqueada",
      motivo: "ciencia_pendente",
    });
    expect(
      avaliarEnvioT24({ ...contexto, politicaCiencia: "obrigatoria", cienciaConfirmada: true }),
    ).toEqual({ situacao: "elegivel", operacao: "criar" });
  });
  it("não cria tarefa quando resultado é incerto ou tarefa já está atualizada", () => {
    expect(avaliarEnvioT24({ ...contexto, integracao: "incerto" })).toEqual({
      situacao: "bloqueada",
      motivo: "reconciliacao_pendente",
    });
    expect(avaliarEnvioT24({ ...contexto, integracao: "sincronizada", tarefaId: "123" })).toEqual({
      situacao: "sem_acao",
    });
    expect(
      avaliarEnvioT24({ ...contexto, integracao: "atualizacao_pendente", tarefaId: "123" }),
    ).toEqual({ situacao: "elegivel", operacao: "atualizar" });
  });
  it("sem data não declara tarefa sincronizada nem a exclui", () => {
    expect(
      avaliarEnvioT24({
        ...contexto,
        inicioVisita: null,
        integracao: "sincronizada",
        tarefaId: "123",
      }),
    ).toEqual({ situacao: "bloqueada", motivo: "sem_data" });
  });
  it("recusa criação quando há ID de tarefa conflitante", () => {
    expect(avaliarEnvioT24({ ...contexto, tarefaId: "123" })).toEqual({
      situacao: "bloqueada",
      motivo: "reconciliacao_pendente",
    });
  });
  it("bloqueia visita cancelada, OS encerrada e ausência de provas de contrato", () => {
    expect(avaliarEnvioT24({ ...contexto, estadoVisita: "cancelada" })).toEqual({
      situacao: "bloqueada",
      motivo: "visita_inelegivel",
    });
    expect(avaliarEnvioT24({ ...contexto, estadoOs: "encerrada" })).toEqual({
      situacao: "bloqueada",
      motivo: "os_inelegivel",
    });
    expect(avaliarEnvioT24({ ...contexto, contratoComprovado: false })).toEqual({
      situacao: "bloqueada",
      motivo: "contrato_nao_comprovado",
    });
  });
  it("recusa horário sem fuso e datas normalizadas automaticamente", () => {
    expect(() => avaliarEnvioT24({ ...contexto, inicioVisita: "2026-11-01T08:00:00" })).toThrow(
      /instante/i,
    );
    expect(() => avaliarEnvioT24({ ...contexto, inicioVisita: "2026-02-30T08:00:00Z" })).toThrow(
      /instante/i,
    );
  });
});

describe("reconciliação informativa de resultado incerto", () => {
  it("distingue lista vazia de busca incompleta sem autorizar novo envio", () => {
    expect(avaliarReconciliacaoTarefa({ buscaCompleta: false, candidatos: [] })).toEqual({
      situacao: "incerto",
      motivo: "busca_incompleta",
    });
    expect(avaliarReconciliacaoTarefa({ buscaCompleta: true, candidatos: [] })).toEqual({
      situacao: "nenhum_candidato",
    });
  });
  it("reconcilia candidato único e exige decisão para candidatos múltiplos", () => {
    expect(avaliarReconciliacaoTarefa({ buscaCompleta: true, candidatos: ["id-1"] })).toEqual({
      situacao: "candidato_unico",
      tarefaId: "id-1",
    });
    expect(
      avaliarReconciliacaoTarefa({ buscaCompleta: true, candidatos: ["id-1", "id-2"] }),
    ).toEqual({
      situacao: "decisao_necessaria",
      candidatos: ["id-1", "id-2"],
    });
  });
  it("não interpreta IDs vazios ou repetidos como prova de identidade", () => {
    for (const candidatos of [[""], ["id-1", "id-1"], [" id-1 "]]) {
      expect(avaliarReconciliacaoTarefa({ buscaCompleta: true, candidatos })).toEqual({
        situacao: "incerto",
        motivo: "candidatos_invalidos",
      });
    }
  });
});
