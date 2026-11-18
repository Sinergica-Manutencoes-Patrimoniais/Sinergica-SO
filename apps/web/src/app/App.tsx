import { Skeleton, ToastProvider, TooltipProvider } from "@sinergica/ui";
import { Suspense, lazy } from "react";
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

/**
 * E02-S42 — rota de prévia com dado SIMULADO (porte Evolution, E02-S41). `import.meta.env.DEV` é
 * substituído por uma constante no build (Vite); em produção vira `false` e o ramo morto é
 * removido ANTES do Rollup decidir chunks — o import dinâmico nunca é emitido no bundle de
 * produção. `scripts/check-sem-previa-em-producao.mjs` verifica isso de verdade (FR-003: falha se
 * a string da rota aparecer no build), não só confia no tree-shaking.
 */
const PreviewVisualS41 = import.meta.env.DEV
  ? lazy(() =>
      import("../features/atendimento/components/PreviewVisualS41").then((m) => ({
        default: m.PreviewVisualS41,
      })),
    )
  : null;

function TelaCarregando() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="text-center">
        <img
          src="/logos/logo-horizontal-positivo.png"
          alt="Sinérgica Manutenções Patrimoniais"
          className="mx-auto h-12 object-contain mb-4"
        />
        <Skeleton className="h-4 w-40" />
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
          <ToastProvider>
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
                  {/* TEMPORÁRIO (E02-S41): vitrine do restilo da bolha/fila para demo, sem
                      auth/backend. Só em DEV (E02-S42) — nunca entra no bundle de produção.
                      Remove de vez na troca de rota da tela nova (plan.md fase 4). */}
                  {PreviewVisualS41 && (
                    <Route
                      path="/preview-s41"
                      element={
                        <Suspense fallback={null}>
                          <PreviewVisualS41 />
                        </Suspense>
                      }
                    />
                  )}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </ToastProvider>
        </PermissoesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
