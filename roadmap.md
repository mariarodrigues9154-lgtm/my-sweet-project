# Roadmap

## Textos editáveis da barra por produto (25/10/2026)
- [ ] Adicionar texto destacado e complementar na configuração existente, sem destaque baseado em palavras
- [ ] Validar edição independente, visual móvel e persistência/sincronização do cronômetro sem alterar sua lógica

## Gateway WestPay (24/10/2026)
- [x] Ler documentação oficial completa e auditar arquitetura existente
- [x] Adicionar WestPay ao painel e pagamentos atuais com contrato oficial; conferir painel autenticado sem trocar gateways reais
- [x] Validar criação, consulta, transição de pagamento, isolamento e tratamento incerto com testes simulados; testes reais dependem de credenciais
- [ ] Testar PIX real pago e rastreamento (depende de credenciais WestPay e pagamento autorizado)
- [x] Entregar relatório com contrato oficial, alterações, testes e limitações

## Barra inferior de cupom (24/10/2026)
- [x] Ajustar somente o visual da barra conforme a referência, preservando configuração e cronômetro
- [x] Conferir visual e X em prévia isolada mobile/desktop, abertura da compra no produto e 10 testes de configuração/cronômetro (produtos consultados estavam com barra desativada)

## Auditoria UTMify → Meta (24/10/2026)
- [x] Conferir configuração, vendas e horários reais dos últimos 7 dias
- [x] Auditar UTMs, Purchase, deduplicação, webhooks e retries sem criar outra integração
- [x] Validar navegação e simulações de rastreamento sem cobrar clientes (duas lojas; 31 testes)
- [x] Adicionar diagnóstico de horários por tentativa UTMify, sem alterar pagamentos ou instalar Pixel
- [x] Apresentar relatório com limites de verificação
- [ ] Validar troca do Pixel UTMify entre lojas no checkout publicado: identificador muda para loja padrão; depende de confirmar comportamento suportado pelo script externo antes de alterar sua inicialização
- [ ] Confirmar pagamento de teste, recebimento/atribuição na Meta e horário da notificação (depende de pagamento de teste e acesso aos registros externos)

- [x] Aproximar cabeçalho, compra e checkout das referências enviadas
- [x] Adicionar quatro controles independentes do selo verificado no painel
- [x] Validar o fluxo de produto até a primeira etapa do checkout em celular e a vitrine em desktop

- [ ] Aplicar logo enviada no cabeçalho, perfil, rodapé e favicon
- [ ] Refinar proteção, vídeos, avaliações, perfil da loja, chat e seção sobre o produto
- [ ] Ampliar o painel para editar todos os conteúdos pedidos
- [ ] Adicionar e preencher os campos de perfil da loja que faltam
- [ ] Validar vitrine em celular e desktop e conferir erros
- [x] Criar página completa da loja em /loja com abas e produtos dinâmicos
- [x] Adicionar controles da página da loja e políticas ao admin
- [x] Criar páginas de políticas e validar a nova vitrine no mobile

## Pagamentos por loja
- [x] Configuração de gateway própria por loja (Mercado Pago, Asaas)
- [x] Credenciais somente no servidor, mascaradas no painel
- [x] Testar conexão no painel
- [x] PIX real criado pelo gateway da loja dona do produto (idempotente)
- [x] Webhook /api/public/pagamentos/webhook com reconfirmação no provedor
- [ ] Cadastrar credenciais reais de cada loja no painel (depende do usuário)

## Status e reembolsos
- [x] Endpoint público de status do pagamento (sem credenciais)
- [x] Solicitar e acompanhar reembolsos PIX no painel
- [ ] Teste completo Wappi: PIX real e bloqueio de aviso falso OK; falta pagar um PIX de verdade no site publicado (depende do usuário)

## Checkout 2
- [ ] Adicionar modelo de checkout por loja sem alterar o Checkout 1
- [ ] Criar Checkout 2 e cadastro de endereço fiéis às referências
- [ ] Validar fluxo móvel até o PIX real e regressão do Checkout 1

- [x] Histórico de eventos Meta no painel por loja
- [x] Corrigir aviso de segurança de permissão do banco

## Variações do produto
- [x] Área "Variações do Produto" no painel (atributos livres, imagem por opção, preço/estoque/SKU por combinação)
- [x] Popup de escolha estilo TikTok Shop com Oferta Relâmpago e botão fixo
- [x] Preço da combinação refletido nos dois checkouts e validado no servidor
- [x] Performance: foto principal prioritária, pré-carregamento do checkout, cronômetros isolados, checkout 2 reaproveita dados do produto
- [x] Nota de avaliação editável (Automática = média das avaliações / Manual), exibida como 4.8
- [ ] Comparar velocidade antes/depois no site publicado (depende de publicar)

## Recuperação de PIX
- [x] Incluir PIX antigos (antes do token) no aviso e chat
- [x] Gerar novo PIX a partir de pedido expirado
- [x] Frete único grátis (Frete Expresso, R$ 24,90 riscado, entrega +2 a +4 dias) em produto e checkouts
- [x] Comprar agora não reabre PIX antigo; PIX novo vale 15 min
- [x] Auditoria e correção de fotos/vídeos que não carregam (todo o site)

## Gateway UmbrellaPag
- [x] Adapter UmbrellaPag (x-api-key, centavos, POST /user/transactions) + webhook /api/public/webhooks/umbrellapag com reconfirmação
- [x] Opção no painel por loja + testes de status (4 novos, 70 no total)
- [ ] Teste com API Key real e PIX real (depende da credencial da loja)
