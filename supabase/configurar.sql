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
