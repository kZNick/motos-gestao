# Verificação da entrega

Data local: 12/10/2026 (America/Sao_Paulo).

## Executado neste computador

- Instalação das dependências e geração do Prisma Client 6.12.0.
- Prisma validate: schema válido.
- Migration inicial aplicada com sucesso em PostgreSQL nativo portátil, nos bancos motos e motos_test.
- Build Vite em produção concluído; dashboard carregado em chunk separado, sem alerta de bundle acima de 500 kB.
- 7 testes de regras de negócio aprovados.
- 22 cenários de integração PostgreSQL aprovados (o runner Node também contabiliza o teste pai e exibe 23).
- 2 testes de navegador Chromium aprovados, abrangendo venda completa, equipe, permissões, conta, logout e responsividade em 390 px.
- npm audit e npm audit --omit=dev: zero vulnerabilidades reportadas.
- Capturas desktop e móvel inspecionadas.

O banco operacional motos não recebeu clientes, unidades, motos, vendas ou funcionários sintéticos. Os testes usam exclusivamente motos_test, com credenciais aleatórias e fixtures descartáveis. O primeiro administrador da operação deve ser criado pelo usuário com npm run admin:create.

## Limites da verificação

Docker não está instalado neste computador. Dockerfiles, configuração Nginx e Compose foram preparados, mas o build e a inicialização dos contêineres não foram executados. A aplicação foi exercitada com Node, Vite e PostgreSQL nativo reais.

Não foi feita publicação em infraestrutura externa, nem provisionado domínio. Os arquivos e instruções para implantação estão no README.

Consulta de CEP é opcional, com timeout e preenchimento manual; o fluxo de navegador preenche o endereço manualmente e não depende da disponibilidade do ViaCEP.

Os dados do relatório do Playwright e das capturas são registros do banco de testes e não representam uma empresa real.

## Atualização de 02/11/2026

- Nome Volt removido das telas e do título; símbolo de raio mantido.
- Login com mostrar/ocultar senha, e-mail lembrado e sessão opcional de 30 dias em cookie HttpOnly. Sem a opção, cookie de sessão com JWT de 8 horas.
- Primeiro acesso e redefinição exigem nova senha com 8 caracteres, maiúscula e especial. Rotas operacionais ficam bloqueadas até a troca.
- Seleção de unidade validada pelo backend, incluindo restrição para administradores quando uma unidade específica é escolhida. Tela de permissões usa a ACL padrão do servidor.
- Dashboard com valor vendido, saldo a receber e valor atrasado. Foto de moto por link com prévia, miniatura e detalhe. CSP do Nginx ajustada para imagens HTTP(S).
- Migration aditiva aplicada em motos e motos_test; dados existentes preservados. Contas existentes devem trocar a senha no próximo acesso.
- Build de produção concluído. Testes: 7 cenários de regras, 26 de integração (27 no runner, incluindo o pai) e 2 fluxos Chromium aprovados: 35 cenários.
- Testes novos cobrem senha fraca, troca obrigatória, bloqueio antes da seleção, unidade proibida, restrição do administrador, cookie persistente e de sessão, persistência da URL da foto e rejeição de protocolos não HTTP(S).
- Navegador verificou login persistente após recarga, mostrar senha, troca de senha do gerente, escolha de unidade, ACL, imagem carregada e fluxo de venda/pagamento/estorno/cancelamento. Capturas desktop, móvel e login inspecionadas.
- Testes de navegador em portas isoladas 3002/5178 e exclusivamente banco motos_test. Sem dados sintéticos no banco operacional.
- Docker continua sem execução neste computador; fotos externas dependem da disponibilidade do link.

## Catálogo e estoque por lote — 02/11/2026

