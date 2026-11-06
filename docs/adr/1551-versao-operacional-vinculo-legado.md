# ADR-1551 — Versão operacional em vínculos legados novos

Status: proposto; sujeito a testes e revisão. Novos comandos de materialização e vínculo legado devem validar Rotina, questionário e fuso da versão operacional determinada pelo accessor 1687. A escolha é obtida depois do lock do Plano e somente após verificar replay; nenhuma versão ou ocorrência histórica é reescrita. Data e identidade originais do ciclo são preservadas, assim como todos os gates, a autorização e a guarda 1045. A ocorrência legada deve existir ou ser materializada somente pelos comandos existentes e suas condições; não é permitido inventar vínculo ou OS.

O accessor não comprova isoladamente a execução externa; selagem 1691, cobertura histórica por OS, fonte de feriados e concorrência exigem validação. Não habilitar gates nem homologar apenas pela aplicação da migration.
