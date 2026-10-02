# Criar a página completa da loja

## Resultado
Adicionar uma nova vitrine em `/loja`, inspirada na estrutura mobile da referência, usando a identidade e os produtos atuais. O botão “Visitar” passará a abrir essa página, sem alterar checkout, pagamento, chat ou páginas de produto.

## Página da loja
- Reutilizar o cabeçalho atual com a logo completa e bem visível.
- Criar capa superior, perfil sobreposto, selo visual, vendidos e botões Seguir/Mensagem.
- Persistir “Seguindo” no navegador e reutilizar o chat atual.
- Criar abas “Página inicial” e “Produtos”.
- Na página inicial, mostrar banner principal, três indicadores configuráveis e produtos mais vendidos.
- Na aba Produtos, listar dinamicamente todos os produtos ativos.
- Criar cards em duas colunas no celular, com imagem, nome, preço, preço anterior, resumo e frete.
- Criar rodapé preto com logo, dados da loja e links para quatro páginas de políticas.

## Painel administrativo
- Criar a área “Página da loja” no painel existente.
- Permitir editar identidade, capa, banner, link do banner, selo, vendidos, visibilidade dos botões, indicadores, destaques, textos do rodapé e políticas.
- Permitir enviar, trocar, visualizar e remover capa/banner sem editar código.
- Manter a lista de destaques flexível e ordenável, sem limite fixo de produtos.

## Dados e segurança
- Ampliar as configurações gerais da loja no banco, com leitura pública e edição exclusiva do administrador.
- Manter produtos e seus conteúdos nos campos estruturados já existentes.
- Não criar números, avaliações, imagens ou alegações falsas: quando um campo não estiver configurado, usar conteúdo atual real ou ocultar o elemento.
- Preservar o produto atual, checkout, pagamentos, pedidos e regras existentes.

## Verificação
- Comparar a página com a referência em larguras mobile de 390–480 px e também em desktop.
- Testar abas, Seguir, Mensagem, banner, links dos produtos, botão Visitar e páginas de políticas.
- Testar a nova área administrativa com uma conta autorizada.
- Confirmar ausência de rolagem horizontal, erros visíveis e falhas de compilação.