- Migration aditiva de Product, ProductVariant, StockBatch, StockMovement e PriceChange. As motos avulsas e vendas anteriores são preservadas; o índice único de venda ativa por moto física permanece.
- Cadastro operacional autorizado: ACLS, Scooter Elétrica Duact Maxus 1000W a R$ 9.999,90, foto fornecida pelo proprietário, 12 cores e baterias de lítio/chumbo (24 opções da versão 1000W), com zero estoque físico até informar as quantidades. Endereço e contato da unidade estão pendentes.
- Cores/tipos pesquisados no site oficial https://www.duact.com.br/. O script de cadastro é idempotente e não cria estoque nem altera cadastros existentes ao ser repetido.
- Saldo calculado pelas unidades físicas disponíveis de cada variação/lote. Entrada cria unidades; venda usa bloqueio de linha com SKIP LOCKED e reserva uma unidade; cancelamento devolve a mesma unidade ao preço atual. Saída manual exige motivo e não admite quantidade indisponível.
- Alteração de preço por produto inteiro ou por variação com motivo, data e responsável. Custo de cada lote e valores de vendas anteriores preservados. Custo de aquisição não é exposto a vendedores.
- Integração aprovada: cadastro, duplicidade sem diferenciar maiúsculas, escopo por unidade, bloqueio de vendedor, saldo inicial zero, entrada de 3 unidades, 4 vendas concorrentes com somente 3 sucessos, cancelamento sem devolução duplicada, ajuste de saída, novo lote com outro custo e preço, redução de preço e devolução após reajuste.
- Build de produção e verificações de sintaxe/diff aprovados. Testes de navegador em portas 3002/5178 e banco motos_test; os testes operacionais de código continuam separados do banco motos.
- Navegador aprovado: criação de produto e variações, dois lotes com custos distintos, reajuste geral e específico, seleção da variação na venda, baixa e cancelamento da venda criada, devolução do saldo e consulta aos históricos. Capturas desktop/celular inspecionadas; foto servida com HTTP 200. Total verificado: 7 cenários de regras, 31 integrações (32 no runner com o pai) e 3 fluxos de navegador, somando 41 cenários aprovados. O fluxo novo foi reexecutado isoladamente após corrigir a sincronização dos seletores de teste.

## Unidades em cartões e venda simplificada — 02/11/2026

- Seletor de unidade substituído por tela com cartões, ícone e nome. Admin vê todas as unidades ativas e visão geral; gerente/vendedor veem apenas suas unidades ativas.
- Usuário ativo sem unidade recebe aviso de liberação pendente, inclusive antes da primeira troca de senha. Pode sair ou verificar acesso novamente; endpoints operacionais continuam bloqueados. O administrador pode cadastrar funcionários sem unidade, e a listagem mostra Aguardando liberação.
- Venda com pagamento à vista por padrão e detalhes de parcelas somente quando parcelado. Data de venda recolhida em opção de alteração, total destacado e botão Cadastrar cliente ao lado do seletor.
- Cadastro básico de cliente dentro da venda valida nome, CPF, telefone e unidade; não inventa endereço. Após salvar, seleciona o cliente e preserva os demais campos da venda.
- Build de produção e diff check aprovados. 7 cenários de regras + 33 integrações (34 com o pai no runner) + 5 fluxos de navegador = 45 cenários aprovados. Todos os testes de dados usam motos_test.
- Navegador confirmou admin com todos os cartões, usuário limitado a um cartão, aviso sem unidade, novo cliente dentro da venda sem perder valores, venda concluída, catálogo/lotes e fluxos anteriores. Capturas de cartões e venda em desktop/celular e do aviso de acesso inspecionadas.

## Catálogo visual e cores combinadas — 02/11/2026

- Catálogo reorganizado em cartões compactos, foto proporcional, preço e amostras de cor. Estilos específicos carregados pelas telas de inventário; frontend reiniciado para renovar os arquivos servidos.
- Tabela de combinações substituída por seletor de quadrados por cor, com nome, tom, saldo agrupado e seleção independente de bateria e versão. Estoque/ações continuam vinculados à configuração correta.
- Campo JSON aditivo para componentes da cor (nome e hex). Até seis cores por combinação, preview dividido, validação de hexadecimal, nomes únicos e normalização da ordem. Nenhum lote, venda ou estoque anterior foi apagado.
- Compatibilidade das cores antigas validada. Integração testou persistência bicolor, ordem invertida duplicada, hexadecimal inválido e componente repetido.
- Navegador testou uma única cor com duas baterias, cadastro de Branca / Preta com seletor de tom, persistência após recarga, CSS aplicado ao catálogo, lote, preço, venda e cancelamento. Capturas desktop/móvel inspecionadas.
- 7 testes de regras + 34 cenários de integração (35 com o pai no runner) + 5 fluxos Chromium = 46 cenários aprovados. Build e diff check aprovados. Dockerfiles incluem shared; Docker não foi executado neste computador.

