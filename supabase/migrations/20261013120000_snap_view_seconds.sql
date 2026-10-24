-- Step 2 (snap editing): per-snap view timer. NULL = unlimited (∞). NOT APPLIED to any project yet.
alter table public.sx_messages
  add column if not exists view_seconds smallint
  check (view_seconds is null or view_seconds between 1 and 10);
comment on column public.sx_messages.view_seconds is 'Seconds the receiver may view an opened snap (1-10); NULL = unlimited.';
