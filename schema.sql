-- Golden Cut – Supabase Schema
-- Dieses SQL einmal komplett im Supabase SQL Editor ausführen.

create extension if not exists pgcrypto;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price_label text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,
  duration_minutes integer not null,
  barber_id uuid references public.barbers(id) on delete set null,
  barber_name text,
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  customer_note text,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_appointments_date on public.appointments (appointment_date);
create index if not exists idx_appointments_status on public.appointments (status);
create index if not exists idx_appointments_barber_date on public.appointments (barber_id, appointment_date);

alter table public.services enable row level security;
alter table public.barbers enable row level security;
alter table public.appointments enable row level security;

-- Öffentliche Leserechte für Services und Barber
create policy if not exists "public can read services"
on public.services
for select
to anon, authenticated
using (is_active = true);

create policy if not exists "public can read barbers"
on public.barbers
for select
to anon, authenticated
using (is_active = true);

-- Öffentliche Terminanfrage: Kunden dürfen nur neue pending-Termine anlegen
create policy if not exists "public can insert pending appointments"
on public.appointments
for insert
to anon, authenticated
with check (
  status = 'pending'
  and customer_name <> ''
  and customer_phone <> ''
  and customer_email <> ''
);

-- Nur eingeloggte Admins dürfen Termine sehen
create policy if not exists "authenticated can read appointments"
on public.appointments
for select
to authenticated
using (true);

-- Nur eingeloggte Admins dürfen Termine ändern
create policy if not exists "authenticated can update appointments"
on public.appointments
for update
to authenticated
using (true)
with check (true);

-- Seed-Daten
insert into public.services (name, description, duration_minutes, price_label, sort_order)
values
  ('Herrenhaarschnitt', 'Sauberer Schnitt, moderne Form und gepflegtes Finish.', 30, 'ab 24 €', 1),
  ('Fade / moderner Haarschnitt', 'Präzise Übergänge und moderne Herrenlooks mit klarer Linie.', 45, 'ab 29 €', 2),
  ('Bartpflege / Bartshave', 'Trimmen, pflegen und definieren für ein sauberes Ergebnis.', 20, 'ab 15 €', 3),
  ('Schnitt + Bart', 'Die starke Kombi für einen frischen Gesamtlook.', 50, 'ab 39 €', 4)
on conflict do nothing;

insert into public.barbers (name, sort_order)
values
  ('Golden Cut Team', 1),
  ('Barber 1', 2),
  ('Barber 2', 3)
on conflict do nothing;
