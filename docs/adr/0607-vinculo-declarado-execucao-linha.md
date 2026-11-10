---
name: "docs-adr-0607-vinculo-declarado-execucao-linha-md"
description: "Documento Sinérgica SO: ADR-0607 — Vínculo declarado entre resposta e linha aceita"
alwaysApply: false
---

# ADR-0607 — Vínculo declarado entre resposta e linha aceita

Status: preparado, não aplicado nem validado. Gate fechado.

Registra-se vínculo humano imutável entre snapshot de serviço extra aceito e uma resposta com evidência declarada do retorno da mesma OS e Cliente. A identidade da resposta e a declaração são únicas nesse registro; quantidade é a do snapshot. A proposta e versão devem estar aceitas e vigentes, em modo linhas, com quantidade coordenada. Autorização e motivo são obrigatórios.

O vínculo é uma afirmação humana: o registro 0533 expressamente não autentica evidência nem comprova execução. Sua existência não identifica necessariamente um evento único real nem prova classificação da linha ou ausência de duplicidade entre outras origens. Não cria nem libera candidato, cobrança, lançamento ou integração externa. Conserva-se o bloqueio do ADR-0603.

Antes de ativar: revisar ordenação de locks e todos os escritores, migrações e permissões; testar concorrência, revogação de acesso, retries e isolamento entre Clientes. Não ativa gates dependentes.
