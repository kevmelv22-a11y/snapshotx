-- Step 9 (storage): private buckets for stories + memories (snapshotx-media already exists). NOT APPLIED.
-- Path convention: <auth.uid()>/<kind>/<id>.<ext>  (lib/backend/storage.ts mediaPath)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('sx-stories',  'sx-stories',  false, 62914560, array['image/jpeg','video/mp4']),
  ('sx-memories', 'sx-memories', false, 62914560, array['image/jpeg','video/mp4'])
on conflict (id) do nothing;

-- Owner can write/delete only inside their own folder.
create policy sx_media_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('sx-stories','sx-memories') and (storage.foldername(name))[1] = auth.uid()::text);
create policy sx_media_owner_delete on storage.objects for delete to authenticated
  using (bucket_id in ('sx-stories','sx-memories') and (storage.foldername(name))[1] = auth.uid()::text);
-- Memories: owner-only read.
create policy sx_memories_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'sx-memories' and (storage.foldername(name))[1] = auth.uid()::text);
-- Stories: owner, or anyone who can see an unexpired story row pointing at this object (sx_stories RLS decides).
create policy sx_stories_read on storage.objects for select to authenticated
  using (bucket_id = 'sx-stories' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.sx_stories s where s.media_path = name and s.expires_at > now())));
