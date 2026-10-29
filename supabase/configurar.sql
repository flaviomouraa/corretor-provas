-- Corretor de Provas: configuração do servidor de sincronização (Supabase).
-- Cole tudo no SQL Editor do projeto e clique em Run. Pode rodar mais de uma vez.
-- O servidor guarda apenas dados já criptografados no aparelho do professor.

create table if not exists public.cofres (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  blob text not null,          -- cofre cifrado (AES-GCM) com gabaritos e notas
  t bigint not null,           -- momento da última gravação (ms)
  atualizado timestamptz not null default now()
);

create table if not exists public.imagens (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,            -- id da prova corrigida
  iv text not null,
  ct text not null,            -- imagem do cartão cifrada
  primary key (user_id, id)
);

alter table public.cofres enable row level security;
alter table public.imagens enable row level security;

drop policy if exists "cada professor só vê o seu" on public.cofres;
create policy "cada professor só vê o seu" on public.cofres
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cada professor só vê o seu" on public.imagens;
create policy "cada professor só vê o seu" on public.imagens
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.cofres, public.imagens from anon;
grant select, insert, update, delete on public.cofres, public.imagens to authenticated;

-- ============================================================
-- Versão 1.5: chave de recuperação e mensagens dos professores
-- ============================================================
create extension if not exists pgcrypto with schema extensions;

-- resumo (hash) da chave de recuperação de cada professor; a chave em si nunca chega aqui
create table if not exists public.recuperacao (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  verificador text not null,
  atualizado timestamptz not null default now()
);
alter table public.recuperacao enable row level security;
drop policy if exists "cada professor só vê o seu" on public.recuperacao;
create policy "cada professor só vê o seu" on public.recuperacao
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.recuperacao from anon;
grant select, insert, update, delete on public.recuperacao to authenticated;

-- "Esqueci a senha": confere o resumo da chave e define a nova senha de acesso ao servidor
create or replace function public.recuperar_conta(p_email text, p_verificador text, p_nova_senha text)
returns boolean language plpgsql security definer set search_path = public, auth, extensions as $$
declare u uuid;
begin
  if length(coalesce(p_nova_senha, '')) < 20 then return false; end if;
  select id into u from auth.users where email = lower(p_email);
  if u is null then return false; end if;
  if not exists (select 1 from public.recuperacao r
                 where r.user_id = u and r.verificador = encode(extensions.digest(p_verificador, 'sha256'), 'hex')) then
    return false;
  end if;
  update auth.users set encrypted_password = extensions.crypt(p_nova_senha, extensions.gen_salt('bf')) where id = u;
  return true;
end $$;
revoke all on function public.recuperar_conta(text, text, text) from public;
grant execute on function public.recuperar_conta(text, text, text) to anon, authenticated;

-- mensagens enviadas pelo botão "Fale conosco" (só entram; leia pelo Table Editor)
create table if not exists public.sugestoes (
  id bigint generated always as identity primary key,
  criada timestamptz not null default now(),
  tipo text not null default 'sugestao',
  texto text not null check (length(texto) between 1 and 4000),
  contato text check (length(contato) <= 120),
  versao text,
  aparelho text,
  user_id uuid default auth.uid()
);
alter table public.sugestoes enable row level security;
drop policy if exists "qualquer um pode enviar" on public.sugestoes;
create policy "qualquer um pode enviar" on public.sugestoes for insert to anon, authenticated with check (true);
grant insert on public.sugestoes to anon, authenticated;
