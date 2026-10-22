Template de e-commerce para supermercados feito com Next.js, Tailwind CSS,
Supabase e Lucide React.

## Configuração

Copie `.env.example` para `.env.local` e configure as credenciais do Supabase,
`NEXT_PUBLIC_SITE_URL` com a URL HTTPS pública do site, o telefone WhatsApp da
loja (com código do país e DDD), o link oficial da loja no iFood e o valor
mínimo para entrega em reais.

Execute o script atualizado [`supabase/schema.sql`](./supabase/schema.sql)
no SQL Editor do Supabase. Além do catálogo, ofertas, pedidos, gestores e
encartes, ele configura `configuracoes_site`, listas de compras vinculadas à
conta, cadastros do Cartão da Loja e do Clube, candidaturas, métricas,
políticas RLS e os buckets público `encartes` e privado `curriculos`.
`configuracoes_site` é o nome canônico usado pelo aplicativo, pelo checkout e
pelo painel. Se existir a tabela legada `configuracoes_loja`, o script tenta
copiar uma linha de configuração JSON para `configuracoes_site` sem substituir
configurações já existentes; a tabela antiga é preservada. Se ela não tiver uma
coluna JSON reconhecida, o SQL informa isso e os dados precisam ser mapeados
manualmente antes da migração. O script também solicita a atualização do cache
de schema da API do Supabase.

O script é repetível para os objetos que gerencia, mas revise diferenças de
tipos/constraints em tabelas preexistentes antes de aplicá-lo em produção. Em
particular, `produtos.id` deve ser compatível com `text`.

Para habilitar o painel:

1. Crie o usuário do gerente em **Authentication → Users** no Supabase.
2. Cadastre o UUID desse usuário como gestor usando o SQL Editor:

   ```sql
   insert into public.gestores (usuario_id)
   values ('UUID_DO_USUARIO_AUTH');
   ```

3. Entre em `/admin` com o e-mail e senha criados no Supabase Auth.

Para habilitar cadastro/login de clientes, deixe o provedor **Email** ativo em
Supabase Auth e configure a confirmação de e-mail conforme a política da loja.
Clientes autenticados veem somente seus próprios pedidos e listas; gestores
autorizados veem os pedidos e formulários recebidos.

O cliente público usa apenas `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY`; nunca coloque a service-role key no navegador.
O acesso de gerência e as escritas são protegidos pelas políticas RLS e pela
tabela `gestores`.

### Web Push

Gere um par VAPID estável (`npx web-push generate-vapid-keys`) e configure no
`.env.local`:

```dotenv
NEXT_PUBLIC_VAPID_PUBLIC_KEY=chave-publica
VAPID_PRIVATE_KEY=chave-privada
VAPID_SUBJECT=mailto:contato@seudominio.com.br
SUPABASE_SERVICE_ROLE_KEY=chave-service-role
```

Use a mesma chave VAPID em todos os deploys; alterá-la invalida as inscrições
existentes. A chave privada VAPID e a `SUPABASE_SERVICE_ROLE_KEY` são exclusivas
do servidor e não devem ter o prefixo `NEXT_PUBLIC_`, ser commitadas ou
compartilhadas. A service-role key pode ser copiada de **Project Settings →
API** no Supabase. Reinicie o servidor após configurar variáveis de ambiente.

Execute novamente `supabase/schema.sql` para criar `push_subscriptions`. A
tabela não permite leitura/escrita direta por clientes; as rotas de servidor
validam as inscrições e somente gestores autenticados podem disparar mensagens.
O banner do site pede autorização apenas após ação explícita do visitante. Push
exige HTTPS em produção (localhost é aceito para desenvolvimento) e suporte do
navegador; no iOS, o site precisa estar instalado na tela inicial. O painel
aceita título de até 80 caracteres, mensagem de até 240 e caminho interno como
`/panfleto-de-ofertas`. Inscrições expiradas são removidas durante os envios.

O checkout grava endereço, entrega/retirada, pagamento escolhido e itens na
tabela `pedidos`; o banco confere os produtos e recalcula os preços. Quando o
canal WhatsApp estiver ativo, o pedido também abre uma mensagem formatada para
o número configurado pelo gestor. Não há captura/processamento de pagamento:
Pix, cartão na entrega, dinheiro/troco e vale-alimentação são opções
informativas para confirmação com a loja.

## Painel administrativo

O painel lê e atualiza produtos, ofertas, encartes, pedidos, configurações do
site e cadastros dos formulários. A aba **Configurações da Loja** controla
compras, pagamentos, canais, PWA/lojas de aplicativos, faixa de avisos,
contatos, filiais, banners, logotipo, paleta principal/secundária, textos
institucionais e links `/bio`. Os dados institucionais são persistidos em
`configuracoes_site.dados`; leitura pública é permitida e a escrita é
restringida por RLS a gestores autenticados. As redes sociais podem ser
configuradas além de Facebook e Instagram. Os links dos aplicativos aparecem
somente no rodapé e respeitam as opções ativadas pelo gestor. Métricas contam
visitantes únicos por dia (com identificador aleatório no navegador, sem
registrar IP).

Os campos **Cidade** e **Bairro** em Configurações da Loja alimentam os títulos,
descrições, metadados Open Graph e dados estruturados `GroceryStore` das páginas
públicas. Preencha a cidade/bairro de cada filial para identificação local
precisa. O domínio público precisa estar em `NEXT_PUBLIC_SITE_URL` para gerar
URLs canônicas e URLs absolutas para compartilhamento. Os metadados ajudam os
mecanismos de busca a compreender o site, mas não garantem posição ou
indexação; mantenha também endereço e conteúdo reais e consistentes.

Na aba **Ofertas relâmpago**, o gestor escolhe produto, preço promocional e
datas de início e término. A validade inclui os dois dias selecionados e
termina às 23h59 no horário de Brasília; o contador da Home e do Panfleto de
Ofertas acompanha a oferta ativa que termina primeiro.

O Panfleto de Ofertas está disponível em `/panfleto-de-ofertas`.
As receitas e sugestões do dia estão em `/receitas`; ingredientes vinculados
ao catálogo podem ser adicionados juntos à sacola.

O banner PWA funciona em navegadores compatíveis; no iOS as instruções explicam
como adicionar o site à tela inicial. Para que o service worker sirva a
instalação, publique o site em HTTPS. O nome e ícones do app estão no manifest;
os links da Play Store/App Store só devem ser habilitados após publicar os
respectivos apps.

### Importação de preços

Na aba **Produtos e preços**, importe um CSV UTF-8 com cabeçalho
`id,preco_normal` e, opcionalmente, `estoque` (separador vírgula ou ponto e
vírgula). `id` deve corresponder ao identificador já cadastrado em `produtos`.
A importação é transacional: IDs repetidos, desconhecidos ou valores inválidos
rejeitam toda a operação. Arquivos Excel não são aceitos nessa versão.

O encarte aceita imagens ou PDF de até 10 MB. Currículos PDF/DOC/DOCX são
armazenados em bucket privado de até 5 MB e os links de leitura no painel
expiram após cinco minutos. Os formulários de cartão/clube/candidatura contêm
dados pessoais; mantenha gestores autorizados atualizados e revise a política
de privacidade e os prazos de retenção antes de produção.

O texto de privacidade e o calendário sazonal são modelos iniciais. Complete
os dados legais da empresa, confirme feriados e revise o aviso com orientação
jurídica antes da publicação.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
