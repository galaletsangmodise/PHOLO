-- Phase 2, migration 1: facilities and staff_profiles (plan 8.1)
create extension if not exists pgcrypto;

-- Calendar date in South African Standard Time (UTC+2, no daylight saving). BR19.
create or replace function public.sast_date(ts timestamptz)
returns date
language sql
immutable
parallel safe
as $$ select (timezone('Africa/Johannesburg', ts))::date $$;

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 100),
  address text not null check (char_length(address) between 1 and 200),
  province text not null check (province in ('Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
    'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape')),
  created_at timestamptz not null default now()
);

create table public.staff_profiles (
  id uuid primary key references auth.users (id),
  facility_id uuid not null references public.facilities (id) on delete restrict,
  full_name text not null check (char_length(full_name) between 1 and 80),
  role text not null check (role in ('Check-in', 'Reception', 'Clinical', 'Manager')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
