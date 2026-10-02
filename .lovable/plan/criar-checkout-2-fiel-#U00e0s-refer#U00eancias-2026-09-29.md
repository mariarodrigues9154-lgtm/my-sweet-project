# Criar Checkout 2 fiel às referências

## Resultado
Adicionar um segundo modelo de checkout ao projeto atual, selecionável por loja, mantendo o Checkout 1 intacto e compartilhando os mesmos produtos, pedidos, fretes e integração Wappi.

## Alterações
- Adicionar no painel de cada loja o seletor “Modelo de Checkout”: Checkout 1 — Atual ou Checkout 2 — Novo, salvo nas configurações da própria loja.
- Fazer “Comprar” abrir automaticamente o modelo escolhido pela loja dona do produto, sem duplicar a lógica de pedido ou pagamento.
- Criar o Checkout 2 mobile-first com a composição validada no link e nos prints: avaliação compacta, endereço, produto, quantidade, frete, desconto real, resumo detalhado, PIX, termos da loja, economia real e barra inferior fixa.
- Criar a tela dedicada “Adicionar o novo endereço”, com seções e campos na ordem da referência, máscaras brasileiras, consulta de CEP, validação, salvamento no rascunho e retorno automático ao Checkout 2.
- Mostrar o endereço salvo de forma compacta no topo, com telefone mascarado e opção de editar.
- Reutilizar as funções atuais que recalculam o pedido no servidor, aplicam as credenciais da loja, impedem PIX duplicado e consultam a confirmação da Wappi.
- Reutilizar a tela PIX existente no Checkout 2, ajustando apenas a apresentação independente quando necessário; preservar código completo, QR Code real, vencimento real, cópia, acesso ao pedido e atualização automática.
- Manter descontos, contadores e frete promocional condicionados exclusivamente aos dados reais do produto.

## Detalhes técnicos
- O modelo escolhido ficará no JSON `store_settings.checkout`, evitando uma nova tabela e mantendo configuração por `store_id`.
- O Checkout 1 continuará em `/pagamento`; o Checkout 2 terá rota própria e uma rota própria para endereço.
- `createOrder`, `createPixCharge` e `getPaymentStatus` continuarão sendo a única implementação de pedidos e PIX para ambos os modelos.
- As políticas serão vinculadas às páginas reais do projeto e nunca às páginas da referência.

## Verificação
- Conferir Checkout 2 em 360, 375, 390, 412 e 430 px, sem rolagem horizontal ou sobreposição.
- Testar: produto → comprar → checkout sem endereço → adicionar/preencher/salvar endereço → checkout com endereço → gerar PIX Wappi → QR Code → copiar código → ver pedido.
- Confirmar que atualizar a tela recupera a cobrança pendente e não cria outro PIX.
- Confirmar que o Checkout 1 continua abrindo e funcionando para uma loja configurada com o modelo atual.
- Validar compilação, erros visíveis e estados vazios/erro sem inventar dados.

## Limite do teste final
A criação e exibição de um PIX real podem ser testadas. A confirmação `PAID` só pode ser concluída após um pagamento bancário real; até lá, será validado que um aviso isolado não aprova o pedido sem confirmação da Wappi.
