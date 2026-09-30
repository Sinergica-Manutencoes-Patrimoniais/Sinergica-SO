import { Button, Modal } from "@sinergica/ui";
import { useState } from "react";
import { lerPlanilha } from "../../../lib/sheetjs";
import {
  type EstadoEstrutura,
  type PlanoImportacao,
  parsearPlanilhaEstrutura,
  planejarImportacao,
} from "../domain/importacao-estrutura";

export function ImportacaoEstruturaModal({
  estado,
  onClose,
}: { estado: EstadoEstrutura; onClose: () => void }) {
  const [plano, setPlano] = useState<PlanoImportacao | null>(null);
  const [errosGerais, setErrosGerais] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  async function importar(file: File | undefined) {
    if (!file || !/\.xlsx?$/i.test(file.name)) {
      setErro("Arquivo inválido. Use a planilha exportada pelo SO.");
      return;
    }
    try {
      setErro(null);
      const lida = parsearPlanilhaEstrutura(await lerPlanilha(file));
      setErrosGerais(lida.errosGerais);
      setPlano(planejarImportacao(lida.linhas, estado));
    } catch (causa) {
      setErro(
        causa instanceof Error ? causa.message : "Não foi possível carregar o leitor de planilhas.",
      );
    }
  }
  const bloqueado = errosGerais.length > 0 || plano?.temErros || !plano?.alteracoes;
  return (
    <Modal open onOpenChange={(aberto) => !aberto && onClose()} titulo="Importar estrutura">
      <div className="flex flex-col gap-4">
        <p className="text-body text-ink-3">
          A importação primeiro simula. Nenhum dado é gravado nesta etapa.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => void importar(e.target.files?.[0])}
        />
        {erro && <p className="text-danger">{erro}</p>}
        {errosGerais.map((mensagem) => (
          <p key={mensagem} className="text-danger">
            {mensagem}
          </p>
        ))}
        {plano && (
          <>
            <p className="text-body font-semibold">
              {plano.alteracoes} alterações ·{" "}
              {plano.resultados.filter((r) => r.resultado === "ERRO").length} erros
            </p>
            <div className="max-h-64 overflow-auto">
              {plano.resultados.map((r) => (
                <p
                  key={`${r.linha.aba}-${r.linha.numero}`}
                  className={r.resultado === "ERRO" ? "text-danger" : "text-ink-2"}
                >
                  {r.linha.aba} linha {r.linha.numero}: {r.resultado} {r.detalhes.join(" ")}
                </p>
              ))}
            </div>
            <Button
              disabled={Boolean(bloqueado)}
              title={bloqueado ? "Corrija os erros na planilha e importe de novo." : undefined}
            >
              Executar
            </Button>
          </>
        )}
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Modal>
  );
}
