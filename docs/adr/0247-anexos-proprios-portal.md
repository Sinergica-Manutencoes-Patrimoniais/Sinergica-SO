---
name: "docs-adr-0247-anexos-proprios-portal-md"
description: "Documento Sinérgica SO: ADR-0247 — Leitura mediada de anexos próprios de OS"
alwaysApply: false
---

# ADR-0247 — Leitura mediada de anexos próprios de OS

**Estado:** preparação fechada, sem homologação nem implantação.

O Portal atual envia anexos de notas para `os-anexos`, mas a leitura das notas não traz caminho nem oferece download. Outros downloads existentes usam `inspecoes-midia` e `pmoc-laudos`; não migrá-los nesta fatia. Para evitar perder acesso do próprio remetente quando o bloqueio da ADR-0245 for ativado, uma consulta limitada lista anexos de notas enviadas pelo contato atual à OS da Conta; rota mediada exige o mesmo remetente como proprietário do objeto privado e retorna bytes sem URL. Objetos legados sem proprietário comprovável são omitidos. Não há compartilhamento automático com outros contatos nem publicação de anexo interno. Publicações revisadas de PCM continuam na rota da ADR-0239.

RPCs fechadas e flags desligadas. Garantir que a regra de acesso aos anexos do próprio remetente atende às permissões pretendidas para múltiplos contatos; arquivos sem nota íntegra, outros usos do bucket e acesso compartilhado seguem sem migração. Antes de ativar, revisar upload legado, autorização e revogação atuais, integridade, malware, URLs antigas, privacidade, concorrência, testes de Storage/Auth reais e revisão adversarial.
