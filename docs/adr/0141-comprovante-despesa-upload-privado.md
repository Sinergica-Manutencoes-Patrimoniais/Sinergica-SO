# ADR-0141 — Upload privado de comprovantes de despesa

**Estado:** proposta preparatória, não homologada; não habilitar grants, bucket ou interface em produção sem revisão e testes.

O Storage gera `storage.objects.id` depois do upload: o último segmento do caminho é um UUID independente, nunca o ID do objeto. O caminho é `<cliente>/<despesa>/<uuid-aleatorio>`, e o comando resolve o ID real pelo caminho, proprietário atual e despesa. Upload autenticado é permitido somente a usuário com capacidade atual para a despesa ativa e ainda não realizada; nenhuma leitura direta nem URL assinada é autorizada por esta proposta. Repetição de upload consulta o objeto já criado, sem sobrescrever.

O registro da realização confirma propriedade, escopo e bucket privado na mesma transação. A política e as RPCs permanecem inoperantes até concessões posteriores explícitas; o cliente também depende de flag desligada. Não há remoção automática de objetos órfãos: retenção e limpeza exigem procedimento auditado. Uma rota de download intermediada por autorização atual permanece necessária. Reconciliar o legado que permite criar despesa já realizada. Validar semântica real de owner_id e RLS do Storage, tamanho, tipos, malware, concorrência de revogação, auditoria de upload, retenção e limites por usuário antes de ativar. Não se assume que nomes ou metadados garantem integridade do conteúdo.
