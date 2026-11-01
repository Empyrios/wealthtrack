/** All financial amounts are stored in integer GBP pence. No prices are live. */
export const VERSION = 1;
export const STORAGE_KEY = 'wealthtrack:v1';
export const MAX_PENCE = 100_000_000_000; // £1bn per line item, cap corrupted input
export const CATEGORIES = Object.freeze(['Housing','Food & drink','Shopping','Transport','Health','Entertainment','Utilities','Education','Subscriptions','Travel','Gifts','Other']);
export const INCOME_CATEGORIES = Object.freeze(['Salary','Tutoring','Interest','Dividends','Gifts','Refund','Other']);
export const ACCOUNT_TYPES = Object.freeze(['bank','cash-isa','investment','cash','debt']);
export const INITIAL = () => ({version:VERSION, accounts:[], transactions:[], holdings:[], goals:[], budgets:[], lastSaved:null});
export const id = () => crypto.randomUUID();
export function isDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v}
export function today(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
export function monthOf(date){return date.slice(0,7)}
export function monthShift(ym,offset){const [y,m]=ym.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+offset,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`}
export function parseMoney(value,{signed=false}={}){
  const v=String(value??'').trim().replace(/,/g,'');
  if(!/^-?\d{1,10}(?:\.\d{1,2})?$/.test(v))throw new Error('Enter a valid £ amount with up to 2 decimal places.');
  const neg=v.startsWith('-');if(neg&&!signed)throw new Error('This amount must be positive.');
  const [whole,decimal='']=v.replace('-','').split('.');
  const pence=Number(whole)*100+Number(decimal.padEnd(2,'0'));
  if(!Number.isSafeInteger(pence)||pence>MAX_PENCE)throw new Error('Amount exceeds the supported limit.');
  return neg?-pence:pence;
}
export function inputMoney(pence){const sign=pence<0?'-':'';const n=Math.abs(pence);return `${sign}${Math.floor(n/100)}.${String(n%100).padStart(2,'0')}`}
export function money(pence){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',minimumFractionDigits:2,maximumFractionDigits:2}).format(pence/100)}
export function parseUnits(value){
  const v=String(value??'').trim().replace(/,/g,'');
  if(!/^\d{1,8}(?:\.\d{1,6})?$/.test(v))throw new Error('Units must be positive with up to 6 decimals.');
  const [i,f='']=v.split('.');const n=Number(i)*1_000_000+Number(f.padEnd(6,'0'));
  if(!Number.isSafeInteger(n)||n<=0||n>1_000_000_000_000)throw new Error('Unsupported number of units.');
  return n;
}
export function inputUnits(micro){return (micro/1_000_000).toFixed(6).replace(/0+$/,'').replace(/\.$/,'')}
export function holdingValue(holding,priceField='pricePence'){
  return Number((BigInt(holding.unitsMicro)*BigInt(holding[priceField])+500000n)/1000000n);
}
export function portfolio(holdings){
  let value=0,cost=0;
  for(const h of holdings){value+=holdingValue(h);cost+=holdingValue(h,'costPence')}
  return {value,cost,change:value-cost,percent:cost?((value-cost)/cost)*100:null};
}
export function balances(state){
  const all=Object.fromEntries(state.accounts.map(a=>[a.id,a.openingPence]));
  for(const t of state.transactions){
    if(t.type==='income')all[t.accountId]+=t.amountPence;
    else if(t.type==='expense')all[t.accountId]-=t.amountPence;
    else if(t.type==='transfer'){all[t.accountId]-=t.amountPence;all[t.toAccountId]+=t.amountPence}
  }
  return all;
}
export function snapshot(state){
  const b=balances(state),p=portfolio(state.holdings);
  const cash=state.accounts.filter(a=>a.type!=='debt').reduce((sum,a)=>sum+b[a.id],0);
  const liabilities=state.accounts.filter(a=>a.type==='debt').reduce((sum,a)=>sum+b[a.id],0);
  const cashInvesting=state.accounts.filter(a=>a.type==='investment').reduce((sum,a)=>sum+b[a.id],0);
  const total=cash+liabilities+p.value;
  return {balances:b,investments:p.value+cashInvesting,holdings:p.value,cash:cash-cashInvesting,liabilities,netWorth:total,portfolio:p};
}
export function monthSummary(state,ym){
  const tx=state.transactions.filter(t=>monthOf(t.date)===ym);
  let income=0,expenses=0;
  const byCategory=Object.fromEntries(CATEGORIES.map(x=>[x,0]));
  for(const t of tx){if(t.type==='income')income+=t.amountPence;if(t.type==='expense'){expenses+=t.amountPence;byCategory[t.category]=(byCategory[t.category]??0)+t.amountPence}}
  return {income,expenses,net:income-expenses,byCategory,transactions:tx};
}
export function monthSeries(state,ym,count=6){return Array.from({length:count},(_,i)=>{const month=monthShift(ym,i-count+1);return {month,...monthSummary(state,month)}})}
export function budgetUsage(state,ym){const m=monthSummary(state,ym);return state.budgets.map(b=>({...b,usedPence:m.byCategory[b.category]||0,remainingPence:b.limitPence-(m.byCategory[b.category]||0)}))}
export function goalProgress(goal){return goal.targetPence>0?Math.min(100,Math.max(0,goal.savedPence/goal.targetPence*100)):0}
const obj=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
const str=(v,max=120)=>typeof v==='string'&&v.length<=max;
const integer=(n,{negative=false,max=MAX_PENCE}={})=>Number.isSafeInteger(n)&&n<=max&&(negative?n>=-max:n>=0);
const date= v=>isDate(v);
const unique=list=>new Set(list.map(x=>x.id)).size===list.length;
const list=(x,max)=>Array.isArray(x)&&x.length<=max;
const sid=x=>str(x,80)&&/^[a-zA-Z0-9_-]{1,80}$/.test(x);
export function validateState(s){
  if(!obj(s)||s.version!==VERSION||!list(s.accounts,150)||!list(s.transactions,10000)||!list(s.holdings,1000)||!list(s.goals,500)||!list(s.budgets,100)||!unique(s.accounts)||!unique(s.transactions)||!unique(s.holdings)||!unique(s.goals)||!unique(s.budgets))throw Error('Backup format or item counts are invalid.');
  if(!s.accounts.every(a=>obj(a)&&sid(a.id)&&str(a.name,80)&&a.name.trim().length>0&&ACCOUNT_TYPES.includes(a.type)&&integer(a.openingPence,{negative:true})))throw Error('Invalid account data.');
  const accounts=new Set(s.accounts.map(a=>a.id));
  if(!s.transactions.every(t=>obj(t)&&sid(t.id)&&['income','expense','transfer'].includes(t.type)&&date(t.date)&&integer(t.amountPence)&&t.amountPence>0&&accounts.has(t.accountId)&&str(t.note,240)&&str(t.category,60)&& (t.type==='transfer'?(accounts.has(t.toAccountId)&&t.toAccountId!==t.accountId):(t.type==='income'?INCOME_CATEGORIES.includes(t.category):CATEGORIES.includes(t.category)))))throw Error('Invalid transaction data.');
  if(!s.holdings.every(h=>obj(h)&&sid(h.id)&&accounts.has(h.accountId)&&s.accounts.find(a=>a.id===h.accountId)?.type==='investment'&&str(h.name,80)&&!!h.name.trim()&&str(h.ticker,16)&&integer(h.unitsMicro,{max:1_000_000_000_000})&&h.unitsMicro>0&&integer(h.costPence)&&integer(h.pricePence)))throw Error('Invalid holdings.');
  if(!s.goals.every(g=>obj(g)&&sid(g.id)&&str(g.name,80)&&!!g.name.trim()&&integer(g.targetPence)&&g.targetPence>0&&integer(g.savedPence)))throw Error('Invalid goals.');
  if(!s.budgets.every(b=>obj(b)&&sid(b.id)&&CATEGORIES.includes(b.category)&&integer(b.limitPence)&&b.limitPence>0)||new Set(s.budgets.map(b=>b.category)).size!==s.budgets.length)throw Error('Invalid or duplicate budgets.');
  if(s.lastSaved!==null&&s.lastSaved!==undefined&&(!str(s.lastSaved,40)||!Number.isFinite(Date.parse(s.lastSaved))))throw Error('Invalid save timestamp.');
  return structuredClone({...s,lastSaved:s.lastSaved||null});
}
export function sampleState(){
  const s=INITIAL(),ym=monthOf(today());
  s.accounts=[{id:'bank1',name:'Current account',type:'bank',openingPence:280000},{id:'isa1',name:'Cash ISA',type:'cash-isa',openingPence:720000},{id:'inv1',name:'Investment account',type:'investment',openingPence:90000},{id:'cc1',name:'Credit card',type:'debt',openingPence:-35000}];
  const mk=(d)=>`${ym}-${String(d).padStart(2,'0')}`;
  s.transactions=[{id:'tx1',type:'income',date:mk(1),accountId:'bank1',amountPence:225000,category:'Salary',note:'Example salary'},{id:'tx2',type:'expense',date:mk(2),accountId:'bank1',amountPence:65000,category:'Housing',note:'Example rent'},{id:'tx3',type:'expense',date:mk(3),accountId:'bank1',amountPence:1875,category:'Food & drink',note:'Example groceries'},{id:'tx4',type:'transfer',date:mk(4),accountId:'bank1',toAccountId:'isa1',amountPence:20000,category:'Transfer',note:'Example saving'}];
  s.holdings=[{id:'h1',accountId:'inv1',name:'Example index fund',ticker:'DEMO',unitsMicro:12500000,costPence:12000,pricePence:13450}];
  s.goals=[{id:'g1',name:'Emergency fund',targetPence:300000,savedPence:125000}];
  s.budgets=[{id:'b1',category:'Food & drink',limitPence:25000},{id:'b2',category:'Entertainment',limitPence:12000}];
  return s;
}
export function transactionCsv(state){
  const csv=v=>{const raw=String(v??'');const safe=/^[=+@\-\t\r\n]/.test(raw)?'\''+raw:raw;return '"'+safe.replaceAll('"','""')+'"'};
  const heads=['Date','Type','Account','To Account','Category','Amount (GBP)','Note'];
  const a=new Map(state.accounts.map(a=>[a.id,a.name]));
  return [heads,...state.transactions.map(t=>[t.date,t.type,a.get(t.accountId)||'',t.type==='transfer'?a.get(t.toAccountId)||'':'',t.category,inputMoney(t.amountPence),t.note])].map(row=>row.map(csv).join(',')).join('\r\n')+'\r\n';
}
