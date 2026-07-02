import type { AuthGateway } from "./auth-gateway";

export async function signOut(gateway: AuthGateway): Promise<void> {
  await gateway.signOut();
}
