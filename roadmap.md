# Roadmap

## Variantes esgotadas (31/10/2026)
- [x] Adicionar controle individual e etiqueta editável nas opções existentes, sem alterar preços/estoque
- [x] Exibir foto acinzentada e etiqueta, informar ao clicar e bloquear compra também no servidor via variantPricing
- [x] Validar 15 testes, salvar/reabrir no painel autorizado, foto/etiqueta em 390px e computador, aviso sem selecionar, opção disponível até checkout e reativação. Cópia temporária removida; originais intactos, nenhuma cobrança criada; build OK.

## Telefone completo em Pedidos Pix (30/10/2026)
- [x] Disponibilizar telefone real exclusivamente no retorno administrativo protegido
- [x] Melhorar somente a coluna WhatsApp com copiar e abrir conversa manual
- [x] Validar 242 testes e painel autenticado com pedido real: telefone completo, cópia, link com DDI, pesquisa e filtros em computador/celular; acesso sem sessão redireciona ao login, retorno público sem cliente/telefone e build OK. Nenhuma mensagem enviada.

## Central de múltiplos gateways (29/10/2026)
- [x] Preservar configuração existente e adicionar registros independentes por provedor com ativação atômica por loja
- [x] Atualizar painel para cadastrar, editar, testar e ativar gateways sem sobrescrever credenciais
- [x] Garantir que consultas e webhooks de pedidos antigos usem o provedor original
- [x] Validar 81 testes e painel autenticado: dois gateways em loja temporária desativada, três trocas exclusivas, persistência, teste inativo e recusa de configuração incompleta; loja temporária removida, lojas reais preservadas e nenhuma cobrança criada

## Negrito e pulsação da faixa Economize (29/10/2026)
- [x] Adicionar seleção com B, remoção individual, pulsação opcional e prévia por produto
- [x] Validar 28 testes, salvar/reabrir e exibir dois negritos, remoção individual, pulso 2,8s em trechos/texto completo, movimento reduzido e 320/390/430/1280px; configuração original restaurada

## Texto da faixa Economize (29/10/2026)
- [x] Adicionar modo automático/manual e prévia em Preço e estoque, salvando por produto sem alterar a faixa COMPRE 2
- [x] Validar automático R$ 38,00 e manual salvar/reabrir/ler na página com acesso autorizado; visualizar celular/desktop sem transbordamento, restaurar configuração original; testes de isolamento e persistência

## Teste real PlugSend (29/10/2026)
- [x] Completar resultados com HTTP, ID, horário e falhas; adicionar teste do texto exato de cada mensagem sem alterar configurações
- [x] Adicionar número destinatário e mensagem livre, usando token salvo da própria loja; esconder teste de conexão para PlugSend sem alterar automação
- [x] Validar 12 testes, build OK e campos/status no painel autenticado sem salvar mudanças; lojas consultadas não tinham PlugSend selecionada
- [ ] Confirmar recebimento real: depende de PlugSend salva na loja e número destinatário autorizado pela usuária
- [x] Validar 18 testes e painel autenticado: campos e dois testes manuais presentes; três lojas ainda usam Meta, portanto envio bloqueado sem salvar PlugSend/token. Nenhuma configuração foi alterada.

## Proteção premium nas proporções do original (27/10/2026)
- [x] Compactar cabeçalho, escudo, ícones e textos do premium, preservando seis benefícios e layout original
- [x] Verificar 320/360/375/390/412/430/1280px: duas colunas, seis benefícios legíveis sem transbordamento e expandir/recolher; altura em 390px reduzida de 245 para 197px, oito testes passaram e build OK. Aviso externo da UTMify não afetou a seção.

## Proteção premium compacta no mobile (27/10/2026)
- [x] Manter duas colunas e três linhas no celular, reduzindo levemente ícones e espaçamentos sem alterar cores, textos ou original
- [x] Conferir seção real em 320/360/375/390/412/430/1280px, seis benefícios sem transbordamento e expandir/recolher; oito testes passaram e build OK. Prévia reutiliza a mesma seção. Aviso de rede do Pixel UTMify externo não impediu o fluxo.

## Proteção do cliente premium (27/10/2026)
- [x] Adicionar configuração por loja, oito textos independentes, prévia real do original e novo visual sem alterar produtos
- [x] Validar 23 testes; salvar/reabrir oito textos no painel autenticado, ler no produto, expandir/recolher e desativar preservando frete; seis ícones em 320/390/430/1280px e duas colunas no desktop; configurações anteriores restauradas; build OK. Dois eventos genéricos de rede durante navegação não impediram o fluxo.

## Cabeçalho opcional por loja e produto (27/10/2026)
- [x] Adicionar variante compacta e configurações independentes, com apenas voltar à vitrine clicável
- [x] Testar seis regras, salvamento autenticado da loja e três modos do produto, texto e larguras 320/360/375/390/412/430px; seta abre a vitrine da própria loja e escolhas anteriores restauradas

## Ícone refinado no título dos vídeos (25/10/2026)
- [x] Refinar só o ícone e limitar sua cor personalizada, preservando título e seção
- [x] Validar 28 testes e fluxo autenticado dos cinco ícones: salvar/reabrir, posição, cor exclusiva, atualizar e desligar; escolhas originais restauradas, sem erros de execução

## Correção do salvamento do ícone no título (25/10/2026)
- [x] Corrigir remoção dos campos existentes pela validação de salvamento, sem mudar seção ou controles
- [x] Validar 28 testes e fluxo autenticado: cinco ícones, três posições, salvar/reabrir, atualizar página, desligar e isolamento entre produtos; configurações originais restauradas, sem erros de execução

## Verificação dos criadores (25/10/2026)
- [x] Adicionar estilo opcional por criador, preservando controle atual e verificação verde dos vídeos antigos
- [x] Validar 15 testes, salvar/reabrir estilo azul no painel autenticado, controle desligar/ligar e visual azul junto ao verde em 320/390/1280px; restaurar escolha verde original após teste

## Textos editáveis da barra por produto (25/10/2026)
- [x] Adicionar texto destacado e complementar na configuração existente, sem destaque baseado em palavras
- [x] Validar edição independente com 15 testes e visual móvel/desktop com componentes existentes e produto real em prévia temporária; prazo idêntico após atualizar, fechar e reabrir, sem alterar timer ou dados reais (salvamento no painel não exercitado)

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
- [x] Título "Quem comprou, mostrou" configurável por produto: quantidade liga/desliga, ícone (vídeo/play/câmera/gravação/filmadora) com posição, sem alterar vídeos nem layout

## Busca do rastreamento Magnus Frete
- [x] Mesma barra passa a filtrar por nome, telefone (só dígitos), número/ID do pedido e rastreio; teste em src/lib/magnus-search.test.ts

## Selo WhatsApp por produto
- [x] Nova opção na seção "Selos promocionais" do produto: exibir selo WhatsApp (verde, ícone oficial), texto editável, opção clicável com número + mensagem inicial (wa.me); selos 1 e 2 intactos; testes em src/lib/promo-badges.test.ts
- [x] Verificado no painel e na página do produto (Playwright); caracteres invisíveis no link vêm do script externo da UTMify, não do código da loja
