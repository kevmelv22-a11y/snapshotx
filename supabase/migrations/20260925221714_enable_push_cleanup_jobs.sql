-- Infrastructure for the sx_messages insert webhook and media cleanup job.
-- The function invocation credentials and schedule are configured separately.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
