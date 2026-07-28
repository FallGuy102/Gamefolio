-- Seed two real, deletable starter entries exactly once for every account.
alter table public.profiles
  add column if not exists starter_content_seeded_at timestamptz;

create or replace function public.seed_gamefolio_starter_content(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  seeded_at timestamptz;
  idea_id uuid;
  review_id uuid;
  tag_id uuid;
begin
  select profile.starter_content_seeded_at
    into seeded_at
    from public.profiles as profile
    where profile.id = target_user_id
    for update;

  if not found or seeded_at is not null then
    return;
  end if;

  select entry.id
    into idea_id
    from public.entries as entry
    where entry.user_id = target_user_id
      and entry.title = '让失败成为地图的一部分'
    limit 1;

  if idea_id is null then
    idea_id := gen_random_uuid();
    insert into public.entries (
      id,
      user_id,
      type,
      title,
      body,
      design_theme,
      status,
      favorite,
      version
    )
    values (
      idea_id,
      target_user_id,
      'idea',
      '让失败成为地图的一部分',
      '玩家每次失败的位置都留下微弱痕迹，逐渐形成一张属于自己的风险地图。它既是叙事，也是下一次行动的线索。',
      '核心玩法',
      'complete',
      true,
      1
    );

    insert into public.tags (id, user_id, name)
    values (gen_random_uuid(), target_user_id, '失败反馈')
    on conflict (user_id, name) do update set name = excluded.name
    returning id into tag_id;
    insert into public.entry_tags (entry_id, tag_id, user_id)
    values (idea_id, tag_id, target_user_id)
    on conflict (entry_id, tag_id) do nothing;

    insert into public.tags (id, user_id, name)
    values (gen_random_uuid(), target_user_id, '环境叙事')
    on conflict (user_id, name) do update set name = excluded.name
    returning id into tag_id;
    insert into public.entry_tags (entry_id, tag_id, user_id)
    values (idea_id, tag_id, target_user_id)
    on conflict (entry_id, tag_id) do nothing;
  end if;

  select entry.id
    into review_id
    from public.entries as entry
    where entry.user_id = target_user_id
      and entry.title = '《空洞骑士》的探索节奏'
    limit 1;

  if review_id is null then
    review_id := gen_random_uuid();
    insert into public.entries (
      id,
      user_id,
      type,
      title,
      body,
      design_theme,
      status,
      favorite,
      version
    )
    values (
      review_id,
      target_user_id,
      'review',
      '《空洞骑士》的探索节奏',
      '真正驱动探索的不是奖励密度，而是持续制造“我好像能到那里”的空间暗示。',
      '关卡设计',
      'complete',
      false,
      1
    );

    insert into public.entry_sections (
      id,
      entry_id,
      user_id,
      kind,
      content,
      position
    )
    values
      (
        gen_random_uuid(),
        review_id,
        target_user_id,
        'highlights',
        '用声音、地标和未解锁路径共同制造方向感。',
        0
      ),
      (
        gen_random_uuid(),
        review_id,
        target_user_id,
        'lessons',
        '让玩家记住空间关系，而不是只跟随任务箭头。',
        1
      );

    insert into public.tags (id, user_id, name)
    values (gen_random_uuid(), target_user_id, '探索')
    on conflict (user_id, name) do update set name = excluded.name
    returning id into tag_id;
    insert into public.entry_tags (entry_id, tag_id, user_id)
    values (review_id, tag_id, target_user_id)
    on conflict (entry_id, tag_id) do nothing;

    insert into public.tags (id, user_id, name)
    values (gen_random_uuid(), target_user_id, '地图')
    on conflict (user_id, name) do update set name = excluded.name
    returning id into tag_id;
    insert into public.entry_tags (entry_id, tag_id, user_id)
    values (review_id, tag_id, target_user_id)
    on conflict (entry_id, tag_id) do nothing;

    insert into public.tags (id, user_id, name)
    values (gen_random_uuid(), target_user_id, '节奏')
    on conflict (user_id, name) do update set name = excluded.name
    returning id into tag_id;
    insert into public.entry_tags (entry_id, tag_id, user_id)
    values (review_id, tag_id, target_user_id)
    on conflict (entry_id, tag_id) do nothing;
  end if;

  update public.profiles
    set starter_content_seeded_at = now(),
        updated_at = now()
    where id = target_user_id;
end;
$$;

revoke all on function public.seed_gamefolio_starter_content(uuid) from public;
revoke all on function public.seed_gamefolio_starter_content(uuid) from anon;
revoke all on function public.seed_gamefolio_starter_content(uuid) from authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  perform public.seed_gamefolio_starter_content(new.id);
  return new;
end;
$$;

do $$
declare
  profile_id uuid;
begin
  for profile_id in
    select id
    from public.profiles
    where starter_content_seeded_at is null
  loop
    perform public.seed_gamefolio_starter_content(profile_id);
  end loop;
end;
$$;
