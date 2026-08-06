// E01-S122 — copy única para não confundir estado operacional, perfil e marcação livre.
export const TOOLTIP_CLIENTE = {
  status:
    "Status operacional: Ativo recebe atendimento; Inativo está fora do atendimento no momento.",
  tipo: "Tipo de cadastro: Cliente é atendido pela operação; Lead ainda está em prospecção.",
  statusComercial:
    "Status comercial acompanha o relacionamento comercial. Não é o status operacional nem um contrato.",
  marcacao:
    "Marcação é uma etiqueta livre, definida pela equipe para destacar uma condição. Ela não altera status, contrato ou atendimento.",
  auvo: "Identificador do cliente no Auvo, usado somente para rastrear a sincronização operacional.",
  incompleto:
    "Cadastro incompleto: faltam dados básicos para identificar ou atender este cliente com segurança.",
} as const;
