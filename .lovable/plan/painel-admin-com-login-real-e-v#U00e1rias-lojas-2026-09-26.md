# Painel admin com login real e várias lojas

## O que você vai ter
1. **Login real** em /auth com e-mail e senha (e Google). A primeira conta criada vira administradora. Inclui "Esqueci minha senha" e página para criar senha nova. O cabeçalho do painel mostra quem está logado e o botão Sair.
2. **Painel de lojas** (/admin/lojas): criar, editar, duplicar e excluir lojas. Cada loja tem os próprios dados: nome, endereço (ex.: /loja/minha-loja), logo do cabeçalho, logo do rodapé, texto do rodapé, políticas, perfil (capa, banner, indicadores, destaques) e a logo e as cores do checkout.
3. **Visão geral** (/admin): três listas em abas, com busca e filtros, sem abrir cada página:
   - **Lojas:** nome, endereço, número de produtos, ativa/inativa.
   - **Produtos:** loja, nome, preço, estoque, ativo. Preço, estoque e ativo editáveis direto na lista. Filtro por loja.
   - **Avaliações:** produto, cliente, estrelas, data, "Compra confirmada". Dá para editar, ocultar ou excluir direto na lista.
   - O editor completo de produto (arrastar vídeos e blocos) continua abrindo pelo botão Editar.
4. **Na vitrine:** cada produto pertence a uma loja. A página do produto, o checkout e a confirmação do pedido mostram o cabeçalho e o rodapé da loja do produto. A loja atual continua em /loja como principal e as novas ficam em /loja/{endereço}.

## Regras mantidas
- A loja e o produto de hoje passam a ser a "Loja principal", sem perder nada.
- Não dá para excluir uma loja que ainda tem produtos ou pedidos: antes é preciso mover ou excluir os produtos dela.
- O design da vitrine não muda.

## Detalhes técnicos
- Nova tabela `stores` com slug único e campos iguais aos de `store_settings`, além de `checkout` jsonb e `active`. A linha atual é copiada para ela com `is_default=true`. `products.store_id` recebe o valor da loja principal nos produtos existentes. `orders.store_id` é guardado no momento do pedido.
- Regras de acesso: lojas ativas podem ser lidas por todos, e só administradores (`has_role`) alteram dados.
- As avaliações continuam em `products.reviews` (jsonb). A lista de avaliações lê e grava no produto pelo índice.
- Rotas: `/admin` (visão geral), `/admin/lojas`, `/admin/lojas/$id`, `/loja/$slug`, `/reset-password`. Ativar login por e-mail e Google.
- `getStoreSettings` passa a receber o slug da loja ou o id do produto. `StoreHeader`, `StoreFooter` e o topo do checkout usam a loja resolvida.
