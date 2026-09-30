type SheetJs = {
  read: (
    data: Uint8Array,
    options: { type: "array" },
  ) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: {
    sheet_to_json: (sheet: unknown, options: { header: 1; defval: string }) => unknown[];
    aoa_to_sheet: (rows: unknown[][]) => unknown;
    book_new: () => unknown;
    book_append_sheet: (workbook: unknown, sheet: unknown, nome: string) => void;
  };
  writeFile: (workbook: unknown, nomeArquivo: string) => void;
};

export async function carregarSheetJs(): Promise<SheetJs> {
  const win = window as typeof window & { XLSX?: SheetJs };
  if (!win.XLSX)
    await carregarScript(
      "sheetjs-cdn",
      "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
    );
  if (!win.XLSX) throw new Error("Não foi possível carregar o leitor de planilhas.");
  return win.XLSX;
}

export async function lerPlanilha(file: File): Promise<Record<string, unknown[][]>> {
  const XLSX = await carregarSheetJs();
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  return Object.fromEntries(
    workbook.SheetNames.map((nome) => [
      nome,
      XLSX.utils.sheet_to_json(workbook.Sheets[nome], { header: 1, defval: "" }) as unknown[][],
    ]),
  );
}

export async function baixarPlanilha(abas: Record<string, unknown[][]>, nomeArquivo: string) {
  const XLSX = await carregarSheetJs();
  const workbook = XLSX.utils.book_new();
  for (const [nome, linhas] of Object.entries(abas))
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(linhas), nome);
  XLSX.writeFile(workbook, nomeArquivo);
}

async function carregarScript(id: string, src: string): Promise<void> {
  if (document.getElementById(id)) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });
}
