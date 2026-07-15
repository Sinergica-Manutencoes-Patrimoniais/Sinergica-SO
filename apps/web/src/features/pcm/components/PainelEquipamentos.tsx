// AC-6: painel condicional de equipamentos vinculados, com degradação graciosa. Três estados,
// NENHUM lança erro:
//   "indisponivel" → cache E01-S11 ausente/não consultável → placeholder "Integração indisponível"
//   []             → cliente sem equipamentos (ou auvo_id nulo) → "Sem equipamentos vinculados"
//   lista          → renderiza os equipamentos
// Técnicos ficam adiados (OPEN-QUESTION #1: schema atual não vincula técnico a cliente).
import type { ResultadoEquipamentos } from "../application/cliente-360-gateway";

export function PainelEquipamentos({ equipamentos }: { equipamentos: ResultadoEquipamentos }) {
  return (
    <div className="bg-card rounded-[10px] border border-line">
      <div className="px-5 py-4 border-b border-line-soft">
        <h3 className="text-sm font-semibold text-ink">Equipamentos vinculados</h3>
        <p className="text-xs text-ink-3 mt-0.5">Cache de campo (Auvo)</p>
      </div>

      {equipamentos === "indisponivel" ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-ink-3">Integração de campo indisponível</p>
          <p className="text-xs text-ink-3 mt-1">
            O cache de equipamentos ainda não está disponível nesta instalação.
          </p>
        </div>
      ) : equipamentos.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-ink-3">Sem equipamentos vinculados</div>
      ) : (
        <div className="divide-y divide-line-soft">
          {equipamentos.map((eq) => (
            <div key={eq.id} className="px-5 py-3 flex items-center gap-2">
              {eq.urlImagem ? (
                <img
                  src={eq.urlImagem}
                  alt={eq.nome}
                  className="h-8 w-8 shrink-0 rounded-[4px] border border-line object-cover"
                />
              ) : (
                <div className="h-8 w-8 shrink-0 rounded-[4px] border border-line bg-line-soft" />
              )}
              <span className="text-sm text-ink truncate">{eq.nome}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
