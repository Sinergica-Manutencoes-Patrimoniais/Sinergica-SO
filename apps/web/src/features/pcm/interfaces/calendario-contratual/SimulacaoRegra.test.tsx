// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SimulacaoRegra } from "./SimulacaoRegra";

afterEach(cleanup);

it("simula datas de regra sem criar visitas e identifica limites da projeção", () => {
  render(
    <SimulacaoRegra
      regra={{
        id: "r1",
        serieId: "s1",
        contratoId: "c1",
        numero: 1,
        ancoraSemana: "2026-10-05",
        diaSemana: 5,
        intervaloSemanas: 1,
        horaInicio: "08:00",
        duracaoMinutos: 120,
        deslocamentoMinutos: 0,
        fuso: "America/Sao_Paulo",
        vigenciaInicio: "2026-10-01",
        vigenciaFim: null,
      }}
    />,
  );
  fireEvent.change(screen.getByLabelText("Início da simulação"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(screen.getByLabelText("Fim da simulação"), { target: { value: "2026-10-18" } });
  fireEvent.click(screen.getByRole("button", { name: "Simular datas" }));
  expect(screen.getByText("2026-10-09")).toBeTruthy();
  expect(screen.getByText("2026-10-16")).toBeTruthy();
  expect(screen.getByText(/não consulta feriados oficiais/i)).toBeTruthy();
  expect(screen.getByText(/não cria visitas/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Comparar mudança hipotética" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Fim da simulação"), { target: { value: "2026-10-10" } });
  expect(screen.queryByText("2026-10-16")).toBeNull();
});

it("simula feriado informado sem propor reposição e invalida resultado ao alterar entrada", () => {
  render(
    <SimulacaoRegra
      regra={{
        id: "r1",
        serieId: "s1",
        contratoId: "c1",
        numero: 1,
        ancoraSemana: "2026-10-05",
        diaSemana: 5,
        intervaloSemanas: 1,
        horaInicio: "08:00",
        duracaoMinutos: 120,
        deslocamentoMinutos: 0,
        fuso: "America/Sao_Paulo",
        vigenciaInicio: "2026-10-01",
        vigenciaFim: null,
      }}
    />,
  );
  fireEvent.change(screen.getByLabelText("Início da simulação"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(screen.getByLabelText("Fim da simulação"), { target: { value: "2026-10-18" } });
  fireEvent.change(screen.getByLabelText("Feriado hipotético"), {
    target: { value: "2026-10-09" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar feriado" }));
  fireEvent.click(screen.getByRole("button", { name: "Simular datas" }));
  expect(screen.getByText("2026-10-16")).toBeTruthy();
  expect(screen.getByText("2026-10-09 — suprimida por feriado hipotético")).toBeTruthy();
  expect(screen.getByText("Prévia: 1 data proposta e 1 data suprimida.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remover feriado 2026-10-09" }));
  expect(screen.queryByText("2026-10-16")).toBeNull();
  expect(screen.queryByText("2026-10-09 — suprimida por feriado hipotético")).toBeNull();
  expect(screen.queryByText(/Prévia: 1 data proposta/)).toBeNull();
});

it("explica período inválido e não mostra resultado anterior", () => {
  render(
    <SimulacaoRegra
      regra={{
        id: "r1",
        serieId: "s1",
        contratoId: "c1",
        numero: 1,
        ancoraSemana: "2026-10-05",
        diaSemana: 5,
        intervaloSemanas: 1,
        horaInicio: "08:00",
        duracaoMinutos: 120,
        deslocamentoMinutos: 0,
        fuso: "America/Sao_Paulo",
        vigenciaInicio: "2026-10-01",
        vigenciaFim: null,
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Simular datas" }));
  expect(screen.getByRole("alert").textContent).toMatch(/confira o período/i);
  expect(screen.queryByText("2026-10-09")).toBeNull();
});

it("não permite simular enquanto feriado digitado não foi incluído", () => {
  render(
    <SimulacaoRegra
      regra={{
        id: "r1",
        serieId: "s1",
        contratoId: "c1",
        numero: 1,
        ancoraSemana: "2026-10-05",
        diaSemana: 5,
        intervaloSemanas: 1,
        horaInicio: "08:00",
        duracaoMinutos: 120,
        deslocamentoMinutos: 0,
        fuso: "America/Sao_Paulo",
        vigenciaInicio: "2026-10-01",
        vigenciaFim: null,
      }}
    />,
  );
  fireEvent.change(screen.getByLabelText("Início da simulação"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(screen.getByLabelText("Fim da simulação"), { target: { value: "2026-10-11" } });
  fireEvent.click(screen.getByRole("button", { name: "Simular datas" }));
  expect(screen.getByText("2026-10-09")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Feriado hipotético"), {
    target: { value: "2026-10-09" },
  });
  expect(screen.queryByText("2026-10-09")).toBeNull();
  expect(
    (screen.getByRole("button", { name: "Simular datas" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});

it("descarta resultado quando a regra recebe uma revisão diferente", () => {
  const regra = {
    id: "r1",
    serieId: "s1",
    contratoId: "c1",
    numero: 1,
    ancoraSemana: "2026-10-05",
    diaSemana: 5,
    intervaloSemanas: 1,
    horaInicio: "08:00",
    duracaoMinutos: 120,
    deslocamentoMinutos: 0,
    fuso: "America/Sao_Paulo",
    vigenciaInicio: "2026-10-01",
    vigenciaFim: null,
  };
  const tela = render(<SimulacaoRegra regra={regra} />);
  fireEvent.change(screen.getByLabelText("Início da simulação"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(screen.getByLabelText("Fim da simulação"), { target: { value: "2026-10-11" } });
  fireEvent.click(screen.getByRole("button", { name: "Simular datas" }));
  expect(screen.getByText("2026-10-09")).toBeTruthy();
  tela.rerender(<SimulacaoRegra regra={{ ...regra, diaSemana: 2, numero: 2 }} />);
  expect(screen.queryByText("2026-10-09")).toBeNull();
});
