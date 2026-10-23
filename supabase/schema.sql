create extension if not exists pgcrypto;

create table if not exists public.produtos (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  categoria text,
  descricao text,
  preco_normal numeric(12, 2) not null check (preco_normal >= 0),
  preco_oferta numeric(12, 2) check (preco_oferta >= 0),
  imagem_url text,
  unidade text not null default 'unidade',
  marca text,
  selo text,
  tabloide_pagina text,
  restricoes_json jsonb not null default '[]'::jsonb,
  estoque integer check (estoque is null or estoque >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.produtos add column if not exists descricao text;
alter table public.produtos add column if not exists nome text not null default '';
alter table public.produtos add column if not exists categoria text;
alter table public.produtos add column if not exists preco_normal numeric(12, 2) not null default 0;
alter table public.produtos add column if not exists preco_oferta numeric(12, 2);
alter table public.produtos add column if not exists imagem_url text;
alter table public.produtos add column if not exists unidade text not null default 'unidade';
alter table public.produtos add column if not exists ativo boolean not null default true;
alter table public.produtos add column if not exists marca text;
alter table public.produtos add column if not exists selo text;
alter table public.produtos add column if not exists tabloide_pagina text;
alter table public.produtos add column if not exists restricoes_json jsonb not null default '[]'::jsonb;
alter table public.produtos add column if not exists estoque integer;
alter table public.produtos add column if not exists updated_at timestamptz not null default now();

create table if not exists public.ofertas_relampago (
  id uuid primary key default gen_random_uuid(),
  produto_id text not null references public.produtos(id) on delete cascade,
  preco_promocional numeric(12, 2) not null check (preco_promocional > 0),
  data_inicio date not null,
  data_fim date not null,
  constraint oferta_datas_validas check (data_fim >= data_inicio),
  constraint oferta_produto_periodo_unico unique (produto_id, data_inicio, data_fim)
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_nome text not null,
  cliente_telefone text not null,
  endereco text,
  itens_json jsonb not null check (jsonb_typeof(itens_json) = 'array'),
  total numeric(12, 2) not null check (total >= 0),
  status text not null default 'recebido'
    check (status in ('recebido', 'em_preparacao', 'pronto', 'saiu_para_entrega', 'concluido', 'cancelado')),
  criado_em timestamptz not null default now()
);

alter table public.pedidos
  add column if not exists cliente_id uuid references auth.users(id) on delete set null;
alter table public.pedidos
  add column if not exists metodo_entrega text not null default 'delivery';
alter table public.pedidos
  add column if not exists metodo_pagamento text not null default 'pix';
alter table public.pedidos
  add column if not exists troco_para numeric(12, 2);

create or replace function public.preparar_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  v_produto_id text;
  v_quantidade integer;
  v_nome text;
  v_preco numeric(12, 2);
  v_subtotal numeric(12, 2);
  v_total numeric(12, 2) := 0;
  v_itens jsonb := '[]'::jsonb;
  v_data_loja date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if jsonb_typeof(new.itens_json) <> 'array'
     or jsonb_array_length(new.itens_json) = 0 then
    raise exception 'O pedido precisa ter ao menos um item';
  end if;

  for item in select value from jsonb_array_elements(new.itens_json)
  loop
    v_produto_id := item ->> 'produto_id';
    v_quantidade := (item ->> 'quantidade')::integer;
    if v_produto_id is null or v_quantidade is null or v_quantidade < 1 then
      raise exception 'Item ou quantidade inválida no pedido';
    end if;

    select p.nome,
      coalesce(
        (
          select o.preco_promocional
          from public.ofertas_relampago o
          where o.produto_id = p.id
            and v_data_loja between o.data_inicio and o.data_fim
          order by o.data_inicio desc
          limit 1
        ),
        p.preco_normal
      )
    into v_nome, v_preco
    from public.produtos p
    where p.id = v_produto_id and p.ativo;

    if not found then
      raise exception 'Produto indisponível: %', v_produto_id;
    end if;

    v_subtotal := round(v_preco * v_quantidade, 2);
    v_total := v_total + v_subtotal;
    v_itens := v_itens || jsonb_build_array(jsonb_build_object(
      'produto_id', v_produto_id,
      'nome', v_nome,
      'quantidade', v_quantidade,
      'preco_unitario', v_preco,
      'subtotal', v_subtotal
    ));
  end loop;

  new.itens_json := v_itens;
  new.total := v_total;
  new.status := 'recebido';
  new.criado_em := coalesce(new.criado_em, now());
  return new;
end;
$$;

drop trigger if exists preparar_pedido_antes_de_inserir on public.pedidos;
create trigger preparar_pedido_antes_de_inserir
  before insert on public.pedidos
  for each row execute function public.preparar_pedido();

create table if not exists public.gestores (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

create table if not exists public.encartes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  validade date not null,
  arquivo_url text not null,
  arquivo_nome text not null,
  atualizado_em timestamptz not null default now()
);

create index if not exists encartes_validade_atualizado_em_idx
  on public.encartes (validade, atualizado_em desc);

create table if not exists public.configuracoes_site (
  id text primary key check (id = 'principal'),
  dados jsonb not null,
  venda_online_ativa boolean not null default true,
  atualizado_em timestamptz not null default now()
);

do $$
declare
  v_id_type text;
  v_json_column text;
begin
  if to_regclass('public.configuracoes_site') is null then
    return;
  end if;

  select data_type
    into v_id_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'configuracoes_site'
      and column_name = 'id';

  if v_id_type is null then
    raise exception 'A tabela public.configuracoes_site precisa ter uma coluna id.';
  end if;

  if v_id_type <> 'text' then
    alter table public.configuracoes_site alter column id drop identity if exists;
    alter table public.configuracoes_site alter column id drop default;
    alter table public.configuracoes_site
      alter column id type text using id::text;
  end if;

  alter table public.configuracoes_site
    add column if not exists dados jsonb;
  alter table public.configuracoes_site
    add column if not exists venda_online_ativa boolean not null default true;
  alter table public.configuracoes_site
    add column if not exists atualizado_em timestamptz not null default now();

  select column_name
    into v_json_column
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'configuracoes_site'
      and column_name in (
        'configuracoes',
        'config',
        'settings',
        'config_json',
        'settings_json'
      )
      and data_type in ('json', 'jsonb')
    order by case column_name
      when 'configuracoes' then 1
      when 'config' then 2
      when 'settings' then 3
      when 'config_json' then 4
      else 5
    end
    limit 1;

  if v_json_column is not null then
    execute format(
      'update public.configuracoes_site
       set dados = %I
       where dados is null and %I is not null',
      v_json_column,
      v_json_column
    );
  end if;

  update public.configuracoes_site set dados = '{}'::jsonb where dados is null;
  alter table public.configuracoes_site alter column dados set not null;
end;
$$;

do $$
declare
  v_data_column text;
  v_order_clause text;
  v_has_id boolean;
begin
  if to_regclass('public.configuracoes_loja') is null then
    return;
  end if;

  select column_name
    into v_data_column
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'configuracoes_loja'
      and column_name in (
        'dados',
        'configuracoes',
        'config',
        'settings',
        'config_json',
        'settings_json'
      )
    order by case column_name
      when 'dados' then 1
      when 'configuracoes' then 2
      when 'config' then 3
      when 'settings' then 4
      when 'config_json' then 5
      else 6
    end
    limit 1;

  if v_data_column is null then
    raise notice 'A tabela public.configuracoes_loja não tem uma coluna JSON de configurações reconhecida; os dados não foram migrados automaticamente.';
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'configuracoes_loja'
      and column_name = 'id'
  )
  into v_has_id;

  v_order_clause := case
    when v_has_id then 'case when legacy.id::text = ''principal'' then 0 else 1 end'
    else '1'
  end;

  execute format(
    'insert into public.configuracoes_site (id, dados, atualizado_em)
     select ''principal'', legacy.%I::jsonb, now()
     from public.configuracoes_loja as legacy
     where legacy.%I is not null
     order by %s
     limit 1
     on conflict (id) do nothing',
    v_data_column,
    v_data_column,
    v_order_clause
  );
end;
$$;

create or replace function public.eh_gestor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gestores where usuario_id = (select auth.uid())
  );
