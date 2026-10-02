-- E01-S53: sistemas são Equipment no Auvo. Releases anteriores gravaram o id
-- remoto na coluna legada auvo_id; preserva esse vínculo no campo canônico usado
-- pelas preventivas. O GUC evita reenvio de Sistemas já existentes durante o backfill.
-- Reversão: update pcm.sistemas set auvo_equipment_id = null where auvo_equipment_id = auvo_id;

select set_config('app.auvo_sync_write', 'true', true);

update pcm.sistemas
set auvo_equipment_id = auvo_id
where auvo_equipment_id is null
  and auvo_id is not null;
