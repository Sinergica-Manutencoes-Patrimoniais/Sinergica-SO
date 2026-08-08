import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NumeroTabular } from "./NumeroTabular";

describe("NumeroTabular — E00-S18 AC-6", () => {
  it("aplica font-brand e tabular-nums", () => {
    render(<NumeroTabular>R$ 1.234,56</NumeroTabular>);
    const el = screen.getByText("R$ 1.234,56");
    expect(el.className).toContain("font-brand");
    expect(el.className).toContain("tabular-nums");
  });
});
