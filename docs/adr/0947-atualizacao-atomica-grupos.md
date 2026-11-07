---
name: "docs-adr-0947-atualizacao-atomica-grupos-md"
description: "Documento Sinérgica SO: ADR-0947 — Atualização atômica de grupos e módulos"
alwaysApply: false
---

# ADR-0947 — Atualização atômica de grupos e módulos

Status: preparação local, não homologada; pré-requisito para avaliar ADR-0946.

## Contexto e decisão

O editor legado atualiza grupo, apaga permissões e reinsere permissões em requisições independentes. Uma falha na última etapa pode deixar acesso parcial. Preparar comando transacional com validação explícita de campos e matriz de módulos, sem substituir as policies existentes. Sob a trava compartilhada pelos escritores de autorização, ambos os comandos verificam usuário ativo e papel atual; edição compara o estado observado ao abrir o formulário com o estado atual sob trava. Divergência retorna conflito e preserva dados digitados. As funções executam com privilégios do chamador, respeitam RLS e conservam as regras atuais; qualquer erro reverte grupo e módulos juntos. Não alteram o significado das permissões nem concedem novos acessos.

## Limites e implantação

As funções ficam sem EXECUTE para papéis da aplicação; o adapter preparado permanece atrás de flag desligada. Criação e módulos passam a compartilhar transação; a ADR-0948 prepara repetição da mesma tentativa após resposta incerta, sem autorizar repetição cega. RLS legada baseada em claims não comprova revogação imediata; autorização atual, edições concorrentes, recuperação da resposta e histórico exigem validação. Antes de habilitar, testar rollback após exclusão/antes da inserção, transações concorrentes, perfis permitidos e negados, dados legados, resposta perdida e interação com 0319/1099; revisar adversarialmente. Não ativar 1099 isoladamente sobre fluxos não atômicos.
