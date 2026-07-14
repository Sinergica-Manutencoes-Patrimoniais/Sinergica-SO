import { Plus } from "lucide-react";
import { useState } from "react";
import { Card, PageHeader } from "./MockUi";

const ENTRADAS = [
  "Receita de contrato",
  "Serviços avulsos",
  "Laudos e inspeções",
  "Outras receitas",
];

const SAIDAS = [
  { pai: "Pessoal", filhos: ["Salários", "Encargos", "Benefícios", "Pró-labore"] },
  {
    pai: "Operação",
    filhos: ["Combustível", "Peças e materiais", "EPI", "Ferramentas", "Terceiros"],
  },
  { pai: "Veículos", filhos: ["Manutenção", "Seguro/IPVA"] },
  {
    pai: "Administrativo",
    filhos: ["Aluguel", "Contas de consumo", "Software e assinaturas", "Contabilidade"],
  },
  { pai: "Impostos e taxas", filhos: [] as string[] },
  { pai: "Tarifas e juros bancários", filhos: [] as string[] },
];

export function CategoriasMock() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Categorias"
        subtitle="Plano de contas — 2 níveis, editável."
        actions={
          <button type="button" className="btn-accent">
            <Plus className="h-4 w-4" />
            Nova categoria
          </button>
        }
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Card title="Entrada">
          <ul>
            {ENTRADAS.map((n) => (
              <ParentRow key={n} nome={n} />
            ))}
          </ul>
        </Card>
        <Card title="Saída">
          <ul>
            {SAIDAS.map((g) => (
              <li key={g.pai}>
                <ParentRow nome={g.pai} />
                {g.filhos.map((f) => (
                  <ChildRow key={f} nome={f} />
                ))}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function ParentRow({ nome }: { nome: string }) {
  return (
    <li className="flex items-center justify-between border-b border-line-soft py-2.5 last:border-0">
      <span className="text-sm font-semibold text-ink">{nome}</span>
      <Switch />
    </li>
  );
}

function ChildRow({ nome }: { nome: string }) {
  return (
    <li className="flex items-center justify-between border-b border-line-soft py-2 pl-4 last:border-0">
      <span className="text-xs text-ink-2">{nome}</span>
      <Switch />
    </li>
  );
}

function Switch() {
  const [on, setOn] = useState(true);
  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      aria-pressed={on}
      aria-label="Ativo"
      className={`relative h-[17px] w-[30px] shrink-0 rounded-full border transition-colors ${
        on ? "border-orange-deep/40 bg-orange-soft" : "border-line bg-line-soft"
      }`}
    >
      <span
        className={`absolute top-[1px] h-[13px] w-[13px] rounded-full transition-transform ${
          on ? "translate-x-[14px] bg-orange" : "translate-x-[1px] bg-ink-3"
        }`}
      />
    </button>
  );
}
