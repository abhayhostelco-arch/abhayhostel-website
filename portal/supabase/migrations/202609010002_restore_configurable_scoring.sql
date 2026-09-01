begin;

-- The score_settings columns already existed in the original scoring migration.
-- Restore the planned rubric as the initial configuration without overwriting
-- settings that a Super Admin may already have customized.
update public.score_settings
set
  sadhana_weight = 25,
  study_weight = 25,
  discipline_weight = 25,
  seva_weight = 25,
  chanting_target_rounds = 2,
  evening_reading_target_minutes = 30,
  study_target_minutes = 360,
  wake_target_time = '05:00',
  bedtime_target_time = '22:00',
  seva_target_minutes = 180,
  discipline_grace_minutes = 30
where id = true
  and sadhana_weight = 40
  and study_weight = 25
  and discipline_weight = 20
  and seva_weight = 15
  and chanting_target_rounds = 16
  and evening_reading_target_minutes = 30
  and study_target_minutes = 240
  and wake_target_time in ('04:00', '06:00')
  and bedtime_target_time in ('20:30', '22:30')
  and seva_target_minutes = 60
  and discipline_grace_minutes = 120;

commit;
