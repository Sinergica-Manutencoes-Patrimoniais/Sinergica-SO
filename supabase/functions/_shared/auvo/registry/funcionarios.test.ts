import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { funcionariosDescriptor } from "./funcionarios.ts";

Deno.test("funcionariosDescriptor — mapeia /users sem credenciais em PATCH", () => {
  assertEquals(funcionariosDescriptor.webhookEntity, 1);
  assertEquals(funcionariosDescriptor.deactivatePatch, { unavailableForTasks: true });
  assertEquals(
    funcionariosDescriptor.toAuvo({
      id: "f1",
      nome: "Técnica Campo",
      cargo: "Técnica",
      telefone: "11999990000",
      email: "tecnica@example.com",
      culture: "pt-BR",
      user_type: 1,
      ativo: true,
      login: "nao-deve-sair",
      password: "nao-deve-sair",
    }),
    {
      name: "Técnica Campo",
      jobPosition: "Técnica",
      phoneNumber: "11999990000",
      email: "tecnica@example.com",
      culture: "pt-BR",
      userType: 1,
      unavailableForTasks: false,
    },
  );
});

Deno.test("funcionariosDescriptor — inbound atualiza auvo_user_id e disponibilidade", () => {
  assertEquals(
    funcionariosDescriptor.fromAuvo({
      userID: 42,
      name: "Gestor",
      jobPosition: "Supervisor",
      culture: "pt-BR",
      userType: { id: 2 },
      unavailableForTasks: true,
    }),
    {
      auvo_user_id: 42,
      nome: "Gestor",
      equipe: null,
      cargo: "Supervisor",
      telefone: null,
      email: null,
      culture: "pt-BR",
      user_type: 2,
      ativo: false,
    },
  );
});
