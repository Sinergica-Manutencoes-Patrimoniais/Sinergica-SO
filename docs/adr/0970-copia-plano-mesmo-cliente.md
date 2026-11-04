# ADR-0970 — Cópia transacional de Plano aprovado

Status: preparação privada; não homologada.

Preparar comando de cópia de uma versão aprovada para novo Plano rascunho do mesmo Cliente. A origem é a fotografia aprovada, não as Rotinas editáveis atuais; cada Rotina copiada recebe novo ID e novo ID lógico. Manter referências existentes de Sistema, Componente, Grupo e questionário, sem gerar Ocorrência, Chamado, OS ou tarefa. Inserção do Plano, versão, Rotinas, recibo idempotente e auditoria ocorre em uma transação; IDs de destino são estáveis e request divergente é rejeitado.

Uma referência de questionário no rascunho aponta ao cadastro atual e não garante que ele permaneça igual ao conteúdo congelado da origem; a interface deve explicitar necessidade de conferência. A cópia não substitui biblioteca de modelos nem cobre reatribuição entre Clientes. Gate e EXECUTE fechados; validar conteúdo completo, vínculos vigentes, referências alteradas, concorrência, segurança/RLS, limites, auditoria, preservação histórica e revisão adversarial antes de integrar ou habilitar. Nenhuma premissa autoriza geração automática.
