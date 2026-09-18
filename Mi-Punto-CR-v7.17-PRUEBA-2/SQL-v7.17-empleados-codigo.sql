-- =====================================================
-- MI PUNTO CR v7.17
-- EMPLEADOS POR CODIGO CR1000, CR1001...
-- Ejecutar una sola vez en Supabase -> SQL Editor
-- =====================================================

create table if not exists public.business_employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code_number integer not null,
  display_name text not null,
  permissions jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code_number)
);

alter table public.business_members
  add column if not exists employee_id uuid references public.business_employees(id) on delete cascade;

alter table public.business_members
  add column if not exists employee_code integer;

alter table public.sales
  add column if not exists employee_id uuid references public.business_employees(id) on delete set null;

alter table public.sales
  add column if not exists employee_name text;

alter table public.sales
  add column if not exists employee_code integer;

alter table public.business_employees enable row level security;

drop policy if exists "employees_select_owner" on public.business_employees;
create policy "employees_select_owner"
on public.business_employees
for select to authenticated
using (public.is_business_owner(business_id));

drop policy if exists "employees_update_owner" on public.business_employees;
create policy "employees_update_owner"
on public.business_employees
for update to authenticated
using (public.is_business_owner(business_id))
with check (public.is_business_owner(business_id));

drop policy if exists "employees_delete_owner" on public.business_employees;
create policy "employees_delete_owner"
on public.business_employees
for delete to authenticated
using (public.is_business_owner(business_id));

grant select, update, delete on public.business_employees to authenticated;

-- Crear empleado con numeración simple por negocio: CR1000, CR1001...
create or replace function public.create_business_employee(
  p_display_name text,
  p_permissions jsonb default '{}'::jsonb
)
returns public.business_employees
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_next integer;
  v_row public.business_employees%rowtype;
begin
  select business_id into v_business_id
  from public.business_members
  where user_id = auth.uid() and role = 'owner' and active = true
  order by created_at asc
  limit 1;

  if v_business_id is null then
    raise exception 'Solo el dueño puede crear empleados';
  end if;

  -- Evita que dos altas simultáneas reciban el mismo número.
  perform pg_advisory_xact_lock(hashtext(v_business_id::text));

  select greatest(1000, coalesce(max(code_number) + 1, 1000))
    into v_next
  from public.business_employees
  where business_id = v_business_id;

  if v_next > 9999 then
    raise exception 'Se alcanzó el límite de códigos de empleado para este negocio';
  end if;

  insert into public.business_employees(
    business_id, code_number, display_name, permissions, created_by
  ) values (
    v_business_id,
    v_next,
    trim(p_display_name),
    coalesce(p_permissions, '{}'::jsonb),
    auth.uid()
  ) returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_business_employee(text, jsonb) to authenticated;

-- Mantener permisos/nombre actualizados en sesiones de empleado ya vinculadas.
create or replace function public.sync_business_employee_memberships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.business_members
     set permissions = new.permissions,
         display_name = new.display_name,
         employee_code = new.code_number,
         updated_at = now()
   where employee_id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_sync_business_employee_memberships on public.business_employees;
create trigger trg_sync_business_employee_memberships
after update of display_name, permissions on public.business_employees
for each row execute function public.sync_business_employee_memberships();

-- Acceso del empleado. El dispositivo debe estar vinculado previamente al negocio.
-- La app crea una sesión anónima de Supabase y este RPC la vincula al empleado.
create or replace function public.employee_code_login(
  p_business_id uuid,
  p_code_number integer
)
returns table(
  employee_id uuid,
  business_id uuid,
  code_number integer,
  display_name text,
  permissions jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.business_employees%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida';
  end if;

  select * into v_employee
  from public.business_employees e
  where e.business_id = p_business_id
    and e.code_number = p_code_number
  limit 1;

  if not found then
    raise exception 'Código de empleado incorrecto';
  end if;

  -- Una sesión anónima representa un solo empleado a la vez.
  delete from public.business_members
  where user_id = auth.uid()
    and role = 'employee';

  insert into public.business_members(
    business_id,
    user_id,
    role,
    permissions,
    display_name,
    email,
    active,
    employee_id,
    employee_code
  ) values (
    v_employee.business_id,
    auth.uid(),
    'employee',
    v_employee.permissions,
    v_employee.display_name,
    null,
    true,
    v_employee.id,
    v_employee.code_number
  )
  on conflict (business_id, user_id)
  do update set
    role = 'employee',
    permissions = excluded.permissions,
    display_name = excluded.display_name,
    email = null,
    active = true,
    employee_id = excluded.employee_id,
    employee_code = excluded.employee_code,
    updated_at = now();

  return query
  select v_employee.id,
         v_employee.business_id,
         v_employee.code_number,
         v_employee.display_name,
         v_employee.permissions;
end;
$$;

grant execute on function public.employee_code_login(uuid, integer) to anon, authenticated;

create index if not exists idx_business_employees_business_code
on public.business_employees(business_id, code_number);

create index if not exists idx_business_members_employee
on public.business_members(employee_id);

create index if not exists idx_sales_employee_created
on public.sales(employee_id, created_at desc);
