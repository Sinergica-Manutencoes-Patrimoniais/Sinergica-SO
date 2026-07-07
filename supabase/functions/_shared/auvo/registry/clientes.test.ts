import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { clientesDescriptor } from "./clientes.ts";

Deno.test("clientesDescriptor — mapeia Customer para /customers com webhook entity 7", () => {
  assertEquals(clientesDescriptor.auvoBasePath, "/customers");
  assertEquals(clientesDescriptor.webhookEntity, 7);
  assertEquals(
    clientesDescriptor.toAuvo({
      id: "c1",
      nome: "Condomínio Primavera",
      cnpj: "12.345.678/0001-99",
      ativo: true,
      endereco: "Rua A, 123",
      contato_nome: "Síndico",
      contato_telefone: "11999990000",
      contato_email: "sindico@example.com",
      observacoes: "Portaria 24h",
    }),
    {
      name: "Condomínio Primavera",
      legalName: "Condomínio Primavera",
      cpfCnpj: "12.345.678/0001-99",
      active: true,
      address: "Rua A, 123",
      phoneNumber: ["11999990000"],
      email: ["sindico@example.com"],
      note: "Portaria 24h",
      contacts: [{ name: "Síndico", phoneNumber: "11999990000", email: "sindico@example.com" }],
    },
  );
});

Deno.test("clientesDescriptor — inbound usa campos reais do Customer", () => {
  assertEquals(
    clientesDescriptor.fromAuvo({
      id: 77,
      name: "Cliente Auvo",
      cpfCnpj: "00000000000100",
      active: false,
      address: "Av. Brasil, 100",
      phoneNumber: ["1133334444"],
      email: ["cliente@example.com"],
      note: "Obs",
    }),
    {
      nome: "Cliente Auvo",
      cnpj: "00000000000100",
      ativo: false,
      endereco: "Av. Brasil, 100",
      contato_nome: null,
      contato_telefone: "1133334444",
      contato_email: "cliente@example.com",
      observacoes: "Obs",
    },
  );
});
