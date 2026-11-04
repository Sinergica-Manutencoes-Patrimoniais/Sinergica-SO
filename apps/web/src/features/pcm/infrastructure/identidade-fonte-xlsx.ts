/** Sem normalização: códigos e formas Unicode distintos permanecem distintos. */
export function codificarFonteXlsx(fonte: string): string {
  if (!fonte || fonte !== fonte.trim() || fonte.length > 188 || /[\u0000-\u001f\u007f-\u009f]/.test(fonte)) throw new Error("Fonte XLSX inválida.");
  try { return encodeURIComponent(fonte); } catch { throw new Error("Fonte XLSX inválida."); }
}