## Nome de usuário — 02/11/2026

- Nome de usuário único e opcional no próprio perfil e em Funcionários. Migration aditiva com índice único e validação de formato; e-mails, senhas e dados anteriores preservados.
- Login por username ou e-mail no mesmo campo, normalizando caixa e espaços externos. Compatibilidade com payload legado de e-mail mantida. Nomes com @ são recusados para evitar ambiguidade com e-mail.
- Telefone opcional apenas na atualização do próprio perfil, permitindo salvar o username sem inventar telefone. Nome novo validado em 3–30 caracteres ASCII, números, ponto, hífen e sublinhado.
- Testes novos aprovados: login legado, perfil sem telefone, username em caixa alta, e-mail em caixa alta, senha incorreta, nomes inválidos/duplicados, renomeação, preservação da senha, ACL e usuário desativado.
- Navegador confirmou definir username em Minha conta, sair e autenticar com ele em maiúsculas usando a mesma senha. Fluxo reexecutado isoladamente após ajustar nomes acessíveis dos campos. Outros quatro fluxos Chromium aprovados na execução geral.
- Build, sintaxe e diff check aprovados. 7 cenários de regras + 34 de integração existente + 5 novos de username + 5 fluxos de navegador = 51 cenários aprovados. Testes de dados exclusivamente em motos_test.

## Correção do modal e cadastro completo — 02/11/2026

- Modal de venda com estilos próprios carregados junto à tela, seletor de cliente ocupando a largura disponível, botão de cadastro separado e total à esquerda da confirmação.
- Cadastro dentro da venda utiliza o formulário/endpoint completo de clientes: contato, e-mail, unidade, CEP, endereço, complemento e observações. Cabeçalho muda para Cadastrar cliente. Ao salvar, preserva moto, preço e pagamento da venda.
- Modal com altura limitada ao viewport, rolagem interna e botões de ação acessíveis. Confirmação desativada sem cliente/moto e quando não há estoque.
- Build e diff check aprovados. Dois testes Chromium direcionados aprovados: cadastro completo com endereço retornado pela consulta de CEP, persistência e venda concluída; estado sem estoque, alinhamento CSS e botão desativado.
- Mobile 390×660 verificado: acesso por rolagem aos campos CEP/UF, botão de salvar sempre acessível e modal dentro do viewport. Capturas desktop/mobile inspecionadas. Testes exclusivamente em motos_test, sem alteração de dados operacionais.


## Alinhamento das telas e modais — 02/11/2026

- Filtros compartilhados com rótulos, altura uniforme de 44 px e alinhamento pela base, incluindo datas. Quebra em duas colunas no celular e busca em linha inteira.
- Espaçamentos, cabeçalhos, ações e campos padronizados. Modais com altura limitada à tela, campos com rolagem interna e rodapé de ações separado; navegação lateral com rolagem em telas baixas.
- Dez telas verificadas em 1900×1000, 1280×800 e 390×844, sem overflow horizontal da página ou erros JavaScript. Modais de cliente, unidade, funcionário, produto, venda, variação, lote, preço, configuração e auditoria verificados em desktop e celular; capturas inspecionadas.
- Build e diff check aprovados. Seis testes de navegador aprovados: quatro regressões de acesso/venda/catálogo e dois testes de layout. O último teste de modais foi reexecutado isoladamente após corrigir o ponto de clique do teste na área externa do menu móvel.
- Dados sintéticos exclusivamente no banco de testes. Frontend do usuário em 5173 mantido; estilos novos confirmados no servidor existente.


## Foto da configuração selecionada — 02/11/2026

- A foto principal do produto acompanha a cor, bateria e versão selecionadas. Configurações sem foto própria utilizam a foto do modelo.
- Seleção compartilhada entre foto e controles, preservada ao salvar a configuração. A legenda identifica a configuração quando há foto específica.
- Build e diff check aprovados. Teste Chromium do catálogo aprovado, incluindo salvar foto específica, carregar a imagem, alternar cor/bateria, retornar à imagem padrão e persistir após recarga; lotes, preços, venda e cancelamento também aprovados no mesmo fluxo. Dados apenas no banco de testes e imagem externa simulada.


