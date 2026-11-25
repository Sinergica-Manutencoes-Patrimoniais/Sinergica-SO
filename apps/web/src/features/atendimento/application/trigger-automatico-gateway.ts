import type { TriggerAutomaticoValidado } from "../domain/trigger-automatico";

export interface TriggerAutomaticoConfig extends TriggerAutomaticoValidado {
  personaId: string;
}

export interface TriggerAutomaticoGateway {
  obter(personaId: string): Promise<TriggerAutomaticoConfig>;
  salvar(input: TriggerAutomaticoConfig & { userId: string }): Promise<void>;
}