$$;

alter table public.produtos enable row level security;
alter table public.ofertas_relampago enable row level security;
alter table public.pedidos enable row level security;
alter table public.gestores enable row level security;
alter table public.encartes enable row level security;

drop policy if exists "Produtos ativos visíveis publicamente" on public.produtos;
create policy "Produtos ativos visíveis publicamente"
  on public.produtos for select to anon, authenticated
  using (ativo or public.eh_gestor());
drop policy if exists "Somente produtos ativos são públicos" on public.produtos;
create policy "Somente produtos ativos são públicos"
  on public.produtos as restrictive for select to anon, authenticated
  using (ativo or public.eh_gestor());
drop policy if exists "Gestores administram produtos" on public.produtos;
create policy "Gestores administram produtos"
  on public.produtos for all to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
drop policy if exists "Somente gestores inserem produtos" on public.produtos;
create policy "Somente gestores inserem produtos"
  on public.produtos as restrictive for insert to anon, authenticated
  with check (public.eh_gestor());
drop policy if exists "Somente gestores alteram produtos" on public.produtos;
create policy "Somente gestores alteram produtos"
  on public.produtos as restrictive for update to anon, authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
drop policy if exists "Somente gestores removem produtos" on public.produtos;
create policy "Somente gestores removem produtos"
  on public.produtos as restrictive for delete to anon, authenticated
  using (public.eh_gestor());

