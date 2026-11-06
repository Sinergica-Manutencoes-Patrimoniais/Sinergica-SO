# ADR-0969 — Ator esperado em pedidos anteriores de conversão integral

Status: preparação privada, não homologada.

Preparar wrapper para pedidos integrais sem fotografia de escopo, exigindo `auth.uid()` igual ao ator esperado. O núcleo mantém verificação de payload e ator em replay; nenhum novo requestId é atribuído a uma tentativa incerta. O caminho com fotografia do ADR-0968 mantém seu wrapper próprio.

O wrapper é privado e tem gate próprio fechado. Revogar execução direta do mediador antigo em implantação exige atualização coordenada de todos os clientes e preservação de tentativas pendentes; cliente antigo falha fechado. Isso não torna o fluxo legado atômico, não supre fotografia de escopo, não protege todos os escritores e não libera conversão. Testar Auth real, revogação, replay, concorrência, transição de gates e revisão adversarial antes de conceder execução ou fazer rollout.
