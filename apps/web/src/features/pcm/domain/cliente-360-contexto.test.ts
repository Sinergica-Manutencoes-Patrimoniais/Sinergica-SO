import { describe, expect, it } from "vitest";
import { contextoAposTrocaDeCliente, contextoPertenceAoCliente } from "./cliente-360-contexto";

const contexto = {
  tipo: "os" as const,
  id: "os-1",
  clienteId: "cliente-a",
  originElementId: "os-1-trigger",
};

describe("ContextoDetalhe360", () => {
  it("aceita somente o detalhe do cliente atualmente aberto", () => {
    expect(contextoPertenceAoCliente(contexto, "cliente-a")).toBe(true);
    expect(contextoPertenceAoCliente(contexto, "cliente-b")).toBe(false);
  });

  it("fecha o detalhe quando há troca de cliente", () => {
    expect(contextoAposTrocaDeCliente(contexto, "cliente-a", "cliente-b")).toBeNull();
  });

  it("preserva o detalhe válido quando o cliente não mudou", () => {
    expect(contextoAposTrocaDeCliente(contexto, "cliente-a", "cliente-a")).toEqual(contexto);
  });
});
