import test from 'node:test';
import assert from 'node:assert/strict';
import {INITIAL,CATEGORIES,ACCOUNT_TYPES,parseMoney,inputMoney,money,parseUnits,inputUnits,holdingValue,portfolio,balances,snapshot,monthSummary,monthSeries,budgetUsage,goalProgress,validateState,sampleState,transactionCsv,isDate,monthShift} from '../site/domain.mjs';

test('precision: GBP amounts always use pence',()=>{
 assert.equal(parseMoney('£3.10'.replace('£','')),310);
 assert.equal(parseMoney('1,000.05'),100005);
 assert.equal(parseMoney('-75.01',{signed:true}),-7501);
 assert.equal(inputMoney(-7501),'-75.01');
 assert.equal(money(1234),'£12.34');
 for(const bad of ['12.345','2e3','£17','NaN','Infinity','-1'])assert.throws(()=>parseMoney(bad));
});
test('share quantities use micro-units and value rounds to penny',()=>{
 assert.equal(parseUnits('0.000001'),1);
 assert.equal(inputUnits(1234567),'1.234567');
 assert.equal(holdingValue({unitsMicro:12500000,pricePence:13450}),168125);
 assert.equal(holdingValue({unitsMicro:500000,pricePence:101}),51);
 assert.throws(()=>parseUnits('0.0000001'));
});
test('cash movements: transfers have zero net worth impact',()=>{
 const s=INITIAL();s.accounts=[{id:'a',name:'A',type:'bank',openingPence:100000},{id:'b',name:'B',type:'cash-isa',openingPence:0}];
 s.transactions=[{id:'t',type:'transfer',accountId:'a',toAccountId:'b',date:'2026-11-01',amountPence:70000,note:'Save',category:'Transfer'}];
 assert.deepEqual(balances(s),{a:30000,b:70000});assert.equal(snapshot(s).netWorth,100000);
 const m=monthSummary(s,'2026-11');assert.equal(m.income,0);assert.equal(m.expenses,0);assert.equal(m.net,0);
});
test('investment market values count once and debt subtracts from net worth',()=>{
 const s=INITIAL();s.accounts=[{id:'a',name:'Cash',type:'bank',openingPence:150000},{id:'b',name:'Broker',type:'investment',openingPence:25000},{id:'c',name:'Debt',type:'debt',openingPence:-35000}];
 s.holdings=[{id:'h',name:'Example',ticker:'ABC',accountId:'b',unitsMicro:2000000,costPence:10000,pricePence:14500}];
 const x=snapshot(s);assert.equal(x.holdings,29000);assert.equal(x.investments,54000);assert.equal(x.netWorth,169000);
 assert.equal(portfolio(s.holdings).change,9000);
});
test('spending categories and budgets reset by month',()=>{
 const s=sampleState();const ym=s.transactions[0].date.slice(0,7);
 const m=monthSummary(s,ym);assert.equal(m.income,225000);assert.equal(m.expenses,66875);assert.equal(m.byCategory['Food & drink'],1875);
 const goals=budgetUsage(s,ym);assert.equal(goals.find(x=>x.category==='Food & drink').remainingPence,23125);
 assert.equal(monthSummary(s,monthShift(ym,-1)).expenses,0);
 assert.equal(monthSeries(s,ym,6).length,6);
});
test('dates validate leap years and calendar boundaries',()=>{
 assert.equal(isDate('2028-02-29'),true);assert.equal(isDate('2026-02-29'),false);
 assert.equal(isDate('2026-11-31'),false);assert.equal(monthShift('2026-01',-1),'2025-12');
});
test('backup validation rejects malformed data and broken foreign keys',()=>{
 assert.doesNotThrow(()=>validateState(sampleState()));
 assert.throws(()=>validateState({version:2,accounts:[],transactions:[],holdings:[],budgets:[],goals:[]}));
 const s=sampleState();s.transactions[0].accountId='missing';assert.throws(()=>validateState(s));
});
test('backup validation rejects duplicate IDs and duplicate category budgets',()=>{
 const s=sampleState();s.accounts.push({...s.accounts[0]});assert.throws(()=>validateState(s));
 const a=sampleState();a.budgets.push({id:'b3',category:'Food & drink',limitPence:500});assert.throws(()=>validateState(a));
});
test('goals are not double-counted as assets',()=>{
 const s=sampleState();const before=snapshot(s).netWorth;
 s.goals[0].savedPence=250000;assert.equal(snapshot(s).netWorth,before);assert.equal(goalProgress(s.goals[0]),250000/300000*100);
});
test('CSV escapes embedded quotes',()=>{
 const s=sampleState();s.transactions[0].note='He said "hello", thank you';
 const csv=transactionCsv(s);assert.ok(csv.includes('"He said ""hello"", thank you"'));
 assert.equal(csv.split('\r\n').length,s.transactions.length+2);
});
test('schema enforces validated categories and account types',()=>{
 assert.ok(ACCOUNT_TYPES.includes('cash-isa'));assert.ok(CATEGORIES.includes('Housing'));
 const s=sampleState();s.accounts[0].type='fake';assert.throws(()=>validateState(s));
});

test('CSV neutralises spreadsheet formulas entered as notes',()=>{
 const s=sampleState();s.transactions[0].note='=HYPERLINK(\"https://example.com\")';
 const text=transactionCsv(s);assert.ok(text.includes("'"+'=HYPERLINK('));
});
