// Default permissions shared by API authorization and the access screen.
export const acl=[
 {key:'dashboard',label:'Consultar dashboard',roles:['ADMIN','GERENTE','VENDEDOR']},
 {key:'customers',label:'Cadastrar e editar clientes',roles:['ADMIN','GERENTE','VENDEDOR']},
 {key:'sales',label:'Registrar vendas e pagamentos',roles:['ADMIN','GERENTE','VENDEDOR']},
 {key:'stock',label:'Gerenciar motos, variações, lotes e preços',roles:['ADMIN','GERENTE']},
 {key:'cancel',label:'Cancelar vendas e estornar pagamentos',roles:['ADMIN','GERENTE']},
 {key:'teamRead',label:'Consultar equipe',roles:['ADMIN','GERENTE']},
 {key:'teamWrite',label:'Gerenciar funcionários e senhas',roles:['ADMIN']},
 {key:'units',label:'Gerenciar unidades',roles:['ADMIN']},
 {key:'audit',label:'Consultar auditoria',roles:['ADMIN']}
];
export const permissionsFor=role=>acl.filter(p=>p.roles.includes(role)).map(p=>p.key);
