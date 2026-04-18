create table rate_limits (
  device_id text not null,
  date date not null default current_date,
  request_count integer not null default 1,
  primary key (device_id, date)
);
