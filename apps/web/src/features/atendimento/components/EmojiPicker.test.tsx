// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { EmojiPicker } from "./EmojiPicker";

function Wrapper({ onMudar }: { onMudar: (v: string) => void }) {
  const ref = createRef<HTMLInputElement>();
  return (
    <div>
      <EmojiPicker inputRef={ref} valor="Olá" onMudar={onMudar} />
      <input ref={ref} defaultValue="Olá" />
    </div>
  );
}

describe("EmojiPicker — E02-S29", () => {
  it("botão tem aria-label correto", () => {
    render(<Wrapper onMudar={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Inserir emoji" })).toBeInTheDocument();
  });

  it("clicar num emoji chama onMudar inserindo na posição do cursor", async () => {
    const user = userEvent.setup();
    const onMudar = vi.fn();
    render(<Wrapper onMudar={onMudar} />);
    const input = screen.getByDisplayValue("Olá") as HTMLInputElement;
    input.focus();
    input.setSelectionRange(2, 2); // cursor entre "Ol" e "á"
    await user.click(screen.getByRole("button", { name: "Inserir emoji" }));
    const botaoEmoji = screen.getByRole("button", { name: "👍" });
    await user.click(botaoEmoji);
    expect(onMudar).toHaveBeenCalledWith("Ol👍á");
  });

  it("clicar fora fecha o painel", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Wrapper onMudar={vi.fn()} />
        <button type="button">Fora</button>
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "Inserir emoji" }));
    expect(screen.getByRole("button", { name: "👍" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fora" }));
    expect(screen.queryByRole("button", { name: "👍" })).not.toBeInTheDocument();
  });
});
