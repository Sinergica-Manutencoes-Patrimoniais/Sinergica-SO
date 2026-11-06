# ADR-0829 — Leitura histórica de comprovante mediado

Status: preparado sob gate fechado; não homologado.

O seletor de serviço resolve uma revisão específica mediante autorização atual de Cliente e identifica o objeto privado correspondente. Reserva e confirmação coerentes com despesa e objeto indicam origem mediada e exigem verificação de digest na Edge; ausência de qualquer reserva indica legado. Vínculo parcial, divergente ou ambíguo falha fechado. A função histórica legada continua bloqueando objetos mediados conforme ADR-0826.

O hash cobre os bytes devolvidos, não cria imutabilidade nem revoga URLs antigas. Ativação exige testes ponta a ponta, concorrência e revisão adversarial; não autoriza deploy nem altera políticas Storage.
