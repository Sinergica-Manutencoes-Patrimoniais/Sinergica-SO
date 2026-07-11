// Testes do mapeamento puro de posição GPS — cobre AC-1 (linha válida, vínculo com funcionário)
// de specs/E01-S52-gps-equipe/spec.md. O endpoint real está respondendo 500 (server-side Auvo,
// chamado aberto); o shape segue o OpenAPI oficial até o contrato real ser observável.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapGps } from "./index.ts";

Deno.test("mapGps — mapeia posição completa e vincula funcionário local", () => {
  assertEquals(
    mapGps(
      {
        userId: 153005,
        positionDate: "2026-07-10T18:07:00Z",
        latitude: -22.9,
        longitude: -47.06,
        accuracy: 10,
        batteryLevel: 56,
        networkOperatorName: "Operadora",
      },
      "uuid-funcionario",
    ),
    {
      auvo_user_id: 153005,
      funcionario_id: "uuid-funcionario",
      position_date: "2026-07-10T18:07:00.000Z",
      latitude: -22.9,
      longitude: -47.06,
      accuracy: 10,
      battery_level: 56,
      network_operator_name: "Operadora",
    },
  );
});

Deno.test("mapGps — opcionais ausentes viram null; funcionário desconhecido fica null", () => {
  assertEquals(
    mapGps({ userId: 1, positionDate: "2026-07-10T12:00:00Z", latitude: 0, longitude: 0 }, null),
    {
      auvo_user_id: 1,
      funcionario_id: null,
      position_date: "2026-07-10T12:00:00.000Z",
      latitude: 0,
      longitude: 0,
      accuracy: null,
      battery_level: null,
      network_operator_name: null,
    },
  );
});

Deno.test("mapGps — descarta posição sem campos obrigatórios ou com data inválida", () => {
  assertEquals(mapGps({ positionDate: "2026-07-10T12:00:00Z", latitude: 1, longitude: 1 }, null), null);
  assertEquals(mapGps({ userId: 1, latitude: 1, longitude: 1 }, null), null);
  assertEquals(mapGps({ userId: 1, positionDate: "data-invalida", latitude: 1, longitude: 1 }, null), null);
  assertEquals(mapGps({ userId: 1, positionDate: "2026-07-10T12:00:00Z", longitude: 1 }, null), null);
});
