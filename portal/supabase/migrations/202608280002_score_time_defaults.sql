begin;

alter table public.score_settings
  alter column wake_target_time set default '04:00',
  alter column bedtime_target_time set default '20:30';

update public.score_settings
set
  wake_target_time = case when wake_target_time = '06:00' then '04:00' else wake_target_time end,
  bedtime_target_time = case when bedtime_target_time = '22:30' then '20:30' else bedtime_target_time end
where id = true
  and (wake_target_time = '06:00' or bedtime_target_time = '22:30');

commit;