drop policy if exists "Ofertas vigentes visíveis publicamente" on public.ofertas_relampago;
drop policy if exists "Ofertas visíveis publicamente" on public.ofertas_relampago;
create policy "Ofertas visíveis publicamente"
  on public.ofertas_relampago for select to anon, authenticated
  using (true);
drop policy if exists "Gestores administram ofertas" on public.ofertas_relampago;
create policy "Gestores administram ofertas"
  on public.ofertas_relampago for all to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
drop policy if exists "Somente gestores alteram ofertas" on public.ofertas_relampago;
create policy "Somente gestores alteram ofertas"
  on public.ofertas_relampago as restrictive for insert to anon, authenticated
  with check (public.eh_gestor());
drop policy if exists "Somente gestores atualizam ofertas" on public.ofertas_relampago;
create policy "Somente gestores atualizam ofertas"
  on public.ofertas_relampago as restrictive for update to anon, authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
drop policy if exists "Somente gestores removem ofertas" on public.ofertas_relampago;
create policy "Somente gestores removem ofertas"
  on public.ofertas_relampago as restrictive for delete to anon, authenticated
  using (public.eh_gestor());

drop policy if exists "Gestores consultam pedidos" on public.pedidos;
create policy "Gestores consultam pedidos"
  on public.pedidos for select to authenticated using (public.eh_gestor());
drop policy if exists "Dados dos pedidos privados" on public.pedidos;
create policy "Dados dos pedidos privados"
  on public.pedidos as restrictive for select to authenticated
  using (public.eh_gestor());
drop policy if exists "Pedidos não são públicos" on public.pedidos;
create policy "Pedidos não são públicos"
  on public.pedidos as restrictive for select to anon
  using (false);
drop policy if exists "Gestores atualizam pedidos" on public.pedidos;
create policy "Gestores atualizam pedidos"
  on public.pedidos for update to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
drop policy if exists "Somente gestores alteram pedidos" on public.pedidos;
create policy "Somente gestores alteram pedidos"
  on public.pedidos as restrictive for update to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
drop policy if exists "Somente gestores removem pedidos" on public.pedidos;
create policy "Somente gestores removem pedidos"
  on public.pedidos as restrictive for delete to anon, authenticated
  using (public.eh_gestor());
drop policy if exists "Clientes enviam pedidos" on public.pedidos;
create policy "Clientes enviam pedidos"
  on public.pedidos for insert to anon, authenticated
  with check (
    length(trim(cliente_nome)) >= 2
    and length(regexp_replace(cliente_telefone, '\D', '', 'g')) >= 8
    and jsonb_array_length(itens_json) > 0
    and total >= 0
    and status = 'recebido'
  );
