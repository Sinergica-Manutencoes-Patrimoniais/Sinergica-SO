import { expect, it } from "vitest";
import { converterHorarioLocal } from "./horario-local";

it.skipIf(Intl.DateTimeFormat().resolvedOptions().timeZone !== "America/New_York")("recusa hora repetida e aceita horários ao redor da transição", () => {
  expect(converterHorarioLocal("2026-11-01T00:30")).toBe("2026-11-01T04:30:00.000Z");
  expect(() => converterHorarioLocal("2026-11-01T01:30")).toThrow(/ambíguo/i);
  expect(converterHorarioLocal("2026-11-01T02:30")).toBe("2026-11-01T07:30:00.000Z");
});

it.skipIf(Intl.DateTimeFormat().resolvedOptions().timeZone !== "Australia/Lord_Howe")("detecta repetição de meia hora", () => {
  expect(() => converterHorarioLocal("2026-04-05T01:45")).toThrow(/ambíguo/i);
  expect(converterHorarioLocal("2026-04-05T02:30")).toBe("2026-04-04T16:00:00.000Z");
});
