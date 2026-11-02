import '../inventory.css';
import { colorKey,swatchesFor } from '../../../shared/colors.mjs';
import { ColorSwatch } from '../components/ColorSwatch.jsx';
import { useState } from 'react';
import { useQuery,useMutation,useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus,ArrowUpRight,Package } from 'lucide-react';
import { api,errorMessage,allOptions } from '../api.js';
import { FilterBar,Loading,ErrorBox,Empty,Modal,SearchBox,Pagination,money } from '../components/ui.jsx';
import { MotorcyclePhoto } from '../components/MotorcyclePhoto.jsx';
import { ProductForm } from '../components/InventoryForms.jsx';
export function Inventory({user,notify}) {
 const qc=useQueryClient(),[q,setQ]=useState(''),[unitId,setUnitId]=useState(''),[page,setPage]=useState(1),[creating,setCreating]=useState(false);
 const canManage=user.role!=='VENDEDOR';
 const query=useQuery({queryKey:['products',q,unitId,page],queryFn:async()=>(await api.get('/products',{params:{q,unitId,page}})).data});
 const units=useQuery({queryKey:['inventory-units',user.selectedUnitId],queryFn:async()=>(await allOptions('units',{active:true})).filter(u=>!user.selectedUnitId||u.id===user.selectedUnitId)});
 const save=useMutation({mutationFn:data=>api.post('/products',data),onSuccess:()=>{qc.invalidateQueries();setCreating(false);notify('Produto cadastrado. Adicione as variações e os lotes.');}});
 return <><div className="page-heading"><div><span className="eyebrow">CATÁLOGO E ESTOQUE</span><h1>Motos</h1><p>Cadastre o produto, organize as variações e acompanhe cada lote.</p></div><div className="heading-actions"><Link className="secondary" to="/motorcycles/individuals">Motos avulsas</Link>{canManage&&<button className="primary" onClick={()=>{save.reset();setCreating(true);}}><Plus size={18}/>Adicionar produto</button>}</div></div><div className="panel"><FilterBar><SearchBox placeholder="Pesquisar produto ou marca…" value={q} onChange={v=>{setQ(v);setPage(1);}}/><select aria-label="Unidade do catálogo" value={unitId} onChange={e=>{setUnitId(e.target.value);setPage(1);}}><option value="">{user.selectedUnitId?'Unidade atual':'Todas as unidades'}</option>{units.data?.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></FilterBar><ErrorBox error={query.isError?errorMessage(query.error):null}/>{query.isPending?<Loading/>:query.data?.data.length?<div className="catalog-grid">{query.data.data.map(p=>{const colors=[...new Map(p.variants.map(v=>[colorKey(v),v])).values()];return <Link className="catalog-item" key={p.id} to={'/motorcycles/products/'+p.id}><div className="catalog-photo"><span className="catalog-unit">{p.unit.name}</span><MotorcyclePhoto key={p.imageUrl||p.id} url={p.imageUrl} name={p.name} large/></div><div className="catalog-item-info"><small>{p.brand} · {p.active?'Ativa':'Inativa'}</small><h2>{p.name}</h2><div className="catalog-item-price">{money(p.basePrice)}<small>preço padrão</small></div><div className="catalog-color-preview">{colors.slice(0,6).map(v=><span title={v.color} key={colorKey(v)}><ColorSwatch colors={swatchesFor(v)}/></span>)}<small>{colors.length} {colors.length===1?'cor':'cores'}</small></div><div className="catalog-item-bottom"><span><Package size={15}/>{p.stock} disponíveis</span><strong>Escolher cor<ArrowUpRight size={17}/></strong></div></div></Link>;})}</div>:<Empty text="Nenhum produto cadastrado nesta unidade."/>}<Pagination meta={query.data?.meta} page={page} setPage={setPage}/></div>{creating&&<Modal title="Adicionar produto" onClose={()=>!save.isPending&&setCreating(false)}><ProductForm user={user} onSubmit={data=>save.mutate(data)} pending={save.isPending} error={save.isError?errorMessage(save.error):null}/></Modal>}</>;
}