## Upload de fotos no PostgreSQL — 02/11/2026

- Upload de JPG/PNG/WebP no produto e na configuração, prévia, remoção da associação e tamanho otimizado visível. Mantida a opção de link.
- Sharp 0.35.5: orientação automática, remoção de metadados, limite de 40 MP, redimensionamento até 1600×1600 e WebP qualidade 80. Entrada até 8 MB e saída até 1 MB. Nginx ajustado para o limite de upload; JSON continua limitado a 64 KB no backend.
- Migration aditiva `StoredImage` com bytes em BYTEA, hash único por unidade, dimensões e tamanho; aplicada ao banco local e ao banco de testes. Prisma regenerado com breve reinício do backend local para liberar a DLL no Windows. Dados existentes preservados.
- Backend: testes de regras, integração e username aprovados; dois testes de fotos aprovados com persistência binária, formato WebP, dimensões, deduplicação, leitura, cache privado, ACL, referências entre unidades, arquivo inválido/grande e CSRF. Limpeza dos registros sintéticos de auditoria corrigida no hook do teste e reexecutada com sucesso.
- Build aprovado. Teste Chromium do catálogo confirmou upload real no produto e na configuração, prévia em desktop/celular, botões acessíveis, troca entre foto do modelo e da configuração e exibição após recarga. Captura móvel inspecionada e botão de envio alinhado em linha. Dados sintéticos exclusivamente em motos_test; nenhuma foto de teste inserida no cadastro real. Docker não executado nesta máquina.


## Unidade de demonstração e parcelamento com juros — 02/11/2026

- Criada no banco local a Unidade Teste · Demonstração, com contas demo_admin, demo_gerente e demo_vendedor, senhas temporárias aleatórias e troca obrigatória no primeiro acesso. Quatro clientes fictícios, dez configurações de cor/bateria, vinte motos e seis vendas simuladas; quatorze motos disponíveis. Vendas incluem à vista paga, sem juros, acréscimo fixo, percentual, parcela manual e saldo antigo em atraso. Cadastros existentes preservados.
- Seed repetível sem duplicação, validado primeiro no banco de testes. Credenciais mantidas exclusivamente em arquivo local ignorado pelo Git. Conferência posterior no banco local validou hashes, cargos, vínculos, contagens e soma das parcelas das seis vendas.
- Juros como acréscimo único sobre o total negociado, em reais ou porcentagem. Valor manual da parcela recalcula total e acréscimo. Prévia e backend compartilham cálculo exato em centavos. Proibidos total abaixo do negociado, juros em operação com uma parcela, valores inválidos e estouro de precisão. Resultado persistido em JSON na venda e exibido nos detalhes; operações antigas continuam compatíveis.
- Modal da venda com campos roláveis separados do rodapé, evitando sobreposição do resumo financeiro. Capturas de porcentagem e parcela manual em desktop e celular inspecionadas.
- Build e diff check aprovados. Backend: oito testes de regras, trinta e cinco cenários de integração, cinco cenários de username e dois de fotos aprovados. Navegador: cinco testes aprovados, cobrindo ACL, cliente dentro da venda, falta de estoque, primeiro acesso dos três cargos e vendas com os quatro modos de cálculo. Testes de escrita usam apenas motos_test, separados da criação autorizada da demonstração no banco local.


## Acabamento visual dos modais — 02/11/2026

- Estilos compartilhados em modals.css: contorno e sombra suaves, cantos arredondados, espaço externo no desktop, botão de fechar com fundo discreto, campos e botões consistentes.
- Barras de rolagem de 8 px no Chromium/WebKit, trilho claro e indicador verde arredondado, sem setas; alternativa fina com cores nativas nos demais navegadores. Aplicação ao corpo dos modais, campos dos formulários e formulário de venda; contraste do sistema preservado em forced-colors.
- Rodapé de ações mantido separado da rolagem. Capturas de cliente desktop/celular inspecionadas. Build e diff check aprovados; teste de modais em desktop/celular aprovado, incluindo os formulários de clientes, unidades, funcionários, produtos, venda, configuração, lote, preço e auditoria.
