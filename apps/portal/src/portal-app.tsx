import { Button } from "@sinergica/ui";
import { BrowserRouter } from "react-router";
import { AuthProvider, useAuth } from "../../web/src/app/auth-context";
import { ThemeProvider } from "../../web/src/app/theme-context";
import { PortalShell } from "../../web/src/features/area-cliente/PortalShell";
import { LoginPage } from "../../web/src/features/auth/pages/LoginPage";

function Entrada() {
  const { user, status, logout } = useAuth();
  if (status === "carregando")
    return (
      <div className="grid min-h-screen place-items-center bg-paper text-sm text-ink-3">
        Carregando sessão…
      </div>
    );
  if (!user) return <LoginPage />;
  if (user.papel !== "cliente-sindico")
    return (
      <div className="grid min-h-screen place-items-center bg-paper p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold">Acesso exclusivo do cliente</h1>
          <p className="mt-2 text-sm text-ink-3">Use o sistema interno para este perfil.</p>
          <Button
            variant="ghost"
            onClick={logout}
            className="mt-4 text-orange hover:text-orange-deep"
          >
            Sair
          </Button>
        </div>
      </div>
    );
  return <PortalShell />;
}

export function PortalApp() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Entrada />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
