import { Button, ConfirmDialog, Modal } from "@sinergica/ui";
import { useState } from "react";
import { baixarPlanilha, lerPlanilha } from "../../../lib/sheetjs";
import type { RelatorioImportacao } from "../application/importacao-estrutura";
import {
  CABECALHOS,
  type EstadoEstrutura,
  type PlanoImportacao,
  parsearPlanilhaEstrutura,
  planejarImportacao,
} from "../domain/importacao-estrutura";

export function ImportacaoEstruturaModal({
  estado,
  onClose,
  onExecutar,
}: {
  estado: EstadoEstrutura;
  onClose: () => void;
  onExecutar: (
    plano: PlanoImportacao,
    onProgresso: (atual: number, total: number) => void,
  ) => Promise<RelatorioImportacao[]>;
}) {
  const [plano, setPlano] = useState<PlanoImportacao | null>(null);
  const [abas, setAbas] = useState<Record<string, unknown[][]> | null>(null);
  const [errosGerais, setErrosGerais] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioImportacao[] | null>(null);

  async function importar(file: File | undefined) {
    if (!file || !/\.xlsx?$/i.test(file.name)) {
      setErro("Arquivo inválido. Use a planilha exportada pelo SO.");
      return;
    }
    try {
      setErro(null);
      setRelatorio(null);
      const planilha = await lerPlanilha(file);
      const lida = parsearPlanilhaEstrutura(planilha);
      setAbas(planilha);
      setErrosGerais(lida.errosGerais);
      setPlano(planejarImportacao(lida.linhas, estado));
    } catch (causa) {
      setErro(
        causa instanceof Error ? causa.message : "Não foi possível carregar o leitor de planilhas.",
      );
    }
  }
  async function executar() {
    if (!plano) return;
    setConfirmando(false);
    setProgresso({ atual: 0, total: plano.alteracoes });
    try {
      setRelatorio(await onExecutar(plano, (atual, total) => setProgresso({ atual, total })));
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível executar a importação.");
    } finally {
      setProgresso(null);
    }
  }
  async function baixarRelatorio() {
    if (!abas || !relatorio) return;
    const porLinha = new Map(relatorio.map((linha) => [linha.numero, linha]));
    const relatorioAbas = Object.fromEntries(
      Object.entries(CABECALHOS).map(([aba, cabecalhos]) => {
        const original = abas[aba] ?? [];
        return [
          aba,
          [
            [...cabecalhos, "Resultado"],
            ...original.slice(1).map((linha, indice) => {
              const resultado = porLinha.get(indice + 2);
              return [...linha, resultado ? `${resultado.status}: ${resultado.mensagem}` : ""];
            }),
          ],
        ];
      }),
    );
    await baixarPlanilha(relatorioAbas, "relatorio-importacao-estrutura.xlsx");
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
              {plano.resumo.CRIAR} criar · {plano.resumo.EDITAR} editar · {plano.resumo.EXCLUIR}{" "}
              excluir · {plano.resumo.ERRO} erros · {plano.resumo.AVISO} avisos
            </p>
            <div className="max-h-64 overflow-auto">
              {plano.resultados.map((resultado) => (
                <p
                  key={`${resultado.linha.aba}-${resultado.linha.numero}`}
                  className={resultado.resultado === "ERRO" ? "text-danger" : "text-ink-2"}
                >
                  {resultado.linha.aba} linha {resultado.linha.numero}: {resultado.resultado}{" "}
                  {resultado.detalhes.join(" ")}
                </p>
              ))}
            </div>
            {progresso && (
              <p className="text-body">
                Aplicando {progresso.atual} de {progresso.total}
              </p>
            )}
            {relatorio ? (
              <>
                <div className="max-h-40 overflow-auto">
                  {relatorio.map((linha) => (
                    <p key={linha.numero} className="text-ink-2">
                      Linha {linha.numero}: {linha.status} — {linha.mensagem}
                    </p>
                  ))}
                </div>
                <Button variant="secondary" onClick={() => void baixarRelatorio()}>
                  Baixar relatório
                </Button>
              </>
            ) : (
              <Button
                disabled={Boolean(bloqueado) || Boolean(progresso)}
                title={bloqueado ? "Corrija os erros na planilha e importe de novo." : undefined}
                onClick={() => setConfirmando(true)}
              >
                Executar
              </Button>
            )}
          </>
        )}
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      </div>
      <ConfirmDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        titulo="Aplicar importação"
        descricao={`Aplicar ${plano?.alteracoes ?? 0} alterações? Elas também serão enviadas ao Auvo.`}
        rotuloConfirmar="Aplicar"
        onConfirmar={executar}
      />
    </Modal>
  );
}
