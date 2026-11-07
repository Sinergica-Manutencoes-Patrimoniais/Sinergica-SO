// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SubstituicaoCodigoPublico } from './Substituicao';
const m = vi.hoisted(() => ({ getUser: vi.fn(), substituir: vi.fn(), autorizar: vi.fn() }));
vi.mock('../../../../app/auth-context', () => ({ useAuth: () => ({ user: { id: 'user-a', papel: 'superadmin' } }) }));
vi.mock('../../../../lib/supabase-client', () => ({ supabase: { auth: { getUser: m.getUser } } }));
vi.mock('../../infrastructure/supabase-capacidades-sso-adapter', () => ({ supabaseCapacidadesSsoAdapter: { autorizarAcao: m.autorizar } }));
vi.mock('../../infrastructure/supabase-codigos-publicos-adapter', () => ({ substituirCodigoPublico: m.substituir }));
beforeEach(() => { m.autorizar.mockResolvedValue(true); m.substituir.mockResolvedValue(undefined); m.getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null }); });
afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); });
async function preparar() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><SubstituicaoCodigoPublico userId="user-a" clienteId="cliente-a" tipo="sistema" ativoId="ativo-a" codigoAnterior="ANTIGO" /></QueryClientProvider>);
  fireEvent.change(await screen.findByLabelText(/Novo código/), { target: { value: 'NOVO' } });
  fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Correção' } });
  fireEvent.click(screen.getByLabelText(/Conferi o código atual/));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar substituição' }));
}
it('não envia se a sessão já mudou e preserva tentativa', async () => {
  m.getUser.mockResolvedValue({ data: { user: { id: 'user-b' } }, error: null });
  await preparar();
  expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();
  expect(m.substituir).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(1);
});
it('não descarta tentativa se sessão muda durante resposta', async () => {
  m.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-a' } }, error: null }).mockResolvedValueOnce({ data: { user: { id: 'user-b' } }, error: null });
  await preparar();
  await waitFor(() => expect(m.substituir).toHaveBeenCalledTimes(1));
  expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();
  expect(sessionStorage.length).toBe(1);
});
