import { describe, expect, it, vi } from "vitest";
import { PREFERENCIA_LOCALIZACAO_PADRAO } from "../domain/localizacao-auvo";
import {
  obterPreferenciaLocalizacaoAuvo,
  salvarPreferenciaLocalizacaoAuvo,
} from "./localizacao-auvo";
import type { LocalizacaoAuvoGateway } from "./localizacao-auvo-gateway";

function gatewayFake(): LocalizacaoAuvoGateway {
  return {
    obterPreferencia: vi.fn(async () => PREFERENCIA_LOCALIZACAO_PADRAO),
    salvarPreferencia: vi.fn(async () => undefined),
  };
}

describe("localizacao-auvo (use case)", () => {
  it("repassa a leitura ao gateway", async () => {
    const gateway = gatewayFake();
    expect(await obterPreferenciaLocalizacaoAuvo(gateway)).toEqual(PREFERENCIA_LOCALIZACAO_PADRAO);
  });

  it("salva quando o separador não é vazio", async () => {
    const gateway = gatewayFake();
    const preferencia = { separador: " / ", ordem: "area_por_ultimo" as const };
    await salvarPreferenciaLocalizacaoAuvo(gateway, preferencia, "user-1");
    expect(gateway.salvarPreferencia).toHaveBeenCalledWith(preferencia, "user-1");
  });

  it("rejeita separador vazio antes de chamar o gateway", async () => {
    const gateway = gatewayFake();
    await expect(
      salvarPreferenciaLocalizacaoAuvo(
        gateway,
        { separador: "  ", ordem: "area_primeiro" },
        "user-1",
      ),
    ).rejects.toThrow(/Separador/);
    expect(gateway.salvarPreferencia).not.toHaveBeenCalled();
  });
});
