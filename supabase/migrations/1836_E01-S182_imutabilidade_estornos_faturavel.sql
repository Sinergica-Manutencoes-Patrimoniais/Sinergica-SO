-- E01-S182 — correção encontrada ao escrever pgTAP de verdade pro estorno de alocação (0404):
-- `financeiro.sso_faturavel_estornos` é um registro financeiro de comando/decisão (quem estornou,
-- quanto, por quê) mas, diferente de toda tabela equivalente deste programa
-- (sso_dispensas_orcamento, sso_revogacoes_dispensa, sso_evidencias_ondas, etc.), nunca recebeu
-- trigger de imutabilidade. Sem isso, qualquer papel com privilégio direto na tabela poderia editar
-- ou apagar um estorno já registrado, quebrando o histórico contábil. Reusa o guard genérico já
-- usado por dezenas de outras tabelas desta sessão.
create trigger sso_faturavel_estornos_imutaveis before update or delete on financeiro.sso_faturavel_estornos
  for each row execute function pcm.sso_proteger_conferencia_levantamento();