drop policy if exists "Validação de pedidos enviados" on public.pedidos;
create policy "Validação de pedidos enviados"
  on public.pedidos as restrictive for insert to anon, authenticated
  with check (
    length(trim(cliente_nome)) >= 2
    and length(regexp_replace(cliente_telefone, '\D', '', 'g')) >= 8
    and jsonb_array_length(itens_json) > 0
    and total >= 0
    and status = 'recebido'
    and coalesce((
      select coalesce(
        venda_online_ativa,
        (dados ->> 'venda_online_ativa')::boolean,
        (dados ->> 'commerceEnabled')::boolean
      )
      from public.configuracoes_site where id = 'principal'
    ), true)
    and case metodo_pagamento
      when 'pix' then coalesce((select (dados #>> '{payments,pix,enabled}')::boolean from public.configuracoes_site where id = 'principal'), true)
      when 'card' then coalesce((select (dados #>> '{payments,cardOnDelivery}')::boolean from public.configuracoes_site where id = 'principal'), true)
      when 'cash' then coalesce((select (dados #>> '{payments,cash}')::boolean from public.configuracoes_site where id = 'principal'), true)
      when 'food_voucher' then coalesce((select (dados #>> '{payments,foodVoucher}')::boolean from public.configuracoes_site where id = 'principal'), false)
      else false
    end
  );

drop policy if exists "Gestores consultam equipe" on public.gestores;
create policy "Gestores consultam equipe"
  on public.gestores for select to authenticated using (usuario_id = (select auth.uid()));
drop policy if exists "Somente titular consulta vínculo de gestor" on public.gestores;
create policy "Somente titular consulta vínculo de gestor"
  on public.gestores as restrictive for select to authenticated
  using (usuario_id = (select auth.uid()));
drop policy if exists "Vínculos de gestores não são públicos" on public.gestores;
create policy "Vínculos de gestores não são públicos"
  on public.gestores as restrictive for select to anon
  using (false);

drop policy if exists "Encarte atual visível publicamente" on public.encartes;
create policy "Encarte atual visível publicamente"
  on public.encartes for select to anon, authenticated using (true);
drop policy if exists "Gestores administram encartes" on public.encartes;
create policy "Gestores administram encartes"
  on public.encartes for all to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
drop policy if exists "Somente gestores inserem encartes" on public.encartes;
create policy "Somente gestores inserem encartes"
  on public.encartes as restrictive for insert to authenticated
  with check (public.eh_gestor());
drop policy if exists "Somente gestores atualizam encartes" on public.encartes;
create policy "Somente gestores atualizam encartes"
  on public.encartes as restrictive for update to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
drop policy if exists "Somente gestores removem encartes" on public.encartes;
create policy "Somente gestores removem encartes"
  on public.encartes as restrictive for delete to authenticated
  using (public.eh_gestor());
drop policy if exists "Anônimos não inserem encartes" on public.encartes;
create policy "Anônimos não inserem encartes"
  on public.encartes as restrictive for insert to anon
  with check (false);
drop policy if exists "Anônimos não alteram encartes" on public.encartes;
create policy "Anônimos não alteram encartes"
  on public.encartes as restrictive for update to anon
  using (false) with check (false);
drop policy if exists "Anônimos não removem encartes" on public.encartes;
create policy "Anônimos não removem encartes"
  on public.encartes as restrictive for delete to anon
  using (false);

grant select on public.produtos, public.ofertas_relampago, public.encartes to anon, authenticated;
grant insert on public.pedidos to anon, authenticated;
grant select, update on public.pedidos to authenticated;
grant select on public.gestores to authenticated;
grant insert, update, delete on public.produtos, public.ofertas_relampago, public.encartes to authenticated;

create or replace function public.salvar_oferta(
  p_id uuid,
  p_produto_id text,
  p_preco_normal numeric,
  p_preco_promocional numeric,
  p_data_inicio date,
  p_data_fim date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_preco_normal <= 0 or p_preco_promocional <= 0
     or p_preco_promocional >= p_preco_normal
     or p_data_fim < p_data_inicio then
    raise exception 'Dados da oferta inválidos';
  end if;

  update public.produtos
  set preco_normal = p_preco_normal, preco_oferta = p_preco_promocional
  where id = p_produto_id;
  if not found then
    raise exception 'Produto não encontrado';
  end if;

  if p_id is null then
    insert into public.ofertas_relampago
      (produto_id, preco_promocional, data_inicio, data_fim)
    values
      (p_produto_id, p_preco_promocional, p_data_inicio, p_data_fim)
    returning id into v_id;
  else
    update public.ofertas_relampago
    set produto_id = p_produto_id,
        preco_promocional = p_preco_promocional,
        data_inicio = p_data_inicio,
        data_fim = p_data_fim
    where id = p_id
    returning id into v_id;
    if not found then
      raise exception 'Oferta não encontrada';
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.remover_oferta(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_produto_id text;
begin
  select produto_id into v_produto_id
  from public.ofertas_relampago
  where id = p_id;
  if not found then
    raise exception 'Oferta não encontrada';
  end if;

  delete from public.ofertas_relampago where id = p_id;
  update public.produtos set preco_oferta = null where id = v_produto_id;
end;
$$;

grant execute on function public.salvar_oferta(uuid, text, numeric, numeric, date, date) to authenticated;
grant execute on function public.remover_oferta(uuid) to authenticated;
revoke all on function public.salvar_oferta(uuid, text, numeric, numeric, date, date) from public, anon;
revoke all on function public.remover_oferta(uuid) from public, anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('encartes', 'encartes', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Encartes públicos podem ser lidos" on storage.objects;
create policy "Encartes públicos podem ser lidos"
  on storage.objects for select to anon, authenticated using (bucket_id = 'encartes');
drop policy if exists "Gestores fazem upload de encartes" on storage.objects;
create policy "Gestores fazem upload de encartes"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'encartes' and public.eh_gestor());
drop policy if exists "Gestores atualizam encartes" on storage.objects;
create policy "Gestores atualizam encartes"
  on storage.objects for update to authenticated
  using (bucket_id = 'encartes' and public.eh_gestor())
  with check (bucket_id = 'encartes' and public.eh_gestor());
drop policy if exists "Gestores removem encartes" on storage.objects;
create policy "Gestores removem encartes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'encartes' and public.eh_gestor());
drop policy if exists "Somente gestores alteram arquivos de encarte" on storage.objects;
drop policy if exists "Somente gestores inserem arquivos de encarte" on storage.objects;
create policy "Somente gestores inserem arquivos de encarte"
  on storage.objects as restrictive for insert to anon, authenticated
  with check (bucket_id <> 'encartes' or public.eh_gestor());
drop policy if exists "Somente gestores atualizam arquivos de encarte" on storage.objects;
create policy "Somente gestores atualizam arquivos de encarte"
  on storage.objects as restrictive for update to anon, authenticated
  using (bucket_id <> 'encartes' or public.eh_gestor())
  with check (bucket_id <> 'encartes' or public.eh_gestor());
drop policy if exists "Somente gestores removem arquivos de encarte" on storage.objects;
create policy "Somente gestores removem arquivos de encarte"
  on storage.objects as restrictive for delete to anon, authenticated
  using (bucket_id <> 'encartes' or public.eh_gestor());
drop policy if exists "Anônimos não alteram arquivos de encarte" on storage.objects;
create policy "Anônimos não alteram arquivos de encarte"
  on storage.objects as restrictive for insert to anon
  with check (bucket_id <> 'encartes');
drop policy if exists "Anônimos não atualizam arquivos de encarte" on storage.objects;
create policy "Anônimos não atualizam arquivos de encarte"
  on storage.objects as restrictive for update to anon
  using (bucket_id <> 'encartes') with check (bucket_id <> 'encartes');
drop policy if exists "Anônimos não removem arquivos de encarte" on storage.objects;
create policy "Anônimos não removem arquivos de encarte"
  on storage.objects as restrictive for delete to anon
  using (bucket_id <> 'encartes');

create table if not exists public.configuracoes_site (
  id text primary key check (id = 'principal'),
  dados jsonb not null,
  venda_online_ativa boolean not null default true,
  atualizado_em timestamptz not null default now()
);

insert into public.configuracoes_site (id, dados)
values (
  'principal',
  '{
    "venda_online_ativa": true,
    "commerceEnabled": true,
    "payments": {
      "pix": {"enabled": true, "key": ""},
      "cardOnDelivery": true,
      "cash": true,
      "foodVoucher": false
    },
    "pwa": {
      "enabled": true,
      "googlePlay": {"enabled": false, "url": ""},
      "appStore": {"enabled": false, "url": ""}
    },
    "channels": {
      "whatsappEnabled": true,
      "whatsappNumber": "551140044040",
      "ifoodEnabled": true,
      "ifoodUrl": "",
      "offersGroupUrl": ""
    },
    "features": {"cardApplicationsEnabled": true, "clubEnabled": true},
    "topbar": {"enabled": true, "text": "Entrega grátis na primeira compra acima de R$ 150"},
    "institution": {
      "address": "Rua das Palmeiras, 120 — Centro",
      "phone": "(11) 4004-4040",
      "email": "atendimento@verdevale.com.br",
      "hours": "Segunda a sábado, das 7h às 21h · Domingo, das 8h às 14h",
      "facebook": "",
      "instagram": "",
      "branches": [
        {"id": "centro", "name": "VerdeVale Centro", "address": "Rua das Palmeiras, 120 — Centro"}
      ]
    },
    "bioLinks": [
      {"label": "Ofertas relâmpago", "url": "/catalogo?ofertas=1", "enabled": true},
      {"label": "Panfleto de Ofertas", "url": "/panfleto-de-ofertas", "enabled": true},
      {"label": "Clube SuperVerde", "url": "/clube", "enabled": true},
      {"label": "Trabalhe conosco", "url": "/trabalhe-conosco", "enabled": true},
      {"label": "WhatsApp", "url": "", "enabled": true}
    ],
    "banners": {
      "mainImage": "",
      "mainTitle": "A semana mais fresca do ano.",
      "mainSubtitle": "Hortifrúti selecionado com preços especiais.",
      "campaigns": [
        {
          "id": "hortifruti",
          "eyebrow": "É tempo de coisa boa",
          "title": "A semana mais fresca do ano.",
          "subtitle": "Hortifrúti selecionado com preços especiais.",
          "button": "Explorar a feirinha",
          "image": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1800&q=90"
        },
        {
          "id": "carnes",
          "eyebrow": "Seu churrasco merece",
          "title": "O melhor do fim de semana começa aqui.",
          "subtitle": "Cortes especiais, acompanhamentos fresquinhos e tudo para reunir quem você gosta.",
          "button": "Ver ofertas de carnes",
          "image": "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1800&q=90"
        },
        {
          "id": "praticidade",
          "eyebrow": "Praticidade todo dia",
          "title": "Sua despensa cheia. Seu tempo livre também.",
          "subtitle": "Receba em casa os favoritos da família com entrega rápida e cuidado de verdade.",
          "button": "Fazer minhas compras",
          "image": "https://images.unsplash.com/photo-1543168256-418811576931?auto=format&fit=crop&w=1800&q=90"
        }
      ],
      "secondaryImage": "",
      "tertiaryImage": ""
    }
  }'::jsonb
)
on conflict (id) do update
  set dados = excluded.dados
  where public.configuracoes_site.dados = '{}'::jsonb;

alter table public.pedidos
  add column if not exists cliente_id uuid references auth.users(id) on delete set null;
alter table public.pedidos
  add column if not exists metodo_entrega text not null default 'delivery';
alter table public.pedidos
  add column if not exists metodo_pagamento text not null default 'pix';
alter table public.pedidos
  add column if not exists troco_para numeric(12, 2);
alter table public.pedidos
  drop constraint if exists pedidos_metodo_entrega_check;
alter table public.pedidos
  add constraint pedidos_metodo_entrega_check
  check (metodo_entrega in ('delivery', 'pickup'));
alter table public.pedidos
  drop constraint if exists pedidos_metodo_pagamento_check;
alter table public.pedidos
  add constraint pedidos_metodo_pagamento_check
  check (metodo_pagamento in ('pix', 'card', 'cash', 'food_voucher'));
alter table public.pedidos
  drop constraint if exists pedidos_troco_para_check;
alter table public.pedidos
  add constraint pedidos_troco_para_check
  check (troco_para is null or troco_para >= total);

create or replace function public.vincular_cliente_pedido()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.cliente_id := (select auth.uid());
  return new;
end;
$$;

drop trigger if exists 00_vincular_cliente_pedido on public.pedidos;
create trigger 00_vincular_cliente_pedido
  before insert on public.pedidos
  for each row execute function public.vincular_cliente_pedido();

drop policy if exists "Dados dos pedidos privados" on public.pedidos;
create policy "Dados dos pedidos privados"
  on public.pedidos as restrictive for select to authenticated
  using (public.eh_gestor() or cliente_id = (select auth.uid()));
drop policy if exists "Clientes consultam próprios pedidos" on public.pedidos;
create policy "Clientes consultam próprios pedidos"
  on public.pedidos for select to authenticated
  using (cliente_id = (select auth.uid()));

create table if not exists public.listas_compras (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 1 and 80),
  itens_json jsonb not null default '[]'::jsonb check (jsonb_typeof(itens_json) = 'array'),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.solicitacoes_cartao (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid default auth.uid() references auth.users(id) on delete set null,
  nome text not null check (length(trim(nome)) between 2 and 120),
  cpf text not null check (length(regexp_replace(cpf, '\D', '', 'g')) = 11),
  telefone text not null check (length(regexp_replace(telefone, '\D', '', 'g')) between 10 and 13),
  email text not null check (length(trim(email)) <= 254),
  data_nascimento date,
  criado_em timestamptz not null default now()
);

create table if not exists public.candidaturas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid default auth.uid() references auth.users(id) on delete set null,
  nome text not null check (length(trim(nome)) between 2 and 120),
  contato text not null check (length(trim(contato)) between 8 and 80),
  cargo_desejado text not null check (length(trim(cargo_desejado)) between 2 and 120),
  curriculo_texto text not null default '' check (length(curriculo_texto) <= 20000),
  arquivo_path text,
  criado_em timestamptz not null default now(),
  check (length(trim(curriculo_texto)) > 0 or arquivo_path is not null)
);

create table if not exists public.clube_cadastros (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid default auth.uid() references auth.users(id) on delete set null,
  nome text not null check (length(trim(nome)) between 2 and 120),
  telefone text not null check (length(regexp_replace(telefone, '\D', '', 'g')) between 10 and 13),
  email text,
  criado_em timestamptz not null default now()
);

create table if not exists public.metricas_visita (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('visit', 'flyer_view')),
  visitante_id uuid not null,
  data_evento date not null default (now() at time zone 'America/Sao_Paulo')::date,
  criado_em timestamptz not null default now(),
  unique (tipo, visitante_id, data_evento)
);

alter table public.configuracoes_site enable row level security;
alter table public.listas_compras enable row level security;
alter table public.solicitacoes_cartao enable row level security;
alter table public.candidaturas enable row level security;
alter table public.clube_cadastros enable row level security;
alter table public.metricas_visita enable row level security;

drop policy if exists "Configurações públicas da loja" on public.configuracoes_site;
create policy "Configurações públicas da loja"
  on public.configuracoes_site for select to anon, authenticated using (true);
drop policy if exists "Gestores alteram configurações da loja" on public.configuracoes_site;
create policy "Gestores alteram configurações da loja"
  on public.configuracoes_site for all to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
drop policy if exists "Somente gestores inserem configurações" on public.configuracoes_site;
create policy "Somente gestores inserem configurações"
  on public.configuracoes_site as restrictive for insert to anon, authenticated
  with check (public.eh_gestor());
drop policy if exists "Somente gestores atualizam configurações" on public.configuracoes_site;
create policy "Somente gestores atualizam configurações"
  on public.configuracoes_site as restrictive for update to anon, authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
drop policy if exists "Somente gestores removem configurações" on public.configuracoes_site;
create policy "Somente gestores removem configurações"
  on public.configuracoes_site as restrictive for delete to anon, authenticated
  using (public.eh_gestor());

drop policy if exists "Clientes administram suas listas" on public.listas_compras;
create policy "Clientes administram suas listas"
  on public.listas_compras for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
drop policy if exists "Listas privadas" on public.listas_compras;
create policy "Listas privadas"
  on public.listas_compras as restrictive for all to anon, authenticated
  using (auth.uid() is not null and usuario_id = (select auth.uid()))
  with check (auth.uid() is not null and usuario_id = (select auth.uid()));

drop policy if exists "Solicitação de cartão habilitada" on public.solicitacoes_cartao;
create policy "Solicitação de cartão habilitada"
  on public.solicitacoes_cartao for insert to anon, authenticated
  with check (
    coalesce((
      select (dados #>> '{features,cardApplicationsEnabled}')::boolean
      from public.configuracoes_site where id = 'principal'
    ), true)
  );
drop policy if exists "Gestores consultam solicitações de cartão" on public.solicitacoes_cartao;
create policy "Gestores consultam solicitações de cartão"
  on public.solicitacoes_cartao for select to authenticated using (public.eh_gestor());
drop policy if exists "Solicitações de cartão privadas" on public.solicitacoes_cartao;
create policy "Solicitações de cartão privadas"
  on public.solicitacoes_cartao as restrictive for select to anon, authenticated
  using (public.eh_gestor());

drop policy if exists "Candidatos enviam currículos" on public.candidaturas;
create policy "Candidatos enviam currículos"
  on public.candidaturas for insert to anon, authenticated with check (true);
drop policy if exists "Gestores consultam candidaturas" on public.candidaturas;
create policy "Gestores consultam candidaturas"
  on public.candidaturas for select to authenticated using (public.eh_gestor());
drop policy if exists "Currículos privados" on public.candidaturas;
create policy "Currículos privados"
  on public.candidaturas as restrictive for select to anon, authenticated
  using (public.eh_gestor());

drop policy if exists "Cadastro de clube habilitado" on public.clube_cadastros;
create policy "Cadastro de clube habilitado"
  on public.clube_cadastros for insert to anon, authenticated
  with check (
    coalesce((
      select (dados #>> '{features,clubEnabled}')::boolean
      from public.configuracoes_site where id = 'principal'
    ), true)
  );
drop policy if exists "Gestores consultam cadastros do clube" on public.clube_cadastros;
create policy "Gestores consultam cadastros do clube"
  on public.clube_cadastros for select to authenticated using (public.eh_gestor());
drop policy if exists "Cadastros do clube privados" on public.clube_cadastros;
create policy "Cadastros do clube privados"
  on public.clube_cadastros as restrictive for select to anon, authenticated
  using (public.eh_gestor());

drop policy if exists "Visitantes registram métricas básicas" on public.metricas_visita;
create policy "Visitantes registram métricas básicas"
  on public.metricas_visita for insert to anon, authenticated
  with check (
    data_evento between (now() at time zone 'America/Sao_Paulo')::date - 1
      and (now() at time zone 'America/Sao_Paulo')::date
  );
drop policy if exists "Gestores consultam métricas" on public.metricas_visita;
create policy "Gestores consultam métricas"
  on public.metricas_visita for select to authenticated using (public.eh_gestor());
drop policy if exists "Métricas privadas" on public.metricas_visita;
create policy "Métricas privadas"
  on public.metricas_visita as restrictive for select to anon, authenticated
  using (public.eh_gestor());

grant select on public.configuracoes_site to anon, authenticated;
grant insert, update, delete on public.configuracoes_site to authenticated;
grant select, insert, update, delete on public.listas_compras to authenticated;
grant select, insert on public.solicitacoes_cartao, public.candidaturas, public.clube_cadastros to anon, authenticated;
grant select on public.solicitacoes_cartao, public.candidaturas, public.clube_cadastros to authenticated;
grant select, insert on public.metricas_visita to anon, authenticated;

create or replace function public.importar_precos(p_linhas jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_linha jsonb;
  v_id text;
  v_preco numeric(12, 2);
  v_estoque integer;
  v_atualizados integer := 0;
  v_total integer;
begin
  if not public.eh_gestor() then
    raise exception 'Apenas gestores podem importar preços';
  end if;
  if jsonb_typeof(p_linhas) <> 'array' then
    raise exception 'Envie uma lista de linhas CSV válida';
  end if;
  v_total := jsonb_array_length(p_linhas);
  if v_total < 1 or v_total > 5000 then
    raise exception 'A importação deve conter de 1 a 5000 produtos';
  end if;

  for v_linha in select value from jsonb_array_elements(p_linhas)
  loop
    v_id := nullif(trim(v_linha ->> 'id'), '');
    v_preco := (v_linha ->> 'preco_normal')::numeric;
    v_estoque := nullif(v_linha ->> 'estoque', '')::integer;
    if v_id is null or v_preco is null or v_preco < 0
       or (v_estoque is not null and v_estoque < 0) then
      raise exception 'Linha com ID, preço ou estoque inválido';
    end if;

    update public.produtos
      set preco_normal = v_preco,
          estoque = coalesce(v_estoque, estoque),
          preco_oferta = null,
          updated_at = now()
      where id = v_id;
    if not found then
      raise exception 'Produto não encontrado: %', v_id;
    end if;
    v_atualizados := v_atualizados + 1;
  end loop;
  return v_atualizados;
end;
$$;

grant execute on function public.importar_precos(jsonb) to authenticated;
revoke all on function public.importar_precos(jsonb) from public, anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'curriculos',
  'curriculos',
  false,
  5242880,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Candidatos enviam seus arquivos privados" on storage.objects;
create policy "Candidatos enviam seus arquivos privados"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'curriculos');
drop policy if exists "Gestores leem currículos" on storage.objects;
create policy "Gestores leem currículos"
  on storage.objects for select to authenticated
  using (bucket_id = 'curriculos' and public.eh_gestor());
drop policy if exists "Gestores removem currículos" on storage.objects;
create policy "Gestores removem currículos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'curriculos' and public.eh_gestor());
drop policy if exists "Anônimos não alteram arquivos de encarte" on storage.objects;
create policy "Anônimos não alteram arquivos de encarte"
  on storage.objects as restrictive for update to anon
  using (bucket_id <> 'encartes')
  with check (bucket_id <> 'encartes');
drop policy if exists "Anônimos não removem arquivos de encarte" on storage.objects;
create policy "Anônimos não removem arquivos de encarte"
  on storage.objects as restrictive for delete to anon
  using (bucket_id <> 'encartes');
drop policy if exists "Anônimos não inserem encartes" on storage.objects;
create policy "Anônimos não inserem encartes"
  on storage.objects as restrictive for insert to anon
  with check (bucket_id <> 'encartes');

create or replace function public.validar_configuracao_pedido()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_config jsonb;
begin
  select dados into v_config
    from public.configuracoes_site where id = 'principal';
  if coalesce(
    (v_config ->> 'venda_online_ativa')::boolean,
    (v_config ->> 'commerceEnabled')::boolean,
    true
  ) is false then
    raise exception 'As compras online estão temporariamente desativadas';
  end if;
  if not coalesce(case new.metodo_pagamento
    when 'pix' then (v_config #>> '{payments,pix,enabled}')::boolean
    when 'card' then (v_config #>> '{payments,cardOnDelivery}')::boolean
    when 'cash' then (v_config #>> '{payments,cash}')::boolean
    when 'food_voucher' then (v_config #>> '{payments,foodVoucher}')::boolean
    else false
  end, false) then
    raise exception 'A forma de pagamento selecionada não está habilitada';
  end if;
  return new;
end;
$$;

drop trigger if exists 01_validar_configuracao_pedido on public.pedidos;
create trigger 01_validar_configuracao_pedido
  before insert on public.pedidos
  for each row execute function public.validar_configuracao_pedido();

create table if not exists public.push_subscriptions (
  endpoint text primary key check (length(endpoint) between 1 and 2048),
  subscription jsonb not null check (jsonb_typeof(subscription) = 'object'),
  usuario_id uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from public, anon, authenticated;
grant all on table public.push_subscriptions to service_role;

notify pgrst, 'reload schema';
