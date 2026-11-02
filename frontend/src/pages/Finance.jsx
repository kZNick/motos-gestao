import { calculateFinancing } from '../../../shared/financing.mjs';
import '../sales.css';
import { useState, useId } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Eye, Check, RotateCcw, UserPlus, ArrowLeft } from "lucide-react";
import { RecordForm } from "../components/RecordForm.jsx";
import { configs } from "../config/resources.jsx";
import { api, errorMessage, allOptions } from "../api.js";
import {
  Table,
  Badge,
  Modal,
  Loading,
  ErrorBox,
  Pagination,
  SearchBox,
  FilterBar,
  ConfirmForm,
  money,
  date,
  localDay,
} from "../components/ui.jsx";
export function SaleForm({ user, onSubmit, pending, error, onCustomerMode }) {
  const qc = useQueryClient(),
    customerSelectId = useId();
  const [values, setValues] = useState({
      customerId: "",
      motorcycleId: "",
      soldAt: localDay(),
      total: "",
      installmentCount: 1,
      firstDueAt: localDay(),
    }),
    [payment, setPayment] = useState("avista"),
    [creatingCustomer, setCreatingCustomer] = useState(false),
    [interestMode,setInterestMode] = useState("NONE"),
    [interestValue,setInterestValue] = useState("");
  const customers = useQuery({
    queryKey: ["customer-options"],
    queryFn: () => allOptions("customers", { active: true }),
  });
  const motos = useQuery({
    queryKey: ["moto-options"],
    queryFn: async () => {
      const [variants, individuals] = await Promise.all([
        allOptions("variants", { inStock: "true" }),
        allOptions("motorcycles", { status: "DISPONIVEL", unassigned: "true" }),
      ]);
      return [
        ...variants.map((v) => ({
          id: "variant:" + v.id,
          unitId: v.product.unitId,
          price: v.price,
          label:
            v.product.name +
            " · " +
            v.color +
            " · " +
            v.batteryType +
            " · " +
            v.stock +
            " em estoque" +
            (!user.selectedUnitId ? " · " + v.product.unit.name : ""),
        })),
        ...individuals.map((m) => ({
          ...m,
          label:
            m.brand +
            " " +
            m.model +
            " · " +
            m.color +
            " · " +
            (m.chassis || m.id.slice(0, 8)) +
            (!user.selectedUnitId ? " · " + m.unit?.name : ""),
        })),
      ];
    },
  });
  const createCustomer = useMutation({
    mutationFn: (data) => api.post("/customers", data),
    onSuccess: (r) => {
      const customer = r.data.data;
      qc.setQueryData(["customer-options"], (rows) => [
        ...(rows || []).filter((x) => x.id !== customer.id),
        customer,
      ]);
      qc.invalidateQueries({ queryKey: ["customer-options"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["finance-options"] });
      setValues((v) => ({ ...v, customerId: customer.id }));
      setCreatingCustomer(false);
      onCustomerMode?.(false);
    },
  });
  const set = (k, v) => setValues((x) => ({ ...x, [k]: v }));
  let amounts=null,financingError='';
  if(values.total){try{amounts=calculateFinancing(values.total,payment==='avista'?1:Number(values.installmentCount),payment==='avista'?'NONE':interestMode,interestMode==='NONE'?'0':interestValue);}catch(e){financingError=e.message;}}
  if (creatingCustomer)
    return (
      <div className="sale-customer">
        <button
          className="back-link"
          type="button"
          disabled={createCustomer.isPending}
          onClick={() => {setCreatingCustomer(false);onCustomerMode?.(false);}}
        >
          <ArrowLeft size={17} />
          Voltar à venda
        </button>
        <p className="muted">
          Preencha os dados do cliente e o endereço completo. Ao salvar, você volta à venda com o cliente selecionado.
        </p>
        <RecordForm
          fields={configs.customers.fields.filter((f) => f.key !== "active")}
          initial={{
            unitId:
              user.selectedUnitId ||
              motos.data?.find((m) => m.id === values.motorcycleId)?.unitId ||
              "",
          }}
          user={user}
          submitLabel="Salvar cliente e voltar"
          pending={createCustomer.isPending}
          error={
            createCustomer.isError ? errorMessage(createCustomer.error) : null
          }
          onSubmit={(data) => createCustomer.mutate(data)}
        />
      </div>
    );
  return (
    <form
      className="sale-simple"
      onSubmit={(e) => {
        e.preventDefault();
        if(!amounts)return;
        const payload = {
          ...values,
          financing:{mode:payment==='avista'?'NONE':interestMode,value:payment==='avista'||interestMode==='NONE'?'0':interestValue},
          installmentCount:
            payment === "avista" ? 1 : Number(values.installmentCount),
          firstDueAt: payment === "avista" ? values.soldAt : values.firstDueAt,
        };
        if (payload.motorcycleId.startsWith("variant:")) {
          payload.variantId = payload.motorcycleId.slice(8);
          delete payload.motorcycleId;
        }
        onSubmit(payload);
      }}
    >
      <div className="sale-fields">
      <ErrorBox error={error} />
      {(customers.isError || motos.isError) && (
        <ErrorBox error="Não foi possível carregar clientes ou motos." />
      )}
      <div className="sale-customer-select">
        <label htmlFor={customerSelectId}>Cliente</label>
        <div>
          <select
            id={customerSelectId}
            aria-label="Cliente"
            required
            value={values.customerId}
            onChange={(e) => set("customerId", e.target.value)}
          >
            <option value="">Selecione um cliente</option>
            {customers.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.cpf}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              createCustomer.reset();
              setCreatingCustomer(true);
              onCustomerMode?.(true);
            }}
          >
            <UserPlus size={17} />
            Cadastrar cliente
          </button>
        </div>
      </div>
      <label>
        Moto disponível
        <select
          aria-label="Moto disponível"
          required
          value={values.motorcycleId}
          onChange={(e) => {
            const m = motos.data.find((x) => x.id === e.target.value);
            setValues((v) => ({
              ...v,
              motorcycleId: e.target.value,
              total: m?.price || "",
            }));
          }}
        >
          <option value="">Selecione a moto e a variação</option>
          {motos.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      {motos.isSuccess && !motos.data.length && (
        <p className="callout">
          Não há motos disponíveis nesta unidade. Registre uma entrada de lote
          em Motos.
        </p>
      )}
      <div className="form-grid">
        <label>
          Valor negociado (R$)
          <input
            type="number"
            required
            min="0.01"
            step="0.01"
            value={values.total}
            onChange={(e) => set("total", e.target.value)}
          />
        </label>
        <label>
          Pagamento
          <select
            aria-label="Pagamento"
            value={payment}
            onChange={(e) => {
              setPayment(e.target.value);
              setInterestMode("NONE");setInterestValue("");
              setValues((v) => ({
                ...v,
                installmentCount:
                  e.target.value === "avista"
                    ? 1
                    : Math.max(2, v.installmentCount),
              }));
            }}
          >
            <option value="avista">À vista</option>
            <option value="parcelado">Parcelado</option>
          </select>
        </label>
        {payment === "parcelado" && (
          <>
            <label>
              Quantidade de parcelas
              <input
                type="number"
                required
                min="2"
                max="120"
                value={values.installmentCount}
                onChange={(e) => set("installmentCount", e.target.value)}
              />
            </label>
            <label>
              Primeiro vencimento
              <input
                type="date"
                required
                min={values.soldAt}
                value={values.firstDueAt}
                onChange={(e) => set("firstDueAt", e.target.value)}
              />
            </label>
            <label className="wide">Juros / ajuste das parcelas
              <select aria-label="Juros / ajuste das parcelas" value={interestMode} onChange={e=>{setInterestMode(e.target.value);setInterestValue('');}}>
                <option value="NONE">Sem juros</option><option value="AMOUNT">Adicionar juros em reais (R$)</option><option value="PERCENT">Adicionar juros em porcentagem (%)</option><option value="INSTALLMENT">Definir valor da parcela (R$)</option>
              </select>
            </label>
            {interestMode!=='NONE'&&<label className="wide">{interestMode==='PERCENT'?'Juros sobre o total (%)':interestMode==='AMOUNT'?'Juros sobre o total (R$)':'Valor de cada parcela (R$)'}
              <input aria-label={interestMode==='PERCENT'?'Juros sobre o total (%)':interestMode==='AMOUNT'?'Juros sobre o total (R$)':'Valor de cada parcela (R$)'} type="number" required min={interestMode==='INSTALLMENT'?'0.01':'0'} step="0.01" value={interestValue} onChange={e=>setInterestValue(e.target.value)}/>
              <small>{interestMode==='INSTALLMENT'?'O total e o acréscimo são recalculados pelo valor informado.':'Acréscimo único sobre o valor negociado, antes de dividir nas parcelas.'}</small>
            </label>}
          </>
        )}
      </div>
      {financingError&&<ErrorBox error={financingError}/>}
      {payment==='parcelado'&&amounts&&<div className="financing-summary" aria-live="polite"><div><small>Valor negociado</small><strong>{money(amounts.baseTotal)}</strong></div><div><small>Juros / acréscimo total</small><strong>{money(amounts.interestAmount)}</strong></div><div className="wide"><small>Parcelas</small><strong>{amounts.higherInstallments?`${amounts.higherInstallments} × ${money(amounts.higherAmount)} + ${Number(values.installmentCount)-amounts.higherInstallments} × ${money(amounts.installmentAmount)}`:`${values.installmentCount} × ${money(amounts.installmentAmount)}`}</strong></div></div>}
      <details className="sale-date">
        <summary>Data da venda: {date(values.soldAt)} · alterar</summary>
        <label>
          Data da venda
          <input
            type="date"
            required
            max={localDay()}
            value={values.soldAt}
            onChange={(e) => set("soldAt", e.target.value)}
          />
        </label>
      </details>
      </div>
      <footer className="sale-footer">
        <div>
          <small>Total da venda</small>
          <strong>{money(amounts?.total || 0)}</strong>
        </div>
        <button
          disabled={!amounts || pending || customers.isPending || motos.isPending || !values.customerId || !values.motorcycleId || !motos.data?.length}
          className="primary"
        >
          {pending ? "Registrando…" : "Confirmar venda"}
        </button>
      </footer>
    </form>
  );
}
export function Finance({ resource, user, notify }) {
  const isSale = resource === "sales",
    qc = useQueryClient(),
    [params] = useSearchParams();
  const [filters, setFilters] = useState({
      q: "",
      unitId: "",
      sellerId: "",
      customerId: "",
      from: "",
      to: "",
      status: params.get("status") || "",
    }),
    [page, setPage] = useState(1),
    [create, setCreate] = useState(false),
    [customerMode, setCustomerMode] = useState(false),
    [action, setAction] = useState(null);
  const query = useQuery({
    queryKey: [resource, filters, page],
    queryFn: async () =>
      (await api.get("/" + resource, { params: { ...filters, page } })).data,
  });
  const options = useQuery({
    queryKey: ["finance-options", user.role],
    queryFn: async () => {
      const [units, customers, users] = await Promise.all([
        allOptions("units"),
        allOptions("customers"),
        user.role === "VENDEDOR" ? Promise.resolve([]) : allOptions("users"),
      ]);
      return {
        units: units.filter(
          (u) => !user.selectedUnitId || u.id === user.selectedUnitId,
        ),
        customers,
        users,
      };
    },
  });
  function changed(k, v) {
    setFilters((x) => ({ ...x, [k]: v }));
    setPage(1);
  }
  const save = useMutation({
    mutationFn: (data) => api.post("/sales", data),
    onSuccess: () => {
      qc.invalidateQueries();
      setCreate(false);
      notify("Venda registrada e parcelas geradas.");
    },
  });
  const pay = useMutation({
    mutationFn: (data) =>
      api.post("/installments/" + action.row.id + "/" + action.type, data),
    onSuccess: () => {
      qc.invalidateQueries();
      setAction(null);
      notify("Operação registrada na auditoria.");
    },
  });
  const columns = isSale
    ? [
        {
          key: "code",
          label: "Código",
          render: (r) => "#" + String(r.code).padStart(5, "0"),
        },
        { key: "customer", label: "Cliente", render: (r) => r.customer.name },
        {
          key: "motorcycle",
          label: "Moto",
          render: (r) => r.motorcycle.brand + " " + r.motorcycle.model,
        },
        { key: "seller", label: "Vendedor", render: (r) => r.seller.name },
        { key: "unit", label: "Unidade", render: (r) => r.unit.name },
        { key: "soldAt", label: "Data", render: (r) => date(r.soldAt) },
        { key: "total", label: "Valor", render: (r) => money(r.total) },
        {
          key: "status",
          label: "Status",
          render: (r) => <Badge value={r.status} />,
        },
      ]
    : [
        {
          key: "sale",
          label: "Venda / cliente",
          render: (r) => (
            <Link to={"/sales/" + r.saleId}>
              #{r.sale.code} · {r.sale.customer.name}
            </Link>
          ),
        },
        {
          key: "number",
          label: "Parcela",
          render: (r) => r.number + "/" + r.sale.installmentCount,
        },
        {
          key: "unit",
          label: "Unidade / vendedor",
          render: (r) => (
            <>
              {r.sale.unit.name}
              <small className="subtext">{r.sale.seller.name}</small>
            </>
          ),
        },
        { key: "amount", label: "Valor", render: (r) => money(r.amount) },
        { key: "dueAt", label: "Vencimento", render: (r) => date(r.dueAt) },
        { key: "paidAt", label: "Pagamento", render: (r) => date(r.paidAt) },
        {
          key: "status",
          label: "Status",
          render: (r) => <Badge value={r.status} />,
        },
      ];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{isSale ? "Vendas" : "Parcelas"}</h1>
          <p>
            {isSale
              ? "Registre vendas e acompanhe cada negociação."
              : "Acompanhe vencimentos e registre pagamentos individuais."}
          </p>
        </div>
        {isSale && (
          <button
            className="primary"
            onClick={() => {
              save.reset();
              setCustomerMode(false);setCreate(true);
            }}
          >
            <Plus size={18} /> Nova venda
          </button>
        )}
      </div>
      <div className="panel">
        <FilterBar>
          {isSale && (
            <SearchBox
              value={filters.q}
              onChange={(v) => changed("q", v)}
              placeholder="Pesquisar cliente…"
            />
          )}
          {["units", "users", "customers"].map(
            (key) =>
              (key !== "users" || user.role !== "VENDEDOR") && (
                <select
                  key={key}
                  aria-label={"Filtrar " + key}
                  value={
                    filters[
                      key === "units"
                        ? "unitId"
                        : key === "users"
                          ? "sellerId"
                          : "customerId"
                    ]
                  }
                  onChange={(e) =>
                    changed(
                      key === "units"
                        ? "unitId"
                        : key === "users"
                          ? "sellerId"
                          : "customerId",
                      e.target.value,
                    )
                  }
                >
                  <option value="">
                    {key === "units"
                      ? user.selectedUnitId
                        ? "Unidade atual"
                        : "Todas as unidades"
                      : key === "users"
                        ? "Todos os vendedores"
                        : "Todos os clientes"}
                  </option>
                  {options.data?.[key].map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              ),
          )}
          <select
            aria-label="Status"
            value={filters.status}
            onChange={(e) => changed("status", e.target.value)}
          >
            <option value="">Todos os status</option>
            {(isSale
              ? ["ATIVA", "CANCELADA"]
              : ["PENDENTE", "PAGA", "ATRASADA", "CANCELADA"]
            ).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <label className="filter-date">
            {isSale ? "Vendas desde" : "Vencimento de"}
            <input
              type="date"
              value={filters.from}
              onChange={(e) => changed("from", e.target.value)}
            />
          </label>
          <label className="filter-date">
            Até
            <input
              type="date"
              value={filters.to}
              onChange={(e) => changed("to", e.target.value)}
            />
          </label>
        </FilterBar>
        <ErrorBox error={query.isError ? errorMessage(query.error) : null} />
        {query.isPending ? (
          <Loading />
        ) : (
          <Table
            columns={columns}
            rows={query.data?.data}
            actions={(r) =>
              isSale ? (
                <Link
                  className="icon-button"
                  aria-label="Ver venda"
                  to={"/sales/" + r.id}
                >
                  <Eye size={18} />
                </Link>
              ) : (
                <>
                  {["PENDENTE", "ATRASADA"].includes(r.status) && (
                    <button
                      className="row-button"
                      onClick={() => {
                        pay.reset();
                        setAction({ type: "pay", row: r });
                      }}
                    >
                      <Check size={16} /> Baixar
                    </button>
                  )}
                  {r.status === "PAGA" && user.role !== "VENDEDOR" && (
                    <button
                      className="row-button"
                      onClick={() => {
                        pay.reset();
                        setAction({ type: "reverse", row: r });
                      }}
                    >
                      <RotateCcw size={16} /> Estornar
                    </button>
                  )}
                </>
              )
            }
          />
        )}
        <Pagination meta={query.data?.meta} page={page} setPage={setPage} />
      </div>
      {create && (
        <Modal
          title={customerMode ? "Cadastrar cliente" : "Registrar nova venda"}
          className={"sale-dialog"+(customerMode ? " customer-dialog" : "")}
          onClose={() => !save.isPending && setCreate(false)}
        >
          <SaleForm
            onCustomerMode={setCustomerMode}
            user={user}
            onSubmit={(v) => save.mutate(v)}
            pending={save.isPending}
            error={save.isError ? errorMessage(save.error) : null}
          />
        </Modal>
      )}
      {action && (
        <Modal
          title={
            action.type === "pay" ? "Registrar pagamento" : "Estornar pagamento"
          }
          onClose={() => !pay.isPending && setAction(null)}
        >
          <ConfirmForm
            title={
              "Parcela " +
              action.row.number +
              " · " +
              money(action.row.amount) +
              " · " +
              action.row.sale.customer.name
            }
            paid={action.type === "pay"}
            reason={action.type === "reverse"}
            pending={pay.isPending}
            error={pay.isError ? errorMessage(pay.error) : null}
            onSubmit={(v) => pay.mutate(v)}
          />
        </Modal>
      )}
    </>
  );
}
