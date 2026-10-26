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
