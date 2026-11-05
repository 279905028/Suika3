'use strict';
const rows=[
 ['XM-E1','xiaoman','T-XM-000826_1',{'XM07-01':'A','XM08-01':'A'},null,'assets/current/SUI-A10-XM/cg-xm-cg023.webp'],
 ['ZZ-E1','zhouzhi','T-ZZ-000478_1',{'ZZ06-01':'A','ZZ08-01':'A'},null,'assets/current/SUI-A10-ZZ/cg-zz-cg035.webp'],
 ['MY-E1','mengyao','T-MY-000349_1',{'MY07-01':'A','MY09-01':'A'},null,'assets/current/SUI-A10-MY/cg-my-cg104.webp'],
 ['PI-E1','piao','T-PI-000444_1',{'PI06-01':'A','PI08-01':'A'},'HIGH','assets/sources/20261104/P4-V/PI-E1/first-frame-v001.webp'],
 ['PI-LE1','piao','T-PI-000630_1',{'PI-L06-01':'A'},'LOW','assets/current/SUI-A10-PI/cg-pi-cg068.webp'],
 ['HQ-E1','huangqiuqiu','T-HQ-000586_1',{'HQ07-01':'A','HQ08-01':'A','C01-02':'A','C02-01':'A'},null,'assets/sources/20261103/P4-04/CG109/cg109-v002.webp']
];
const items=rows.map(([ending,route,node,choices,relation,fallback])=>({key:'MCG-'+ending,ending,route,node,choices,relation,fallback,meeting:ending==='HQ-E1',adopted:false}));
function eligible(item,state){return !!state&&state.route===item.route&&state.node===item.node&&(!item.relation||state.relation===item.relation)&&Object.entries(item.choices).every(([k,v])=>state.choices?.[k]===v)&&(!item.meeting||state.meeting===true);}
module.exports={items,eligible};
