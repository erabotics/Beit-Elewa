-- Beit Elewa ordering backend (Supabase / PostgreSQL 15+)
-- Run in the Supabase SQL editor or as a migration.
-- Money is whole Egyptian pounds (integer). Prices and delivery fees are ALWAYS
-- read from the database inside the transaction; the browser never decides them.

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------
create table if not exists public.products (
  id             text primary key,                 -- 'kebda', 'pepsi', ...
  name           text not null,
  category       text not null,
  price_egp      integer not null check (price_egp > 0),
  offer_eligible boolean not null default false,   -- counts toward "3 for 100"
  is_available   boolean not null default true,    -- kitchen can switch items off
  stock          integer check (stock is null or stock >= 0), -- null = not counted (sandwiches); a number = counted (cans, chips)
  updated_at     timestamptz not null default now()
);

-- Delivery areas and their fees. Change a fee or add an area here; no code change.
create table if not exists public.delivery_zones (
  name        text primary key,
  fee_egp     integer not null check (fee_egp >= 0),
  is_active   boolean not null default true,
  sort_order  integer not null default 0
);

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  idempotency_key  uuid not null unique,
  request_hash     text not null,                  -- detects a key reused with a different cart
  fulfillment      text not null check (fulfillment in ('delivery','pickup')),
  customer_name    text not null,
  phone            text not null,
  area             text,                           -- null for pickup
  address          text,                           -- null for pickup
  floor            text,
  notes            text,
  subtotal_egp     integer not null,
  discount_egp     integer not null,
  delivery_egp     integer not null,
  total_egp        integer not null,
  status           text not null default 'new'
                   check (status in ('new','confirmed','preparing','ready_for_pickup',
                                     'out_for_delivery','delivered','cancelled')),
  created_at       timestamptz not null default now(),
  check (fulfillment = 'pickup'   or (area is not null and address is not null)),
  check (fulfillment = 'delivery' or delivery_egp = 0)
);
create index if not exists orders_phone_recent on public.orders (phone, created_at desc);

create table if not exists public.order_items (
  order_id        uuid not null references public.orders(id) on delete cascade,
  product_id      text not null references public.products(id),
  name_snapshot   text not null,                   -- name/price as they were when ordered
  unit_price_egp  integer not null,
  qty             integer not null check (qty between 1 and 50),
  primary key (order_id, product_id)
);

-- Outbox: written in the SAME transaction as the order, processed afterwards by a
-- worker (Edge Function on a schedule / database webhook) that notifies the kitchen.
-- If the notification fails, the order still exists and the job is retried.
create table if not exists public.outbox (
  id            bigserial primary key,
  kind          text not null,
  payload       jsonb not null,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz,
  attempts      integer not null default 0
);
create index if not exists outbox_pending on public.outbox (id) where processed_at is null;

create table if not exists public.rate_limits (
  bucket        text not null,
  window_start  timestamptz not null,
  hits          integer not null,
  primary key (bucket, window_start)
);

------------------------------------------------------------------------------
-- Row Level Security: the public can read the menu and delivery areas, nothing
-- else. Orders are only created through place_order(), called by the Edge Function.
------------------------------------------------------------------------------
alter table public.products       enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.outbox         enable row level security;
alter table public.rate_limits    enable row level security;

drop policy if exists "menu is public" on public.products;
create policy "menu is public" on public.products for select using (true);
drop policy if exists "zones are public" on public.delivery_zones;
create policy "zones are public" on public.delivery_zones for select using (is_active);
-- (no policies on the other tables = anon/authenticated users get nothing)

------------------------------------------------------------------------------
-- Rate limiter (fixed window). Returns true while under the limit.
------------------------------------------------------------------------------
create or replace function public.hit_rate_limit(p_bucket text, p_max int, p_window_seconds int)
returns boolean
language sql
security definer
set search_path = public
as $$
  insert into rate_limits (bucket, window_start, hits)
  values (p_bucket,
          to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds),
          1)
  on conflict (bucket, window_start) do update set hits = rate_limits.hits + 1
  returning hits <= p_max;
$$;

