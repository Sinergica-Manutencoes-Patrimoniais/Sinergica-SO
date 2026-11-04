-- ADR-1382: usa a guarda existente apenas para novas declarações de Visita.
create trigger sso_guarda_esforco_visita_suprimida before insert on pcm.capacidade_esforco_declaracoes
  for each row execute function pcm.sso_guardar_vinculo_ocorrencia_visita_suprimida('ocorrencia_visita_id');
