import { describe, expect, it } from "vitest";
import { cliente360QueryKeys } from "./cliente-360-query-keys";

describe("cliente360QueryKeys", () => {
  it("isola detalhes de clientes distintos", () => {
    expect(cliente360QueryKeys.detalheOs("cliente-a", "os-1")).not.toEqual(
      cliente360QueryKeys.detalheOs("cliente-b", "os-1"),
    );
  });
});
