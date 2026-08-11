/** Porta do motor de precificação (E03-S03). Gateway próprio, separado de `ComercialGateway` —
 * story-ilha, tabelas próprias, sem FK para oportunidade/proposta. */

import type { OrigemCustoMo } from "../domain/precificacao";

export interface ParametrosPreco {
  margemAlvoPct: number;
  overheadPct: number;
  beneficiosPct: number;
  suportePct: number;
  veiculoMensalCentavos: number;
  markupMaterialPadraoPct: number;
  moIncluiInssPatronal: boolean;
}

export interface EditarParametrosPrecoCommand extends Partial<ParametrosPreco> {}

export interface NivelTecnico {
  id: string;
  nome: string;
  custoMensalReferenciaCentavos: number;
  horasMesReferencia: number;
  cargoPcm: string | null;
  ativo: boolean;
}

export interface NivelTecnicoCommand {
  nome: string;
  custoMensalReferenciaCentavos: number;
  horasMesReferencia?: number;
  cargoPcm?: string | null;
}

export interface EditarNivelTecnicoCommand extends Partial<NivelTecnicoCommand> {
  id: string;
  ativo?: boolean;
}

export interface Material {
  id: string;
  nome: string;
  unidade: string;
  custoReferenciaCentavos: number;
  markupPct: number | null;
  ativo: boolean;
}

export interface MaterialCommand {
  nome: string;
  unidade: string;
  custoReferenciaCentavos: number;
  markupPct?: number | null;
}

export interface EditarMaterialCommand extends Partial<MaterialCommand> {
  id: string;
  ativo?: boolean;
}

/** Custo/hora de um nível já resolvido (Financeiro ou fallback) — a origem viaja até a UI (AC-4). */
export interface CustoHoraNivel {
  nivelId: string;
  custoHoraCentavos: number;
  origem: OrigemCustoMo;
}

export interface AliquotaVigente {
  aliquotaEfetiva: number;
  tipo: "fixa" | "faixa_rbt12";
  /** `false` = configuração ainda no seed, nunca confirmada por um humano (AC-6). */
  confirmada: boolean;
}

export interface PrecificacaoGateway {
  obterParametros(): Promise<ParametrosPreco>;
  editarParametros(input: EditarParametrosPrecoCommand): Promise<ParametrosPreco>;

  listarNiveisTecnico(): Promise<NivelTecnico[]>;
  criarNivelTecnico(input: NivelTecnicoCommand): Promise<NivelTecnico>;
  editarNivelTecnico(input: EditarNivelTecnicoCommand): Promise<NivelTecnico>;
  /** Cargos distintos de `pcm.funcionarios` — a UI oferece como lista, nunca campo livre (grafia
   * inconsistente em produção: "Oficial de Manutenção" × "Of. de Manutenção"). */
  listarCargosPcm(): Promise<string[]>;

  listarMateriais(): Promise<Material[]>;
  criarMaterial(input: MaterialCommand): Promise<Material>;
  editarMaterial(input: EditarMaterialCommand): Promise<Material>;

  /** AC-3/AC-4: custo/hora médio do cargo mapeado ao nível, via RPC do Financeiro (R2) — `null`
   * de origem quando não há `cargoPcm` definido (nunca chama a RPC à toa). */
  obterCustoHoraNivel(nivel: NivelTecnico): Promise<CustoHoraNivel>;
  /** AC-5/AC-6: alíquota efetiva vigente, com origem e sinal de confirmação. */
  obterAliquotaVigente(): Promise<AliquotaVigente>;
}
