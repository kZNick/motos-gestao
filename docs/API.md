# API REST

Base: `/api`. JSON de sucesso: `{"data": ...}`. Listagens: `{"data":[],"meta":{"page":1,"limit":20,"total":0,"pages":0}}`. Erros: `{"error":{"message":"...","fields":{}}}`; fields aparece em erros de validação.

IDs são UUIDs. Datas civis são `YYYY-MM-DD`; instantes de auditoria são ISO 8601. Valores monetários são strings decimais, por exemplo `"9999.90"`. A aplicação aceita números nas entradas, mas recomenda strings para evitar perda de precisão. Campos desconhecidos nos corpos são rejeitados.

## Autenticação

| Método / rota | Uso |
|---|---|
| GET /health | Saúde do processo |
| POST /auth/login | `{email,password}`; retorna `{user,csrfToken}` e cookie session HttpOnly |
| GET /auth/me | Sessão atual e token CSRF |
| POST /auth/logout | Revoga sessões e remove cookie |
| PATCH /auth/profile | `{name,phone,password?,currentPassword?}`; retorna sessão atualizada |
| GET /address/:zip | CEP com oito dígitos; consulta ViaCEP autenticada; resposta do ViaCEP |

Toda requisição de escrita exige `Origin` exatamente igual a APP_ORIGIN. Exceto login, também exige `X-CSRF-Token` igual ao token retornado pela sessão e cookie session válido. CORS aceita somente APP_ORIGIN com credentials. O cliente deve usar credentials/include; nenhum JWT é guardado em localStorage.

Login é limitado a 20 tentativas em 15 minutos por IP. Cookie SameSite=Strict, duração de oito horas e Secure quando configurado. Não há refresh público ou registro público.

## Cadastros

| Método / rota | Permissão |
|---|---|
| GET /units | Unidades autorizadas |
| POST /units; PUT /units/:id; DELETE /units/:id | ADMIN; delete desativa |
| GET /users | ADMIN; GERENTE consulta vendedores de suas unidades |
| POST /users; PUT /users/:id; DELETE /users/:id | ADMIN; delete desativa |
| POST /users/:id/password | ADMIN; corpo `{password}` |
| GET /customers; GET /customers/:id | Clientes autorizados; detalhe inclui histórico limitado ao escopo |
| POST /customers; PUT /customers/:id; DELETE /customers/:id | Todos, respeitando cliente e unidade autorizados; delete desativa |
| GET /motorcycles; GET /motorcycles/:id | Estoque das unidades autorizadas |
| POST /motorcycles; PUT /motorcycles/:id | ADMIN / GERENTE |

Corpo Unit: `{name,code,address,city,state,phone,active?}`.

Corpo User: `{name,email,phone,password?,role,unitId?,managerUnitIds?,active?}`. Password é obrigatório na criação, opcional na edição, com 10 a 72 caracteres e até 72 bytes. Role: ADMIN, GERENTE, VENDEDOR. Vendedor exige unitId; gerente exige managerUnitIds. Somente unidades ativas podem ser atribuídas. A resposta nunca inclui passwordHash ou sessionVersion. É proibido desativar/rebaixar o último ADMIN e remover o próprio acesso administrativo.

Corpo Customer: `{name,cpf,phone,email?,zip,street,number,complement?,neighborhood,city,state,notes?,unitId,active?}`. CPF e telefone são normalizados para dígitos, CPF é validado por dígitos verificadores e é único globalmente. CEP tem oito dígitos.

Corpo Motorcycle: `{brand,model,year,color,chassis?,price,unitId,status?,notes?}`. Status de cadastro/edição: DISPONIVEL ou INATIVA. VENDIDA é definido pelo registro de venda. Chassi é único quando informado.

Filtros de cadastros: q, unitId (exceto units), active (true/false; unidades/clientes/funcionários), role (funcionários), status (motos). q pesquisa nome/código em unidades, nome em funcionários, nome/CPF/telefone em clientes, marca/modelo em motos.

## Vendas e parcelas

| Método / rota | Corpo / função |
|---|---|
| GET /sales | Lista de vendas autorizadas |
| GET /sales/:id | Detalhes e parcelas |
| POST /sales | `{customerId,motorcycleId,total,soldAt,installmentCount,firstDueAt}` |
| POST /sales/:id/cancel | ADMIN / GERENTE; `{reason}` com pelo menos cinco caracteres |
| GET /installments | Parcelas autorizadas |
| POST /installments/:id/pay | `{paidAt,notes?}` |
| POST /installments/:id/reverse | ADMIN / GERENTE; `{reason}` |

O responsável e a unidade da venda são definidos pelo backend a partir do usuário conectado e da moto. Não há campos para adulterar sellerId/unitId. Quantidade de parcelas: 1 a 120. Datas de venda e pagamento não podem ser futuras; primeiro vencimento deve ser a partir da venda. Cada parcela deve valer no mínimo um centavo.

Filtros de vendas: q (nome do cliente), from/to (data de venda), unitId, sellerId, customerId, status (ATIVA/CANCELADA).

Filtros de parcelas: from/to (vencimento), unitId, sellerId, customerId, saleId, status (PENDENTE/PAGA/ATRASADA/CANCELADA). ATRASADA é derivado na resposta; PENDENTE exclui vencimentos passados. Pagamentos só alteram parcelas pendentes de vendas ativas.

## Relatórios

GET /dashboard: filtros from, to, unitId. Retorna saleCount, customerCount, availableCount, overdueCount, upcomingCount, months, recent, upcoming, overdue, byUnit, bySeller. Os dois primeiros contadores e as vendas usam o período; estoque, atrasos e próximos sete dias usam a situação atual.

GET /audit-logs: somente ADMIN. Filtros userId, from, to, action, entity. Retorna responsável, ação, entidade, recordId, before, after, createdAt e ip. Não há endpoint de edição/exclusão de logs.

Ações usuais: CREATE, UPDATE, DEACTIVATE, CANCEL, PAY, REVERSE, LOGIN, LOGIN_FAILURE, LOGOUT, PASSWORD_RESET, BOOTSTRAP. Entidades: User, Unit, Customer, Motorcycle, Sale, Installment, Auth.

## Paginação e HTTP

Listagens aceitam page >= 1 e limit de 1 a 100 (padrão 20). Registros de cadastros ordenam por criação decrescente, vendas por data decrescente e parcelas por vencimento crescente. Os filtros são sempre combinados com o escopo de acesso, sem substituí-lo.

200: consulta/alteração; 201: criação; 401: sessão ausente/expirada/inativa; 403: perfil/unidade/CSRF sem permissão; 404: recurso ausente ou fora do escopo; 409: duplicidade/conflito de estado; 422: validação; 429: limite de login; 502: CEP indisponível; 500: erro interno sem detalhes sensíveis.
