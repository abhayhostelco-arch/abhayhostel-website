begin;

revoke execute on function private.current_user_is_active() from public, anon;
grant execute on function private.current_user_is_active() to authenticated;

commit;
