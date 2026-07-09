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

Deno.test("funcionariosDescriptor — inbound real: smartPhoneNumber e userType.userTypeId", () => {
  // Confirmado direto na API real (2026-07-09): GET /users devolve `smartPhoneNumber` (não
  // `phoneNumber`) e `userType` como `{ userTypeId, description }` (não `{ id, description }`) —
  // telefone/user_type sempre ficavam vazios/errados antes desse fix.
  assertEquals(
    funcionariosDescriptor.fromAuvo({
      userID: 153005,
      name: "Davi Guedes",
      smartPhoneNumber: "19982268457",
      jobPosition: "Oficial de Manutenção",
      culture: "pt-BR",
      userType: { userTypeId: 1, description: "User" },
      unavailableForTasks: false,
    }),
    {
      auvo_user_id: 153005,
      nome: "Davi Guedes",
      equipe: null,
      cargo: "Oficial de Manutenção",
      telefone: "19982268457",
      email: null,
      culture: "pt-BR",
      user_type: 1,
      ativo: true,
    },
  );
});
