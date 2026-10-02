import { Skeleton } from "@sinergica/ui";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { PreventivasWorkspace } from "../components/PreventivasWorkspace";

/** Tela global: o mesmo workspace usado pela Visão 360, sem filtro de cliente. */
export function PreventivasPage() {
  const { user } = useAuth();
  const { carregando, podeAcessar } = usePermissoes();
  const leitura = podeAcessar("pcm", "leitura");
  const escrita = podeAcessar("pcm", "escrita");

  if (carregando)
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-72" />
      </div>
    );
  if (!leitura)
    return <div className="p-12 text-center text-ink-3">Você não tem acesso às preventivas.</div>;
  if (!user) return null;
  return <PreventivasWorkspace temEscrita={escrita} userId={user.id} />;
}
