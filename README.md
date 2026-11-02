# Gestão de motos elétricas

Aplicação interna com React/JavaScript, Vite, Tailwind, React Router, Axios, TanStack Query, Lucide e Recharts. API Node/Express com Prisma, PostgreSQL, Zod, bcrypt e sessão JWT em cookie HttpOnly. Não há cadastro público, dados de demonstração no banco operacional ou integrações pagas.

## Instalação com Docker

Requisitos: Node.js 22.12+ ou 24 e Docker Compose v2. Na pasta do projeto:

```sh
npm ci
npm run setup
docker compose up --build -d
docker compose exec -it backend npm run admin:create --workspace backend
```

O script de setup gera segredos aleatórios em arquivos ignorados pelo Git. O cadastro inicial solicita nome, e-mail e senha. O primeiro administrador pode ser criado somente quando não existir administrador ativo. Entre em **http://localhost:8080**, cadastre as unidades, funcionários, motos e clientes, e registre as vendas. Nenhuma senha padrão é utilizada.

O volume `pgdata` mantém os registros entre reinicializações. `docker compose down` desliga os serviços preservando o volume. Não use `down -v` para dados que deseja conservar.

## Execução local com PostgreSQL já instalado

```sh
npm ci
npm run setup
npm run db:generate
npm run db:migrate
npm run admin:create
npm run dev
```

Configure `backend/.env` com a URL de seu PostgreSQL antes de executar as migrations. A interface atende em **http://localhost:5173** e a API em `http://localhost:3001/api`. O Vite encaminha `/api` para a API. Utilize o hostname configurado em `APP_ORIGIN`: `localhost` e `127.0.0.1` são origens diferentes para CSRF.

## Alternativa local sem Docker

