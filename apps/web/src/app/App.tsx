import { TooltipProvider } from "@sinergica/ui";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { PortalShell } from "../features/area-cliente/PortalShell";
import { deveUsarPortal } from "../features/area-cliente/domain/roteamento";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { UiGaleriaPage } from "../features/guia/UiGaleriaPage";
import { HomePage } from "./HomePage";
import { AuthProvider, useAuth } from "./auth-context";
import { NavGuardProvider } from "./nav-guard-context";
import { PermissoesProvider } from "./permissoes-context";
import { ThemeProvider } from "./theme-context";

function TelaCarregando() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="text-center">
        <img
          src="/logos/logo-horizontal-positivo.png"
          alt="Sinérgica Manutenções Patrimoniais"
          className="mx-auto h-12 object-contain mb-4"
        />
        <p className="text-sm text-ink-3">Carregando sessão...</p>
      </div>
    </div>
  );
}

// Enquanto a sessão está "carregando" (restauração assíncrona via Supabase Auth), nenhuma das
// duas rotas decide nada ainda — evita tanto o "flash" de tela protegida quanto redirect
// prematuro para /login com uma sessão que na verdade é válida (AC-7).
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  if (status === "carregando") return <TelaCarregando />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  if (status === "carregando") return <TelaCarregando />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function EntradaAutenticada() {
  const { user } = useAuth();
  return user && deveUsarPortal(user.papel) ? (
    <PortalShell />
  ) : (
    <NavGuardProvider>
      <HomePage />
    </NavGuardProvider>
  );
}

// E00-S15 AC-10 — galeria de primitivas, gate visual antes de qualquer PR de UI. Só em dev ou
// pra `superadmin` em produção (não é conteúdo de negócio, mas também não é público).
function GaleriaUiProtegida() {
  const { user } = useAuth();
  if (!import.meta.env.DEV && user?.papel !== "superadmin") return <Navigate to="/" replace />;
  return <UiGaleriaPage />;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PermissoesProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Routes>
                <Route
                  path="/login"
                  element={
                    <PublicOnly>
                      <LoginPage />
                    </PublicOnly>
                  }
                />
                <Route
                  path="/"
                  element={
                    <RequireAuth>
                      <EntradaAutenticada />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/ui"
                  element={
                    <RequireAuth>
                      <GaleriaUiProtegida />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </PermissoesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
