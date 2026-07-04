// AC-8: cliente inexistente ou soft-deleted. Estado claro, sem erro genérico/tela em branco e sem
// vazar detalhe de implementação (id, stack, mensagem de banco).
import { SearchX } from "lucide-react";

export function ClienteNaoEncontrado() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center p-12">
      <div className="w-16 h-16 rounded-2xl bg-line flex items-center justify-center">
        <SearchX className="w-8 h-8 text-ink-3" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-ink-2">Cliente não encontrado</h2>
        <p className="text-sm text-ink-3 mt-1 max-w-sm">
          Não foi possível localizar este cliente. Ele pode ter sido removido ou o endereço está
          incorreto.
        </p>
      </div>
    </div>
  );
}
