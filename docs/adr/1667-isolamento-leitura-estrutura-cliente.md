---
name: "adr-1667-isolamento-leitura-estrutura-cliente"
description: "Isolamento de leitura da estrutura por Cliente"
alwaysApply: false
---

# ADR-1667 — Isolamento de leitura da estrutura por Cliente

Status: proposta. O gate nasce desligado. Com gate desligado permanecem efetivas as políticas legadas por módulo PCM e existe vazamento por consulta direta entre Clientes; isso bloqueia release. As novas superfícies de composição permanecem bloqueadas para release enquanto o gate estiver desligado; seu uso seguro exige mediadores transacionais que leiam sob a mesma trava do gate. Uma consulta de preflight separada não é garantia de segurança.

Adicionar políticas SELECT restritivas, mantendo as políticas e concessões históricas. Com gate ligado, Equipamentos e Sistemas exigem `cadastro.ler` ou `cadastro.gerir` para o Cliente da linha; cada vínculo exige que os dois extremos tenham o mesmo Cliente e que o ator possua uma dessas ações. Cliente nulo ou vínculo inconsistente não é exposto. Grupos já aplicam autorização por Cliente. As funções usam auth.uid e a autorização atual, sem aceitar identidade ou Cliente de uma sessão arbitrária. As chamadas com gate ativo exigem READ COMMITTED, trava compartilhada de revogação e bloqueio do gate, falhando fechado em contenção. A migration não altera dados, nem concede operações de escrita, nem abre o gate.

Antes de ligar: inventariar atores e integrações legítimas, papéis e Clientes efetivos sem copiar dados pessoais; provisionar concessões explícitas conforme as decisões S170; verificar cadastros sem Cliente e vínculos incompatíveis, mantendo-os para correção; avaliar usos de RLS por integrações legadas, service_role e comandos com SELECT/FOR UPDATE. Ensaiar em clone dois Clientes e usuários com concessão apenas em A, concessão global legítima, usuário sem concessão, JWT/papel divergente, Cliente inativo, revogação concorrente, gate em ambas as posições, vínculos inconsistentes, paginação e transações de leitura/alteração legadas. Não mudar dados nem autorizações para fazer o teste passar. Após correção de concessões e aprovação, ativar somente de forma coordenada, monitorar falhas de acesso e manter rollback documentado (desligar o gate restaura compatibilidade mas reabre o vazamento). Não é autorização de deploy, e nenhuma fonte externa deve ser acionada.

Os privilégios de superusuário/service_role continuam fora do escopo da política para authenticated; devem ser controlados por fronteiras próprias. O cadastro legado e códigos permanecem intactos. Homologação exige revisão adversarial, testes de isolamento/concorrência e confirmação de ACL/owners no destino.
