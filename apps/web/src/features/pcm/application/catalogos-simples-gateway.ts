import type {
  CatalogoSimplesFormData,
  CatalogoSimplesItem,
  CatalogoSimplesTipo,
} from "../domain/catalogos-simples";

export interface CatalogoSimplesCommand extends CatalogoSimplesFormData {
  tipo: CatalogoSimplesTipo;
  userId: string;
}

export interface EditarCatalogoSimplesCommand extends CatalogoSimplesCommand {
  id: string;
}

export interface ExcluirCatalogoSimplesCommand {
  tipo: CatalogoSimplesTipo;
  id: string;
  userId: string;
}

export interface CatalogosSimplesGateway {
  listar(tipo: CatalogoSimplesTipo): Promise<CatalogoSimplesItem[]>;
  criar(input: CatalogoSimplesCommand): Promise<CatalogoSimplesItem>;
  editar(input: EditarCatalogoSimplesCommand): Promise<CatalogoSimplesItem>;
  excluir(input: ExcluirCatalogoSimplesCommand): Promise<void>;
}
