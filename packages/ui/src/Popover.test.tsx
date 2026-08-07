import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Popover } from "./Popover";

describe("Popover", () => {
  it("abre ao clicar no trigger e mostra o conteúdo", async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<button type="button">Abrir</button>}>
        <p>Conteúdo do popover</p>
      </Popover>,
    );
    expect(screen.queryByText("Conteúdo do popover")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByText("Conteúdo do popover")).toBeInTheDocument();
  });

  it("Escape fecha", async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<button type="button">Abrir</button>}>
        <p>Conteúdo do popover</p>
      </Popover>,
    );
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByText("Conteúdo do popover")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Conteúdo do popover")).not.toBeInTheDocument();
  });
});
