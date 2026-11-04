# ADR-0384 — Vínculo explícito da OS à Rotina versionada

Status: proposta; gate fechado, testes e revisão pendentes.

O PCM pode registrar vínculo explícito somente quando a cadeia já existente OS → ocorrência legada → ocorrência preparada → versão aprovada de Plano comprovar Conta, Rotina e alvo; o snapshot da versão aprovada deve conter exatamente uma Rotina correspondente e alvo idêntico. Não se cria ocorrência, não se altera vínculo legado nem se envia tarefa. O vínculo e a prova histórica são imutáveis; indisponibilidade ou divergência é bloqueio, não inferência. Esta fatia não comprova a cobertura do escopo, do questionário ou da equipe e não libera a revisão integral da OS. Revalidar alterações concorrentes, permissões e reconciliação antes de ativar.
