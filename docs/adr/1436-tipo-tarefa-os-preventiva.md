# ADR 1436 — Tipo de tarefa de OS preventiva vinculada

Uma rotina aprovada pode guardar o tipo de tarefa legado na sua fotografia. Quando uma nova OS referencia uma ocorrência legada vinculada a uma ocorrência preparada, o banco confere cliente, rotina lógica e alvo na fotografia aprovada e recusa um tipo de tarefa diferente do registrado. Fotografias anteriores sem esse campo continuam sem inferência de tipo. OS já existentes não são alteradas.

A verificação protege a criação, mas não implementa por si só a geração completa de OS, a integração de grupos ou o envio ao Auvo. A migration deve ser validada junto aos demais caminhos de criação, às corridas entre vínculo e criação e às permissões efetivas antes de homologação.
