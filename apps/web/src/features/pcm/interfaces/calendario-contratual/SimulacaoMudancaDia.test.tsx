// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SimulacaoMudancaDia } from "./SimulacaoMudancaDia";

afterEach(cleanup);

it("compara mudança hipotética sem ocultar feriado e invalida resultado ao editar", () => {
  render(
    <SimulacaoMudancaDia
      regra={{
        ancoraSemana: "2026-10-05",
        vigenciaInicio: "2026-10-01",
        vigenciaFim: null,
        diaSemana: 5,
        intervaloSemanas: 1,
      }}
      inicio="2026-10-12"
      fim="2026-10-18"
      feriados={["2026-10-16"]}
    />,
  );
  fireEvent.change(screen.getByLabelText("Data de referência hipotética"), {
    target: { value: "2026-10-10" },
  });
  fireEvent.change(screen.getByLabelText("Início hipotético da mudança"), {
    target: { value: "2026-10-13" },
  });
  fireEvent.change(screen.getByLabelText("Novo dia hipotético"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Comparar mudança hipotética" }));
  expect(screen.getByText(/2026-10-16.*suprimida/)).toBeTruthy();
  expect(screen.getByText(/2026-10-13.*prevista/)).toBeTruthy();
  expect(screen.getByText(/não confirma impacto operacional/i)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Novo dia hipotético"), { target: { value: "3" } });
  expect(screen.queryByText(/2026-10-13.*prevista/)).toBeNull();
});
