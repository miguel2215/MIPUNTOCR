-- ============================================================
-- PUNTO YA CR · v7.43 PRE-BETA CIERRE
-- Base segura para Factura Electrónica Costa Rica 4.4
--
-- IMPORTANTE
-- 1) Ejecutar primero en el proyecto Supabase de PRE-BETA.
-- 2) No pegar usuarios, contraseñas, PIN ni llaves .p12 en este SQL.
-- 3) Las credenciales se guardan SOLO cifradas por Edge Function.
-- 4) Producción queda bloqueada hasta aprobar pruebas/QA.
-- ============================================================

create extension if not exists pgcrypto;

-- Credenciales fiscales cifradas. El navegador NO tiene acceso directo.
create table if not exists public.fiscal_secret_envelopes (
  business_id uuid not null references public.businesses(id) on delete cascade,
  environment text not null check (environment in ('sandbox','production')),
  payload_ciphertext text not null,
  iv text not null,
  key_version text not null default 'v1',
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, environment)
);

alter table public.fiscal_secret_envelopes enable row level security;
revoke all on table public.fiscal_secret_envelopes from anon, authenticated;
grant all on table public.fiscal_secret_envelopes to service_role;

-- Registro técnico de documentos fiscales. No sustituye la venta del POS.
create table if not exists public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id text null,
  environment text not null default 'sandbox' check (environment in ('sandbox','production')),
  document_type text not null check (document_type in ('01','02','03','04','05','06','07','08','09','10')),
  clave varchar(50) null,
  consecutivo varchar(20) null,
  status text not null default 'draft' check (status in ('draft','signed','sent','recibido','procesando','aceptado','rechazado','error')),
  signed_xml text null,
  response_xml text null,
  error_message text null,
  hacienda_location text null,
  sent_at timestamptz null,
  answered_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fiscal_documents_business_idx on public.fiscal_documents(business_id, created_at desc);
create unique index if not exists fiscal_documents_clave_unique on public.fiscal_documents(clave) where clave is not null;
alter table public.fiscal_documents enable row level security;

-- Helper: solo miembros activos del negocio o dueño pueden consultar registros fiscales no secretos.
create or replace function public.pycr_can_access_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.businesses b
      where b.id = p_business_id and b.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from public.business_members bm
      where bm.business_id = p_business_id
        and bm.user_id = auth.uid()
        and coalesce(bm.active, true) = true
    );
$$;

revoke all on function public.pycr_can_access_business(uuid) from public;
grant execute on function public.pycr_can_access_business(uuid) to authenticated;

-- Empleados/miembros pueden leer estado fiscal de SU negocio. Escritura se hace por backend.
drop policy if exists fiscal_documents_select_own_business on public.fiscal_documents;
create policy fiscal_documents_select_own_business
on public.fiscal_documents
for select
to authenticated
using (public.pycr_can_access_business(business_id));

revoke insert, update, delete on public.fiscal_documents from anon, authenticated;
grant select on public.fiscal_documents to authenticated;
grant all on public.fiscal_documents to service_role;

-- Consecutivos por negocio/sucursal/terminal/tipo. Uso exclusivo de backend.
create table if not exists public.fiscal_sequences (
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_code char(3) not null,
  terminal_code char(5) not null,
  document_type char(2) not null,
  next_number bigint not null default 1 check (next_number between 1 and 9999999999),
  updated_at timestamptz not null default now(),
  primary key (business_id, branch_code, terminal_code, document_type)
);

alter table public.fiscal_sequences enable row level security;
revoke all on table public.fiscal_sequences from anon, authenticated;
grant all on table public.fiscal_sequences to service_role;

comment on table public.fiscal_secret_envelopes is 'Secretos fiscales cifrados por negocio. Solo service_role/Edge Functions.';
comment on table public.fiscal_documents is 'Estados y XML fiscales por negocio; no contiene credenciales.';
comment on table public.fiscal_sequences is 'Control atómico de consecutivos fiscales; solo backend.';
