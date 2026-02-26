create or replace function public.assistant_export_user_data(
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
stable
as $$
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated request';
  end if;

  if p_user_id is distinct from auth.uid() then
    raise exception 'Cannot export another user''s data';
  end if;

  return (
    select jsonb_build_object(
      'conversations', (
        select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
        from public.assistant_conversations c
        where c.user_id = p_user_id
      ),
      'turns', (
        select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
        from public.assistant_turns t
        where t.user_id = p_user_id
      ),
      'memories', (
        select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
        from public.assistant_memories m
        where m.user_id = p_user_id
      )
    )
  );
end;
$$;
