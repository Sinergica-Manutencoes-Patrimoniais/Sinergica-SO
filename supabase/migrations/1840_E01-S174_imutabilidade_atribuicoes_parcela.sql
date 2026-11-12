-- E01-S174 — fecha inconsistência de imutabilidade no histórico de atribuição de parcela.
--
-- Achado ao escrever o primeiro pgTAP de `pcm.sso_atribuir_parcela_os`: a tabela de comando
-- `pcm.sso_atribuicoes_parcela` não tem trigger de imutabilidade, enquanto a tabela irmã
-- `pcm.sso_atribuicoes_diretas` (migration 1197), que apenas MARCA que aquela atribuição foi
-- direta e referencia esta por FK, tem. O registro acessório era protegido e o registro
-- principal não.
--
-- Mesma classe de inconsistência já corrigida em E01-S182 (migration 1836, estornos de
-- faturável). Como lá, este fix não muda comportamento algum: verificado que nenhum papel tem
-- privilégio de update/delete nesta tabela (authenticated, service_role: todos false) e que
-- nenhuma migration faz update/delete nela. É defesa em profundidade — garante que o histórico
-- de atribuição siga append-only mesmo que um privilégio seja concedido por engano no futuro.
--
-- Reusa o mesmo guard genérico das demais tabelas de comando do programa.
create trigger sso_atribuicoes_parcela_imutaveis
  before update or delete on pcm.sso_atribuicoes_parcela
  for each row execute function pcm.sso_proteger_conferencia_levantamento();