------------------------------------------------------------------------------
-- place_order: the whole checkout is ONE transaction. Any exception rolls back
-- everything (order, items, stock, outbox) — nothing is half-written.
--
-- p_customer: {"fulfillment":"delivery"|"pickup","name","phone","area","address","floor","notes"}
--             area/address/floor are required for delivery and ignored for pickup.
-- p_items:    [{"id":"kebda","qty":2}, ...]
------------------------------------------------------------------------------
create or replace function public.place_order(
  p_idempotency_key uuid,
  p_customer        jsonb,
  p_items           jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_offer_total constant int := 100;

  v_hash     text := md5(coalesce(p_customer::text, '') || coalesce(p_items::text, ''));
  v_existing public.orders;
  v_mode     text := coalesce(p_customer->>'fulfillment', 'delivery');
  v_name     text := btrim(p_customer->>'name');
  v_phone    text := regexp_replace(coalesce(p_customer->>'phone', ''), '\D', '', 'g');
  v_area     text := p_customer->>'area';
  v_address  text := btrim(p_customer->>'address');
  v_floor    text := nullif(btrim(coalesce(p_customer->>'floor', '')), '');
  v_notes    text := nullif(btrim(coalesce(p_customer->>'notes', '')), '');
  v_fee      int;

  v_lines     jsonb;          -- {"kebda": 2, ...} with duplicates merged
  v_wanted    int;
  v_found     int := 0;
  v_sub       int := 0;
  v_disc      int := 0;
  v_units     int[] := '{}';  -- one entry per offer-eligible unit (its price)
  v_order_id  uuid;
  r           record;
  i           int;
begin
  ---------------------------------------------------------------- idempotency
  -- Two requests with the same key wait for each other here (lock is released
  -- at commit), so a double-click or network retry can never create two orders.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_existing from orders where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return jsonb_build_object('order_id', v_existing.id,
                              'fulfillment', v_existing.fulfillment,
                              'total_egp', v_existing.total_egp,
                              'replayed', true);
  end if;

  ---------------------------------------------------------------- validation
  if v_mode not in ('delivery', 'pickup') then
    raise exception 'INVALID_FULFILLMENT';
  end if;
  if v_name is null or char_length(v_name) not between 2 and 60 then
    raise exception 'INVALID_NAME';
  end if;
  if v_phone !~ '^01[0125][0-9]{8}$' then
    raise exception 'INVALID_PHONE';
  end if;

  if v_mode = 'pickup' then
    v_area := null; v_address := null; v_floor := null;
    v_fee  := 0;                                   -- pickup never pays delivery
  else
    select fee_egp into v_fee from delivery_zones where name = v_area and is_active;
    if not found then
      raise exception 'INVALID_AREA';
    end if;
    if v_address is null or char_length(v_address) not between 5 and 200 then
      raise exception 'INVALID_ADDRESS';
    end if;
  end if;

  if char_length(coalesce(v_floor, '')) > 60 or char_length(coalesce(v_notes, '')) > 300 then
    raise exception 'INVALID_DETAILS';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 30
     or exists (select 1 from jsonb_array_elements(p_items) e
                where jsonb_typeof(e) <> 'object'
                   or jsonb_typeof(e->'id') <> 'string'
                   or jsonb_typeof(e->'qty') <> 'number'
                   or (e->>'qty') !~ '^[0-9]{1,2}$'
                   or (e->>'qty')::int < 1) then
    raise exception 'INVALID_ITEMS';
  end if;

  select jsonb_object_agg(id, qty) into v_lines
  from (select e->>'id' as id, sum((e->>'qty')::int) as qty
        from jsonb_array_elements(p_items) e
        group by 1) s;

  if exists (select 1 from jsonb_each_text(v_lines) where value::int > 50) then
    raise exception 'INVALID_ITEMS';
  end if;
  select count(*) into v_wanted from jsonb_object_keys(v_lines);

  ---------------------------------------------------------------- abuse guard
  if (select count(*) from orders
      where phone = v_phone and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'TOO_MANY_ORDERS';
  end if;

  ---------------------------------------------------------------- lock + price
  -- FOR UPDATE locks each product row until commit. Two customers buying the
  -- last Pepsi at the same moment: the second waits, then sees stock = 0.
  -- ORDER BY id makes every transaction lock rows in the same order (no deadlocks).
  for r in
    select p.id, p.name, p.price_egp, p.offer_eligible, p.is_available, p.stock,
           (v_lines->>p.id)::int as qty
    from products p
    where p.id in (select jsonb_object_keys(v_lines))
    order by p.id
    for update
  loop
    v_found := v_found + 1;
    if not r.is_available then
      raise exception 'ITEM_UNAVAILABLE:%', r.id;
    end if;
    if r.stock is not null and r.stock < r.qty then
      raise exception 'OUT_OF_STOCK:%', r.id;
    end if;
    v_sub := v_sub + r.price_egp * r.qty;
    if r.offer_eligible then
      v_units := v_units || array_fill(r.price_egp, array[r.qty]);
    end if;
  end loop;

  if v_found <> v_wanted then
    raise exception 'UNKNOWN_ITEM';
  end if;

  ---------------------------------------------------------------- offer
  -- "Any 3 eligible sandwiches for 100": group the most expensive units first.
  select coalesce(array_agg(u order by u desc), '{}') into v_units from unnest(v_units) u;
  i := 1;
  while i + 2 <= coalesce(array_length(v_units, 1), 0) loop
    v_disc := v_disc + greatest(0, v_units[i] + v_units[i + 1] + v_units[i + 2] - c_offer_total);
    i := i + 3;
  end loop;

  ---------------------------------------------------------------- write
  update products p
     set stock = p.stock - (v_lines->>p.id)::int, updated_at = now()
   where p.id in (select jsonb_object_keys(v_lines)) and p.stock is not null;

  insert into orders (idempotency_key, request_hash, fulfillment, customer_name, phone, area,
                      address, floor, notes, subtotal_egp, discount_egp, delivery_egp, total_egp)
  values (p_idempotency_key, v_hash, v_mode, v_name, v_phone, v_area,
          v_address, v_floor, v_notes, v_sub, v_disc, v_fee, v_sub - v_disc + v_fee)
  returning id into v_order_id;

  insert into order_items (order_id, product_id, name_snapshot, unit_price_egp, qty)
  select v_order_id, p.id, p.name, p.price_egp, (v_lines->>p.id)::int
  from products p
  where p.id in (select jsonb_object_keys(v_lines));

  insert into outbox (kind, payload)
  values ('order_created', jsonb_build_object('order_id', v_order_id));

  return jsonb_build_object('order_id', v_order_id,
                            'fulfillment', v_mode,
                            'subtotal_egp', v_sub,
                            'discount_egp', v_disc,
                            'delivery_egp', v_fee,
                            'total_egp', v_sub - v_disc + v_fee,
                            'replayed', false);
end;
$$;

-- Only the server (service role used by the Edge Function) may call these.
revoke all on function public.place_order(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.hit_rate_limit(text, int, int)  from public, anon, authenticated;
grant execute on function public.place_order(uuid, jsonb, jsonb) to service_role;
grant execute on function public.hit_rate_limit(text, int, int)  to service_role;

------------------------------------------------------------------------------
-- Seed data
------------------------------------------------------------------------------
-- Delivery fees: set each area's real fee here (both are 20 today).
insert into public.delivery_zones (name, fee_egp, sort_order) values
  ('زهراء مدينة نصر', 20, 1),
  ('الواحة',          20, 2)
on conflict (name) do nothing;

-- Menu (current prices; drinks marked * are still to be confirmed)
insert into public.products (id, name, category, price_egp, offer_eligible, stock) values
  ('kebda',    'كبدة',               'kebda',  25,  false, null),
  ('khalta',   'سجق بالخلطة',        'sogo2',  35,  true,  null),
  ('sharqy',   'سجق شرقي سادة',      'sogo2',  35,  true,  null),
  ('sharqyc',  'سجق شرقي بالجبنة',   'sogo2',  40,  false, null),
  ('mda5n',    'مدخن',               'mda5n',  25,  false, null),
  ('panne',    'بانيه',              'panne',  120, false, null),
  ('burger',   'كلاسيك برجر',        'burger', 130, false, null),
  ('sakalans', 'سكلانس',             'sweet',  35,  true,  null),
  ('fries',    'بطاطس',              'sides',  25,  false, null),
  ('tahina',   'طحينة',              'sides',  15,  false, null),
  ('pickles',  'مخلل',               'sides',  10,  false, null),
  ('tomato',   'طماطم متبلة',        'sides',  15,  false, null),
  ('pepsi',    'بيبسي',              'drinks', 20,  false, 0),  -- * price
  ('7up',      'سفن أب',             'drinks', 20,  false, 0),  -- * price
  ('vcola',    'في كولا',            'drinks', 20,  false, 0),
  ('vdiet',    'في كولا دايت',       'drinks', 20,  false, 0),
  ('v7lemon',  'في ٧ ليمون نعناع',   'drinks', 20,  false, 0),
  ('juice',    'عصير جهينة برتقال',  'drinks', 15,  false, 0),  -- * price
  ('chipsy',   'شيبسي',              'drinks', 15,  false, 0),
  ('water',    'مياه',               'drinks', 10,  false, 0),  -- * price
  ('patty',    'قطعة برجر زيادة',    'addon',  90,  false, null),
  ('cheese',   'جبنة زيادة',         'addon',  15,  false, null),
  ('combo_pepsi',   'كومبو: بطاطس + بيبسي',           'addon', 45, false, null),
  ('combo_7up',     'كومبو: بطاطس + سفن أب',          'addon', 45, false, null),
  ('combo_vcola',   'كومبو: بطاطس + في كولا',         'addon', 45, false, null),
  ('combo_vdiet',   'كومبو: بطاطس + في كولا دايت',    'addon', 45, false, null),
  ('combo_v7lemon', 'كومبو: بطاطس + في ٧ ليمون نعناع', 'addon', 45, false, null)
on conflict (id) do nothing;
-- Note: "1 extra patty per burger / 1 combo per sandwich" is enforced by the
-- website and flagged by the Google Sheets script; add a check here if you move to Supabase.
-- Drinks start at stock 0: set real counts from the admin side before going live.
