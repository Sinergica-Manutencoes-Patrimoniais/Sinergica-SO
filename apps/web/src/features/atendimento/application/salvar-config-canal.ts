import { validarConfigCanal } from "../domain/config-canal";
import type { ConfigGateway, SalvarConfigCanalCommand } from "./config-gateway";

export function salvarConfigCanal(gateway: ConfigGateway, input: SalvarConfigCanalCommand) {
  const validado = validarConfigCanal(input);
  return gateway.salvarConfigCanal({ ...validado, userId: input.userId });
}
