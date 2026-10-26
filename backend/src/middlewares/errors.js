import { ZodError } from 'zod';
export function errors(err,req,res,next) {
 if(err instanceof ZodError) return res.status(422).json({error:{message:'Revise os campos informados.',fields:err.flatten().fieldErrors}});
 if(err.code==='P2002') return res.status(409).json({error:{message:'Este CPF, e-mail, código ou chassi já está cadastrado.'}});
 if(err.code==='P2003') return res.status(409).json({error:{message:'Registro relacionado não encontrado ou ainda utilizado.'}});
 if(err.code==='P2025') return res.status(404).json({error:{message:'Registro não encontrado.'}});
 if(err.code==='P2034') return res.status(409).json({error:{message:'Outro usuário alterou este registro. Atualize a página e tente novamente.'}});
 if(err.type==='entity.parse.failed') return res.status(400).json({error:{message:'JSON inválido.'}});
 if(!err.status) console.error(err.name,err.message);
 res.status(err.status || 500).json({error:{message:err.status?err.message:'Não foi possível concluir a operação.'}});
}
