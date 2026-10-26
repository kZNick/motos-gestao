import axios from 'axios';
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL || '/api',withCredentials:true});
let csrfToken='';
export const setCsrf=value=>{csrfToken=value || '';};
api.interceptors.request.use(config=>{if(csrfToken) config.headers['x-csrf-token']=csrfToken;return config;});
export const errorMessage=e=>{
 const error=e.response?.data?.error;
 const fields=error?.fields ? Object.entries(error.fields).filter(([,v])=>v.length).map(([k,v])=>k+': '+v.join(' ')).join(' · ') : '';
 return fields || error?.message || 'Não foi possível conectar ao servidor.';
};
export async function allOptions(resource,params={}) {
 const rows=[]; let page=1;
 while(true){const {data}=await api.get('/'+resource,{params:{...params,page,limit:100}});rows.push(...data.data);if(page>=data.meta.pages)break;page++;}
 return rows;
}

api.interceptors.response.use(r=>r,error=>{if(error.response?.status===401&&!['/auth/login','/auth/me'].includes(error.config?.url))window.dispatchEvent(new Event('session-expired'));return Promise.reject(error);});
