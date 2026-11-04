# ADR-1032 — Coordenação da triagem e recepção do envelope

Status: preparação local; sem testes, revisão ou liberação.

A recepção manual exige indicação de Cliente compatível e mantém trava exclusiva no envelope durante a transação. Uma vez associado um lote, alterações ou exclusão da indicação exigem reconciliação própria, ainda não implementada. Resoluções posteriores devem preservar o Cliente e a OS vinculados. Triggers coordenam pelo envelope e aplicam guardas também a escritores indiretos; não afirmam autenticidade da origem nem substituem autorização.

A ordem de locks deve ser comprovada com todos os escritores e cenários de corrida, inclusive operações que já tenham travado a triagem, rollback, retry e resoluções anteriores. Antes de ativar, inventariar histórico, avaliar migração, RLS/FORCE e revisão adversarial. Não remover dados ou habilitar o gate para contornar conflitos; criar procedimento auditado de reconciliação quando necessário.
