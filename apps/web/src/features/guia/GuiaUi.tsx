import type { ReactNode } from "react";

/** Blocos de leitura do Guia do SO — conteúdo estático (sem domínio/backend), estilizado com os
 * mesmos tokens do resto do app (index.css) pra parecer parte do sistema, não um doc à parte. */

export function GuiaTitulo({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div className="page-header">
      <div>
        <h2 className="page-title">{titulo}</h2>
        <p className="page-subtitle">{subtitulo}</p>
      </div>
    </div>
  );
}

const STATUS_CLASS: Record<string, string> = {
  real: "bg-[#E7F6EC] text-[#1E8E45] dark:bg-[#12301E] dark:text-[#6FCB8E]",
  prototipo: "bg-orange-soft text-orange-deep",
  planejado: "bg-line-soft text-ink-2",
};

const STATUS_LABEL: Record<string, string> = {
  real: "Em uso — dado real",
  prototipo: "Protótipo navegável — dado fictício",
  planejado: "Planejado — ainda não construído",
};

export function StatusModulo({ status }: { status: "real" | "prototipo" | "planejado" }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="surface-card p-5">
      <h3 className="mb-2.5 text-sm font-semibold text-ink">{titulo}</h3>
      <div className="flex flex-col gap-2.5 text-sm leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

export function ListaFuncoes({ itens }: { itens: Array<{ nome: string; descricao: string }> }) {
  return (
    <ul className="flex flex-col gap-3">
      {itens.map((item) => (
        <li key={item.nome} className="border-b border-line-soft pb-3 last:border-0 last:pb-0">
          <p className="text-sm font-semibold text-ink">{item.nome}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{item.descricao}</p>
        </li>
      ))}
    </ul>
  );
}

export function Callout({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-[8px] border border-orange-deep/25 bg-orange-soft/60 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-orange-deep">{titulo}</p>
      <div className="mt-1.5 flex flex-col gap-2 text-sm leading-relaxed text-ink-2">
        {children}
      </div>
    </div>
  );
}
