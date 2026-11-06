# ADR-1550 — Pendência de ocorrência preparada nativa

Uma OS de Chamado preventivo nativo pode ter origem em ocorrência preparada sem possuir ocorrência legada. A pendência deve referenciar a identidade existente, sem criar uma entidade legada fictícia.

Adicionar duas referências opcionais distintas para calendário e Visita e exigir exatamente uma das quatro origens: legada, Grupo, preparada calendário ou preparada Visita. Para origem nativa não Grupo, o comando exige fotografia imutável da OS e valida Cliente, Plano, preparada, versão, Rotina, alvo e snapshot; a fotografia de impacto passa a incluir essas pendências. Fontes anteriores, IDs e RLS permanecem. Nenhuma OS é alterada e a guarda 1045 permanece.

Migrar após 1689 e validar DDL com dados antigos, retorno aprovado, ambos os modos, Grupo/legado, atualização de versão, autorização, identidade/Cliente, concorrência, replay e consumidores. Não habilitar antes de revisão adversarial. A reversão exige restaurar leitores e só pode retirar colunas novas após migrar ou preservar todos os registros que as usam; nunca apagar pendências.
