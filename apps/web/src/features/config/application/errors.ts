export class NomeGrupoObrigatorioError extends Error {
  constructor() {
    super("Informe um nome para o grupo.");
    this.name = "NomeGrupoObrigatorioError";
  }
}

export class DadosUsuarioInvalidosError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "DadosUsuarioInvalidosError";
  }
}
