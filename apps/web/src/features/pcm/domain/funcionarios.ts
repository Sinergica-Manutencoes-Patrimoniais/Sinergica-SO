export interface FuncionarioItem {
  id: string;
  nome: string;
  equipe: string | null;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  culture: string;
  userType: 1 | 2 | 3;
  ativo: boolean;
  auvoId: number | null;
  auvoSyncStatus: string | null;
  auvoSyncError: string | null;
  auvoSyncedAt: string | null;
}

export interface FuncionarioFormData {
  nome: string;
  equipe?: string | null;
  cargo?: string | null;
  telefone?: string | null;
  email?: string | null;
  culture: string;
  userType: 1 | 2 | 3;
}

export interface CriarFuncionarioFormData extends FuncionarioFormData {
  login: string;
  password: string;
}

export function validarFuncionario(input: FuncionarioFormData): FuncionarioFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório.");
  if (![1, 2, 3].includes(input.userType)) throw new Error("Tipo de usuário inválido.");
  return {
    nome,
    equipe: textoOuNull(input.equipe),
    cargo: textoOuNull(input.cargo),
    telefone: textoOuNull(input.telefone),
    email: textoOuNull(input.email),
    culture: input.culture.trim() || "pt-BR",
    userType: input.userType,
  };
}

export function validarCriacaoFuncionario(
  input: CriarFuncionarioFormData,
): CriarFuncionarioFormData {
  const base = validarFuncionario(input);
  const login = input.login.trim();
  const password = input.password.trim();
  if (!login) throw new Error("Login é obrigatório.");
  if (!password) throw new Error("Senha é obrigatória.");
  if (password.length > 14) throw new Error("Senha deve ter até 14 caracteres.");
  return { ...base, login, password };
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