O projeto inclui um PostgreSQL nativo portátil para desenvolvimento e testes, obtido pelo pacote [embedded-postgres](https://github.com/leinelissen/embedded-postgres). Ele inicia exclusivamente na interface de loopback e não instala um serviço do Windows.

```sh
npm ci
npm run db:local
```

Mantenha esse terminal aberto. Em um segundo terminal:

```sh
npm run db:generate
npm run db:migrate
npm run admin:create
npm run dev
```

O script cria `backend/.env` somente se ele não existir, usa a porta **55432**, gera credenciais em `.local/postgres.json` e cria bancos separados `motos` e `motos_test`. Se já configurou outro banco em `backend/.env`, ajuste a URL para o PostgreSQL portátil ou continue com o banco configurado. Não sincronize os dados locais de PostgreSQL pelo OneDrive enquanto estiver em uso; para operação contínua prefira Docker ou um diretório de dados fora de pastas sincronizadas.

Para criação não interativa do primeiro administrador, forneça `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` no ambiente do processo. Remova as variáveis após executar. Nunca coloque a senha em argumentos de linha de comando nem no código.

## Permissões

| Perfil | Acesso |
|---|---|
| ADMIN | Todas as unidades, equipe, auditoria e operações |
| GERENTE | Unidades ativas atribuídas, clientes e estoque autorizados, vendas e parcelas dessas unidades; consulta de vendedores |
| VENDEDOR | Unidade ativa vinculada; clientes que criou ou associados às suas vendas; próprias vendas e parcelas; cadastro de clientes e registro de pagamento |

Somente ADMIN altera unidades, cria funcionários, redefine senhas e atribui cargos. ADMIN e GERENTE cadastram/editam motos, cancelam vendas e estornam parcelas. O backend aplica a mesma regra em listagens, detalhes e alterações, independentemente do frontend. Funcionários desativados e vendedores de unidades inativas perdem acesso mesmo que já possuam cookie.

Clientes são desativados, sem apagar vendas. Unidades e funcionários preservam histórico. Motos com venda ativa não podem ser alteradas. Há um índice único parcial que impede mais de uma venda ativa por moto.

## Regras financeiras

Valores no PostgreSQL usam `numeric(14,2)`. O cálculo das parcelas usa inteiros `BigInt` em centavos, distribuindo centavos restantes nas primeiras parcelas. O total das parcelas é exatamente o total negociado. Os vencimentos são mensais; dias como 31 são ajustados ao último dia de meses menores e retomam o dia original nos meses seguintes.

O atraso é calculado em cada consulta a partir da data civil de São Paulo. Parcela pendente com vencimento anterior a hoje é retornada como ATRASADA, sem depender de cron. Baixa informa a data efetiva e impede pagamento futuro ou duplicado. Estorno e cancelamento exigem motivo. Para cancelar venda com parcelas pagas, estorne-as antes. O cancelamento preserva a venda e suas parcelas e libera a moto para uma nova venda.

Venda, atualização de estoque, parcelas e auditoria participam da mesma transação. Pagamento e cancelamento bloqueiam a linha da venda para evitar inconsistências concorrentes.

## Testes

As integrações recusam bancos cujo nome não termine com `_test` e limpam somente esse banco descartável. Nunca configure um banco operacional com esse sufixo. Dados sintéticos existem apenas nos testes.

Com `npm run db:local` ativo:

```sh
npm test
npm run test:local
npx playwright install chromium
npm run test:local -- --e2e
npm run build
```

O runner aplica a migration no banco descartável, executa regras e integrações e, com `--e2e`, cria credenciais aleatórias em memória e inicia API/Vite para o navegador. Encerre servidores nas portas 3001/5173 antes de rodar o E2E; o runner não reutiliza servidores operacionais.

Com Docker para o banco de testes:

```sh
docker compose --profile test up -d test-db
npm run test:config
npm run test:local -- --e2e
```

Para um PostgreSQL de testes externo, defina `DATABASE_URL`, `JWT_SECRET`, `APP_ORIGIN=http://localhost:5173`, `NODE_ENV=test` e execute `npm run db:migrate` e `npm run test:integration`. O runner local usa `.local/test-env.json`; configure esse arquivo para rodar também E2E com banco externo.

Os testes cobrem login válido/inválido, usuário desativado, CSRF, RBAC, isolamento por unidade, CPF válido/duplicado, venda, parcelas, dinheiro exato, datas, estoque duplicado/concorrência, baixa, estorno, atraso, cancelamento, auditoria, paginação e logout. O navegador percorre os cadastros e a negociação até pagamento, estorno, cancelamento, histórico, auditoria e layout móvel. Relatório em `playwright-report/index.html`.

## Estrutura

- `backend/src/routes`: endpoints e permissões.
- `backend/src/controllers`: HTTP, consulta e paginação.
- `backend/src/services`: transações e auditoria.
- `backend/src/schemas`: Zod.
- `backend/src/middlewares`: autenticação, CSRF, escopo e erros.
- `backend/prisma`: schema, migration e constraints adicionais.
- `frontend/src/pages`: telas conectadas à API.
- `frontend/src/components`: formulários, modal, tabelas e estados.
- `scripts`: inicialização e banco de testes.
- `docs/API.md`: contrato REST.
- `docs/VALIDACAO.md`: verificação realizada e limites do ambiente.

## Publicação

Use um host com Docker e PostgreSQL persistente ou um banco PostgreSQL gerenciado. Configure um domínio com HTTPS e encaminhe a aplicação por um proxy reverso. O frontend deve chamar `/api` na mesma origem. Ajuste `.env`:

```dotenv
APP_ORIGIN=https://gestao.suaempresa.com
COOKIE_SECURE=true
NODE_ENV=production
```

Mantenha `JWT_SECRET` aleatório com pelo menos 32 caracteres, não publique a porta do banco na internet e execute as migrations antes de liberar tráfego. O código recusa produção sem HTTPS ou cookie Secure. O Compose publica a interface em loopback; configure seu proxy para `127.0.0.1:8080`. Se usar banco gerenciado, configure `DATABASE_URL` do serviço backend diretamente e retire a dependência do serviço `db`.

Sem “Manter conectado”, a sessão usa cookie de navegador e expira em até oito horas. Com a opção marcada, o login é mantido por até 30 dias em cookie HttpOnly. O navegador lembra somente o e-mail, sem gravar a senha em localStorage. Logout revoga as sessões do funcionário; troca de senha, redefinição e alteração de permissões incrementam a versão de sessão e invalidam cookies anteriores. Senhas e tokens não entram na auditoria. O limitador de login está em memória; o Compose utiliza uma instância de API. Para múltiplas instâncias, configure um armazenamento compartilhado de rate limit antes de escalar.

Proteja arquivos `.env`, banco e volumes no host. Programe backups pelo serviço de infraestrutura; não existe módulo de backup na interface. O serviço gratuito ViaCEP tem timeout de cinco segundos e o endereço pode sempre ser preenchido manualmente.

Este repositório contém os artefatos para publicação; nenhum domínio ou serviço externo é criado automaticamente.

## Acesso, unidade de trabalho e fotos

No primeiro acesso e após redefinição pelo administrador, o usuário precisa criar uma senha diferente da inicial: mínimo de 8 caracteres, uma letra maiúscula e um caractere especial (até 72 bytes). O botão de olho permite mostrar ou ocultar a senha no login. A opção Manter conectado guarda a sessão por 30 dias. Sair revoga as sessões do funcionário.

Depois do login, escolha uma unidade ativa autorizada. O administrador pode selecionar qualquer unidade ou Todas as unidades para administração. O gerente escolhe entre as unidades atribuídas em Funcionários. O vendedor escolhe sua unidade vinculada. Para trocar, clique no nome da unidade no topo. A escolha é validada pelo servidor e limita estoque, cadastros, vendas, parcelas e dashboard.

A tela Permissões apresenta a ACL padrão, usada também na autorização da API. Atribua cargo e unidades em Funcionários. O dashboard inclui valores vendidos, saldo a receber e total atrasado, além dos gráficos e contagens existentes.

Em Motos, o campo Link da foto aceita URL direta HTTP/HTTPS, com prévia, miniatura na listagem e foto no detalhe. A imagem é carregada pelo navegador; o servidor não baixa nem armazena o arquivo. Links inválidos ou indisponíveis exibem um substituto. Páginas HTTPS precisam de imagens HTTPS para evitar bloqueios de conteúdo misto do navegador.

Atualização de uma instalação existente: pare o backend, execute `npm run db:generate` e `npm run db:migrate`, e inicie-o novamente. A migration conserva os registros e solicita troca de senha no próximo acesso das contas existentes.

## Catálogo com variações e estoque por lote

Em **Motos**, adicione um produto com preço padrão e unidade. Abra o produto e adicione combinações de versão, tipo de bateria e cor. Variações podem ter foto e preço próprios. Uma combinação repetida é recusada.

Use **Entrada de lote** na linha da variação para registrar quantidade, ano, código do lote, custo unitário opcional e novo preço de venda opcional. O custo pertence ao lote; o preço de venda pertence à variação. A quantidade disponível é calculada pelas motos físicas do lote, preservando a identificação individual e a proteção contra vendas duplicadas. Cada venda aloca uma moto disponível, baixa uma unidade e registra movimento. O cancelamento devolve a mesma unidade ao estoque pelo preço de venda atual. Motos avulsas antigas continuam acessíveis pelo botão **Motos avulsas**.

Use **Alterar preço** para corrigir um cadastro ou fazer reajustes para cima ou para baixo. Escolha todo o produto (todas as variações) ou uma combinação específica e informe o motivo. O sistema registra preço anterior, preço novo, responsável e data. Os valores das vendas anteriores e os custos dos lotes são preservados. A entrada de lote também permite reajustar apenas a variação recebida.

**Saída manual** exige quantidade e motivo e serve para avaria ou ajuste de estoque. Não permite saldo negativo. As abas **Movimentações**, **Lotes recebidos** e **Histórico de preços** mostram os últimos 100 registros de cada tipo.

Administrador e gerente gerenciam catálogo, preços e lotes apenas nas unidades autorizadas. Vendedores consultam produtos e estoque e vendem dentro de seu escopo; os custos de compra e as ações de gestão não são retornados ao vendedor.

O cadastro solicitado da **Scooter Elétrica Duact Maxus 1000W** pode ser realizado uma única vez por `node scripts/register-duact-maxus.mjs`. O script é idempotente: cria a unidade ACLS se necessário (com endereço/contato pendentes), o produto a R$ 9.999,90, a foto fornecida e 24 opções (12 cores × baterias de lítio e chumbo, versão 1000W), sem criar estoque físico. As cores e tipos foram consultados em https://www.duact.com.br/ em 02/11/2026. Não execute esse script em uma instalação que não deseje esse cadastro.

## Escolha de unidade e venda simplificada

A entrada nas unidades usa cartões grandes com ícone. Administradores veem todas as unidades ativas e o cartão de visão geral. Os demais usuários veem somente as unidades autorizadas. Usuários ativos sem unidade podem autenticar, mas veem um aviso para solicitar liberação ao responsável e não acessam a operação. Em Funcionários, o administrador pode deixar vendedor ou gerente sem unidade enquanto o acesso estiver pendente. Contas desativadas continuam sem login.

A nova venda começa com cliente, moto, valor e pagamento. À vista é o padrão. Parcelas e primeiro vencimento aparecem somente ao selecionar Parcelado; a data da venda pode ser expandida para alteração. O botão Cadastrar cliente abre o formulário completo dentro do mesmo modal, incluindo contato, unidade, CEP e endereço. Ao salvar, o cliente é selecionado e a moto, o valor e o pagamento preenchidos são preservados.

## Cores e combinações visuais

O catálogo mostra um cartão por produto com foto, preço e amostras das cores. No produto, cada cor aparece em um quadrado com nome e saldo total, agrupando as baterias e versões da mesma cor. Escolha o quadrado e depois a bateria/versão para consultar preço, quantidade e ações da configuração selecionada.

Use **Adicionar cor**: selecione uma cor da paleta ou informe nome e tom no seletor. Para uma moto que tenha duas ou mais cores, use **Adicionar outra cor** (até seis componentes). O quadrado fica dividido entre os tons e o nome combina as cores. Isso cria uma única configuração multicolorida, com estoque próprio; não duplica o estoque por componente. Tons são referências visuais editáveis, sem recolorir a foto do produto.

As cores anteriores recebem uma amostra visual por compatibilidade, preservando seus registros e lotes. Cores novas guardam os nomes e valores hexadecimais no banco; a ordem dos componentes é normalizada para evitar combinações duplicadas. O diretório `shared` deve acompanhar backend/frontend; os Dockerfiles já o incluem.

## Nome de usuário no login

Em Minha conta, defina um Nome de usuário opcional e único, com 3 a 30 caracteres: letras sem acento, números, ponto, hífen ou sublinhado; comece com letra ou número e não use espaços. O campo de login aceita esse nome ou o e-mail, sem diferenciar maiúsculas de minúsculas. O e-mail e a senha existentes continuam válidos. Ao alterar o username, o identificador antigo deixa de funcionar, mas o e-mail continua disponível.

O administrador também pode definir o nome em Funcionários. No bootstrap, ADMIN_USERNAME é opcional. A migration adiciona uma coluna nullable com índice único e validação de formato, sem inventar usernames para as contas existentes. Telefone pode ficar em branco no próprio perfil, permitindo salvar o username sem cadastrar um telefone fictício.

## Cadastro completo durante a venda

O botão Cadastrar cliente na venda abre o formulário completo: nome, CPF, telefone, e-mail, unidade, CEP, rua, número, complemento, bairro, cidade, UF e observações. O CEP permite consulta de endereço, com preenchimento manual quando indisponível. O cadastro usa a validação normal de clientes e volta à venda com o cliente selecionado, preservando moto, valor e pagamento.

Os modais de venda/cliente possuem limite de altura, rolagem interna e botões acessíveis em telas pequenas. O total fica separado do botão de confirmação. Sem moto disponível ou sem seleção de cliente/moto, a confirmação fica desabilitada. Cadastros básicos antigos são preservados e podem ser completados em Clientes.

## Seletor de bateria

O campo Tipo de bateria em Adicionar cor/Editar configuração usa uma lista agrupada: chumbo, chumbo-ácido (SLA), AGM, gel, chumbo-carbono, lítio, Li-ion, LiFePO4, LiPo, Na-ion, NiMH e NiCd. Tipos já cadastrados continuam disponíveis sem alteração. A opção Outro permite informar um nome personalizado. A seleção não cria estoque nem altera configurações existentes automaticamente.

## Layout compartilhado

As telas usam FilterBar para manter busca, listas e datas com legenda acima, altura de 44 px e alinhamento comum. Os filtros reorganizam as colunas em telas menores, sem alargar a página.

Os modais compartilham cabeçalho fixo, área interna com rolagem e barra de ações fora dos campos. Os formulários padrão, de produto/configuração, lotes, preços e confirmações usam modal-form-fields; o fluxo de venda mantém sua estrutura específica integrada ao mesmo contêiner. As regras comuns ficam em frontend/src/layout.css, carregadas pelo ponto de entrada da aplicação. O menu lateral rola internamente em telas baixas para manter o botão Sair acessível.


### Fotos enviadas e PostgreSQL

Em Adicionar/Editar produto ou Adicionar cor/Editar configuração, use **Enviar foto do computador**. Escolha primeiro a unidade. O link continua disponível como alternativa; o envio preenche o endereço da foto e o botão Salvar associa essa foto ao produto/configuração.

O servidor aceita JPG, PNG e WebP de até 8 MB e 40 megapixels, sem animação. Aplica a orientação, remove metadados, reduz para no máximo 1600×1600 sem ampliar imagens menores e converte para WebP com qualidade 80. Recusa resultados acima de 1 MB. O formulário mostra a prévia, dimensões e tamanho final.

A tabela `StoredImage` guarda os bytes otimizados (`BYTEA`), dimensões, tamanho e hash por unidade. Arquivos idênticos na mesma unidade reutilizam o registro. Listagens de produtos guardam apenas o endereço da imagem; não carregam os bytes no JSON. A leitura da foto exige sessão e acesso à unidade. O cache privado sempre revalida a autorização. Somente admin/gerente com acesso podem enviar e associar fotos; os binários não entram na auditoria.

As fotos fazem parte do backup do PostgreSQL. Remover a foto do formulário tira a associação ao salvar; arquivos enviados são preservados no banco, inclusive para referências anteriores. Links externos não são importados automaticamente. A migration é aditiva e deve ser aplicada com `npm run db:migrate`, após instalar as dependências e executar `npm run db:generate`. No computador local, a migration já foi aplicada.


### Demonstração e juros nas vendas

A Unidade Teste · Demonstração contém dados identificados com DEMO: três cargos (ADMIN, GERENTE e VENDEDOR), quatro clientes fictícios, um produto com dez configurações, vinte motos e seis vendas simuladas. Inclui venda à vista paga, parcelamento sem juros, acréscimo em reais, porcentagem, parcela definida manualmente e uma venda antiga com parcela paga e saldo em atraso. Após as vendas, restam quatorze motos disponíveis. Os dados simulados aparecem nos relatórios e no dashboard conforme a unidade selecionada.

`npm run demo:seed` cria o conjunto no banco configurado sem apagar cadastros anteriores. Reexecutar preserva os dados já criados, as senhas e as vendas existentes. As senhas iniciais aleatórias ficam no arquivo local ignorado pelo Git `.local/demo-credentials.json`; os usuários devem alterá-las no primeiro acesso. Gerente e vendedor ficam vinculados à unidade de demonstração, enquanto o administrador mantém o acesso padrão do cargo. Não use a credencial temporária como senha definitiva.

Em Nova venda → Parcelado → Juros / ajuste das parcelas, escolha Sem juros, Adicionar juros em reais, Adicionar juros em porcentagem ou Definir valor da parcela. O acréscimo é único sobre o total negociado (não é taxa mensal nem juros compostos). O último modo calcula total = quantidade × valor da parcela, mostrando a diferença como acréscimo. Para desconto, reduza o valor negociado; o total das parcelas não pode ficar abaixo dele.

A prévia mostra valor negociado, acréscimo, parcelas e total. Cálculo compartilhado em centavos com arredondamento de metade para cima na porcentagem; eventuais centavos restantes vão para as primeiras parcelas. O servidor recalcula e grava o resultado no histórico da venda. Vendas anteriores são preservadas. A migration aditiva `20261102200000_sale_financing` já foi aplicada no banco local.
