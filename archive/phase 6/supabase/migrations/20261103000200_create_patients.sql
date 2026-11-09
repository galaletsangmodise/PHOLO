-- Phase 2, migration 2: patients, is_valid_sa_id, normalise_cellphone, next_file_number, patients_set_file_number

-- BR5: 13 digits, first 6 = date of birth as YYMMDD, last digit passes the Luhn test.
create or replace function public.is_valid_sa_id(p_id text, p_dob date)
returns boolean
language plpgsql
immutable
as $$
declare
  v_sum int := 0;
  v_digit int;
  i int;
begin
  if p_id is null or p_dob is null or p_id !~ '^[0-9]{13}$' then
    return false;
  end if;
  if substr(p_id, 1, 6) <> to_char(p_dob, 'YYMMDD') then
    return false;
  end if;
  for i in 0..12 loop
    v_digit := substr(p_id, 13 - i, 1)::int;
    if i % 2 = 1 then
      v_digit := v_digit * 2;
      if v_digit > 9 then v_digit := v_digit - 9; end if;
    end if;
    v_sum := v_sum + v_digit;
  end loop;
  return v_sum % 10 = 0;
end;
$$;

-- BR6: "082 555 0147", "0825550147", "27825550147" and "+27825550147" all become "+27825550147".
-- Anything that is not valid is returned unchanged so the table check refuses it. Empty stays null.
create or replace function public.normalise_cellphone(p_raw text)
returns text
language sql
immutable
as $$
  select case
    when p_raw is null or btrim(p_raw) = '' then null
    when c ~ '^\+27[0-9]{9}$' then c
    when c ~ '^27[0-9]{9}$' then '+' || c
    when c ~ '^0[0-9]{9}$' then '+27' || substr(c, 2)
    else p_raw
  end
  from (select regexp_replace(coalesce(p_raw, ''), '[ -]', '', 'g') as c) s
$$;

-- BR4: next number at this Facility, PH- and 6 digits.
create or replace function public.next_file_number(p_facility_id uuid)
returns text
language plpgsql
volatile
as $$
declare
  v_next int;
begin
  select coalesce(max(substr(file_number, 4)::int), 0) + 1 into v_next
  from public.patients where facility_id = p_facility_id;
  return 'PH-' || lpad(v_next::text, 6, '0');
end;
$$;

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete restrict,
  file_number text not null check (file_number ~ '^PH-[0-9]{6}$'),
  first_name text not null check (char_length(first_name) between 1 and 40 and first_name ~ '^[[:alpha:] ''-]+$'),
  surname text not null check (char_length(surname) between 1 and 40 and surname ~ '^[[:alpha:] ''-]+$'),
  date_of_birth date not null check (date_of_birth >= date '1900-01-01'),
  id_number text check (id_number is null or public.is_valid_sa_id(id_number, date_of_birth)),
  cellphone text check (cellphone is null or cellphone ~ '^\+27[0-9]{9}$'),
  paper_file_status text not null default 'No paper file'
    check (paper_file_status in ('No paper file', 'Paper file - not yet digitised', 'Paper file - digitised')),
  chronic_conditions text check (chronic_conditions is null or char_length(chronic_conditions) <= 500),
  allergies text check (allergies is null or char_length(allergies) <= 300),
  current_medication text check (current_medication is null or char_length(current_medication) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patients_facility_file_number_key unique (facility_id, file_number)
);

-- Gives the next file number. A file number supplied by the administrator (seed, tests) is kept;
-- the app roles can never choose their own.
create or replace function public.patients_set_file_number()
returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtext('file_number:' || new.facility_id::text));
  if new.file_number is null or new.file_number = '' or current_user in ('authenticated', 'anon') then
    new.file_number := public.next_file_number(new.facility_id);
  end if;
  return new;
end;
$$;

create trigger patients_set_file_number
  before insert on public.patients
  for each row execute function public.patients_set_file_number();
