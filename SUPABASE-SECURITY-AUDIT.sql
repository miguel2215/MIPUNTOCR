-- PUNTO YA CR · PRE-BETA v7.43
-- AUDITORÍA DE SOLO LECTURA. No crea, cambia ni elimina políticas.
-- Ejecutar en Supabase SQL Editor y revisar el resultado antes de la beta.

-- 1) Todas las tablas públicas y si RLS está activo.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- 2) Políticas RLS actuales.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3) Privilegios concedidos a anon/authenticated.
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;

-- REVISIÓN MANUAL OBLIGATORIA:
-- business A no debe SELECT/INSERT/UPDATE/DELETE del business B.
-- employee no debe elevarse a owner/admin manipulando el frontend.
-- anon solo debe ver los datos mínimos necesarios del catálogo público.
-- Ninguna credencial secreta, service_role o llave de Hacienda debe existir en frontend/APK.

-- ============================================================
-- v7.43 · HIGIENE DE SECRETOS FISCALES
-- ============================================================

-- 4) La tabla de secretos fiscales debe tener RLS activo.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('fiscal_secret_envelopes','fiscal_documents','fiscal_sequences');

-- 5) anon/authenticated NO deben tener privilegios sobre secretos fiscales.
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'fiscal_secret_envelopes'
  and grantee in ('anon','authenticated');

-- Resultado esperado para la consulta anterior: CERO FILAS.

-- 6) Revisar que no existan columnas de secretos en tablas de acceso normal.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name <> 'fiscal_secret_envelopes'
  and (
    column_name ilike '%hacienda%password%'
    or column_name ilike '%hacienda%pin%'
    or column_name ilike '%p12%'
    or column_name ilike '%private%key%'
  )
order by table_name, column_name;

-- 7) Funciones SECURITY DEFINER públicas: revisar search_path y permisos.
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer,
  p.proconfig as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by p.proname;
