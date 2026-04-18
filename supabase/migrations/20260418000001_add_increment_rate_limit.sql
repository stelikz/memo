-- Atomically increment the rate limit counter for a device.
-- Returns the new request_count after incrementing.
-- If no row exists for today, inserts one with request_count = 1.
create or replace function increment_rate_limit(p_device_id text, p_date date)
returns integer
language sql
as $$
  insert into rate_limits (device_id, date, request_count)
  values (p_device_id, p_date, 1)
  on conflict (device_id, date)
  do update set request_count = rate_limits.request_count + 1
  returning request_count;
$$;
