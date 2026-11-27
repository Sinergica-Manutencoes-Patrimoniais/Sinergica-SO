// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ResumoListaMaterial, rotuloEstadoListaMaterial } from "./ResumoListaMaterial";

it("mostra o número autorizado e traduz o estado da lista", () => {
  render(
    <p>
      <ResumoListaMaterial
        estado="informada_disponivel"
        responsavel="cliente"
        revisao={2}
        numeroOs="CH-9901"
      />
    </p>,
  );
  expect(
    screen.getByText("OS CH-9901 · Cliente · Disponibilidade informada · revisão 2"),
  ).toBeVisible();
});

it("usa texto compreensível para dados ausentes", () => {
  render(
    <p>
      <ResumoListaMaterial estado="estado_desconhecido" responsavel="sinergica" revisao={1} />
    </p>,
  );
  expect(
    screen.getByText(/Número da OS indisponível · Sinérgica · Estado indisponível/),
  ).toBeVisible();
  expect(rotuloEstadoListaMaterial("concluida")).toBe("Concluída");
  expect(rotuloEstadoListaMaterial("dispensada")).toBe("Dispensada");
  expect(rotuloEstadoListaMaterial("constructor")).toBe("Estado indisponível");
});
