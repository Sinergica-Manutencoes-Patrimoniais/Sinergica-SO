// Grid de 9 módulos × 3 estados (nenhum/leitura/escrita), reaproveitado por GruposPage e
// UsuariosPage. Labels espelham HomePage.tsx (MODULOS) — duplicadas aqui de propósito: extrair
// pra um pacote compartilhado só pra 9 strings seria over-engineering nesta story.
import { MODULOS_PERMISSIONAVEIS } from "../domain/modulo";
import type { ModuloId, NivelAcesso } from "../domain/modulo";

const MODULO_LABELS: Record<ModuloId, string> = {
  pcm: "PCM · Operação",
  atendimento: "Atendimento · Zé",
  comercial: "Comercial",
  financeiro: "Financeiro",
  operacao: "Estoque",
  marketing: "Marketing",
  growth: "Growth",
  gestao: "Cockpit",
  "area-cliente": "Área do Cliente",
};

const OPCOES: ReadonlyArray<{ nivel: NivelAcesso | null; label: string }> = [
  { nivel: null, label: "Nenhum" },
  { nivel: "leitura", label: "Leitura" },
  { nivel: "escrita", label: "Escrita" },
];

interface ModuloPermissaoGridProps {
  permissoes: Partial<Record<ModuloId, NivelAcesso>>;
  onChange: (modulo: ModuloId, nivel: NivelAcesso | null) => void;
  disabled?: boolean;
}

export function ModuloPermissaoGrid({ permissoes, onChange, disabled }: ModuloPermissaoGridProps) {
  return (
    <div className="border border-line rounded-[10px] overflow-hidden divide-y divide-line-soft">
      {MODULOS_PERMISSIONAVEIS.map((modulo) => {
        const atual = permissoes[modulo] ?? null;
        return (
          <div key={modulo} className="flex items-center justify-between gap-3 px-4 py-2.5 bg-card">
            <span className="text-sm text-ink-2">{MODULO_LABELS[modulo]}</span>
            <div className="flex items-center gap-1">
              {OPCOES.map((opcao) => {
                const ativo = atual === opcao.nivel;
                return (
                  <button
                    key={opcao.label}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(modulo, opcao.nivel)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      ativo ? "bg-orange text-white" : "bg-line-soft text-ink-3 hover:text-ink"
                    }`}
                  >
                    {opcao.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
