# ADR-1157 — Detalhe da exceção na reconciliação

Status: proposta local, não aplicada nem homologada.

A consulta de origem vinculada pode exibir motivo e descrição do evento histórico de material aos usuários autorizados de Visita e materiais. Os dados vêm do evento associado, não de texto fornecido pelo cliente. A referência não prova estado atual, disponibilidade ou conciliação remota. Se evento ou vínculo estiverem inconsistentes, a leitura deve falhar fechada.

Validar conteúdo e limites de dados legados, permissões e revogação, retenção de informações potencialmente sensíveis, lock concorrente, RLS/FORCE e revisão adversarial antes de ativar. Gates continuam fechados; nenhuma operação externa é executada.
