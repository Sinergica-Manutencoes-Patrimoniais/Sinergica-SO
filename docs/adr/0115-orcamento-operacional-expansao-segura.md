# ADR-0115 — Expansão sem emissão para vínculo operacional

## Estado

Proposta para E01-S181; não autoriza aplicação ou liberação. Complementa ADR-0103.

## Decisão

A primeira expansão cria apenas vínculo privado entre uma proposta Comercial existente, sua OS e lista canônica. Não cria proposta, oportunidade, orçamento PCM, versão, decisão ou cobrança. A origem continua obrigatoriamente uma oportunidade comercial real até todos os consumidores e políticas serem adaptados. O vínculo não concede acesso a custos, e não permite gravação direta por papéis de aplicação. É fundação para posterior comando transacional, não um fluxo de criação funcional.

Consulta administrativa deve obter Cliente da oportunidade e verificar a mesma Conta na OS e lista, inclusive vínculo lista/OS, OS ativa e acesso atual às ações `material.gerir` e `custo.ler`. Diante de referência removida, mudança de Conta ou inconsistência, falhar fechado. A projeção devolve somente identificação, situação e versão, sem preço ou custos. Não expor ao Portal.

## Gates

Antes de adicionar qualquer gravação: corrigir e provar isolamento dos caminhos existentes de proposta, opportunity e assessment; definir proteção contra mudança concorrente de Cliente/OS/lista; implementar requestId, revisão, auditoria, congelamento de snapshot e reuso do motor Comercial; adaptar projeção pública, aprovação e piso. A restrição de oportunidade não pode ser relaxada antes de inventário e adaptação dos consumidores. Exige pgTAP de permissões, concorrência, cross-tenant, CI e revisão adversarial. Nunca aplicar sem esses gates.

## Protótipo de comando fechado

A migration 0339 prepara comando para vincular proposta real em rascunho e salvar composição única de fornecimento por lista, sem criar oportunidade, OS ou cobrança. Não concede EXECUTE a nenhum papel de aplicação: os grants e RLS legados permitem acesso direto e devem ser revistos antes de qualquer habilitação. Comando deriva Cliente, exige revisão da proposta e lista, usa motor e piso Comercial e registra idempotência/auditoria. Proteção de custo e autorização concorrente não estão comprovadas; esta preparação não substitui o gate anterior.
