# ADR-0191 — Histórico privado de comprovantes de despesa

**Estado:** proposta preparatória, não homologada nem implantada.

A consulta de histórico lista revisão, valor, data e autor sem expor caminho ou URL. Download identifica despesa e revisão; RPC confere autorização atual da Conta, vínculo da revisão ao objeto e bucket privado. Uma Edge Function autenticada obtém o arquivo por credencial de servidor, revalida antes da resposta e registra acesso auditado, retornando bytes como anexo sem URL assinada. Comprovante original e versões posteriores continuam preservados. A resposta usa cache privado desativado e limite de tamanho.

RPCs permanecem revogadas e interface desligada. Antes de habilitar, revisar isolamento de Conta e ação, expiração/revogação concorrente, segurança e integridade de objetos, rate limit, remediação de uploads órfãos, retenção, cache, auditoria e políticas Storage legadas, além de testes integrados e revisão adversarial. O registro de acesso não garante retenção do arquivo nem corrige URLs eventualmente existentes.
