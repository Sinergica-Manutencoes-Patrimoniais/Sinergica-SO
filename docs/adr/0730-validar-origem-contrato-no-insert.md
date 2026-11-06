# ADR-0730 — Validar origem do rascunho de contrato

**Status:** preparado para diagnóstico; não homologado nem implantado.

A RLS de Comercial permite INSERT direto de rascunho, mas não garante que a proposta esteja aceita e que o Cliente corresponda à oportunidade. Isso pode reservar a unicidade da proposta incorretamente. A validação de ativação não corrige o rascunho indevido. O escopo legado continua global por módulo; comparar Clientes preserva a integridade do vínculo, sem criar uma concessão por Cliente.

A migration 0955 acrescenta um gatilho `SECURITY DEFINER` de busca vazia, não executável diretamente, para inserções pelo papel autenticado. Ele valida a identidade e a escrita Comercial atual, trava em modo compartilhado a proposta e sua oportunidade, exige proposta aceita e não excluída e Cliente correspondente, e revalida a autorização após adquirir os bloqueios. A função não retorna dados ou custos. O caminho legítimo `fn_criar_contrato` continua `SECURITY INVOKER` e passa pela mesma validação, assim como INSERT direto autorizado. Serviço e processos privilegiados não passam a ser automaticamente autorizados; seus caminhos existentes e ACL requerem revisão própria.

## Implantação, limites e reverso

Não modificar, excluir ou corrigir dados legados automaticamente. O gatilho não substitui o inventário de rascunhos antigos nem uma política contra acesso privilegiado indevido. A reconsulta de permissão no mesmo comando não comprova ordenação serializável contra revogação concorrente; testar em duas sessões e definir coordenação antes de homologar. Testar concorrência com alterações/exclusão da proposta, autorização revogada, compatibilidade de `fn_criar_contrato`, custos inacessíveis e rollback em banco isolado; conferir owner/ACL, grants herdados e consumidores externos. Reverter por migration compensatória após desativar consumidores, sem apagar dados, reconhecendo que remover a guarda reabriria a integridade anterior. Sem deploy ou efeitos externos neste incremento.
