-- Allow server-only API routes to read the private data needed for an
-- explicitly shared entry. Safe to run repeatedly.
grant usage on schema public to service_role;

grant select on table
  public.profiles,
  public.games,
  public.entries,
  public.entry_sections,
  public.tags,
  public.entry_tags,
  public.entry_images,
  public.share_links
to service_role;

notify pgrst, 'reload schema';
