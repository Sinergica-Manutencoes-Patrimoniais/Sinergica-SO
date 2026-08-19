import { Button } from "@sinergica/ui";
import { Upload } from "lucide-react";
import { PageHeader, TableShell } from "./MockUi";
import { OFX_ROWS, brl, dataCurta } from "./mock-data";

export function ImportOfxMock() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Importar extrato (OFX)"
        subtitle="Upload → prévia → classificação sugerida → conciliar ou criar."
      />
      <div className="surface-card flex flex-col items-center gap-2 border-dashed p-8 text-center">
        <Upload className="h-6 w-6 text-ink-3" />
        <p className="text-body font-semibold text-ink">extrato-itau-julho.ofx</p>
        <p className="text-caption text-ink-3">
          arraste um arquivo .ofx aqui ou clique para selecionar
        </p>
      </div>
      <div className="flex gap-4 text-caption text-ink-2">
        <span>
          <b className="text-ink">{OFX_ROWS.length}</b> transações lidas
        </span>
        <span>
          <b className="text-ink">3</b> novas
        </span>
        <span>
          <b className="text-ink">2</b> já importadas (ignoradas)
        </span>
      </div>
      <TableShell
        head={
          <>
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Descrição (extrato)</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3">Sugestão</th>
            <th className="px-4 py-3">Ação</th>
          </>
        }
      >
        {OFX_ROWS.map((r) => (
          <tr key={r.memo}>
            <td className="px-4 py-3 text-ink-3">{dataCurta(r.data)}</td>
            <td className="px-4 py-3 font-mono text-caption text-ink-2">{r.memo}</td>
            <td
              className={`px-4 py-3 text-right tabular-nums font-semibold ${r.valor > 0 ? "text-success" : "text-ink"}`}
            >
              {brl(r.valor)}
            </td>
            <td className="px-4 py-3">
              <span className="inline-flex rounded-full bg-orange-soft px-2 py-0.5 text-micro font-semibold text-orange-deep">
                {r.sugestao}
              </span>
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm">
                  Conciliar
                </Button>
                <Button variant="secondary" size="sm">
                  Ignorar
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}
