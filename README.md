# Volt — Gestão de motos elétricas

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

A sessão expira em oito horas. Logout revoga as sessões do funcionário; troca de senha, redefinição e alteração de permissões incrementam a versão de sessão e invalidam cookies anteriores. Senhas e tokens não entram na auditoria. O limitador de login está em memória; o Compose utiliza uma instância de API. Para múltiplas instâncias, configure um armazenamento compartilhado de rate limit antes de escalar.

Proteja arquivos `.env`, banco e volumes no host. Programe backups pelo serviço de infraestrutura; não existe módulo de backup na interface. O serviço gratuito ViaCEP tem timeout de cinco segundos e o endereço pode sempre ser preenchido manualmente.

Este repositório contém os artefatos para publicação; nenhum domínio ou serviço externo é criado automaticamente.
