const PHONE_WA='201034745251', OFFER_PRICE=35, OFFER_TOTAL=100;
// Delivery fee per area (EGP). Pickup from the branch is always free.
const ZONES={'زهراء مدينة نصر':20,'الواحة':20};
const BRANCH='زهراء مدينة نصر — موقف الحي العاشر';
// Google Sheets order log: paste the Apps Script Web App URL (ends with /exec).
// While this is the placeholder, nothing is sent and ordering works as before.
const SHEETS_URL='PASTE_YOUR_WEB_APP_URL_HERE';
const ITEMS=[
 {id:'kebda',cat:'kebda',name:'كبدة',desc:'كبدة اسكندراني حراقة في عيش فينو',price:25,img:'kebda-v2',badge:'الأكثر طلباً'},
 {id:'khalta',cat:'sogo2',name:'سجق بالخلطة',desc:'سجق بالخلطة والفلفل الألوان',price:35,img:'khalta-v2'},
 {id:'sharqy',cat:'sogo2',name:'سجق شرقي سادة',desc:'سجق شرقي مشوي في عيش فينو',price:35,img:'bw-sharqy'},
 {id:'sharqyc',cat:'sogo2',name:'سجق شرقي بالجبنة',desc:'سجق شرقي مشوي مع جبنة سايحة',price:40,img:'sharqy-cheese-v2'},
 {id:'mda5n',cat:'mda5n',name:'مدخن',desc:'لحمة مدخنة في عيش فينو',price:25,img:'bw-mda5n'},
 {id:'panne',cat:'panne',name:'بانيه',desc:'بانيه فراخ مقرمش مع الخس والصوص',price:120,img:'bw-panne'},
 {id:'burger',cat:'burger',name:'كلاسيك برجر',desc:'كلاسيك برجر بالجبنة',price:130,img:'bw-burger',badge:'مميز'},
 {id:'patty',cat:'addon',name:'قطعة برجر زيادة',desc:'قطعة لحمة برجر زيادة جوه الساندوتش',price:90,img:'bw-burger',side:1,hidden:1,addonFor:['burger']},
 {id:'sakalans',cat:'sweet',name:'سكلانس',desc:'حلاوة بالقشطة والمربى في عيش فينو',price:35,img:'bw-sakalans'},
 {id:'fries',cat:'sides',name:'بطاطس',desc:'بطاطس مقلية مقرمشة',price:25,img:'bw-fries',side:1},
 {id:'tahina',cat:'sides',name:'طحينة',desc:'طحينة طازة',price:15,img:'bw-tahina',side:1},
 {id:'pickles',cat:'sides',name:'مخلل',desc:'مخلل بلدي',price:10,img:'bw-pickles',side:1},
 {id:'tomato',cat:'sides',name:'طماطم متبلة',desc:'طماطم متبلة بالتوابل والكزبرة',price:15,img:'bw-tomato',side:1},
 // drinks & snacks — prices are placeholders until the restaurant confirms them
 {id:'pepsi',cat:'drinks',name:'بيبسي',desc:'كانز ساقع',price:20,img:'pepsi',side:1,drink:1},
 {id:'7up',cat:'drinks',name:'سفن أب',desc:'كانز ساقع',price:20,img:'7up',side:1,drink:1},
 {id:'mirinda',cat:'drinks',name:'ميرندا برتقال',desc:'كانز ساقع',price:20,art:['can','#F26A10','#1E9E3A','#FFF1E6'],side:1,drink:1},
 {id:'vcola',cat:'drinks',name:'في كولا',desc:'كانز ساقع',price:20,img:'vcola',side:1,drink:1},
 {id:'vdiet',cat:'drinks',name:'في كولا دايت',desc:'كانز ساقع — بدون سكر',price:20,img:'vcola-diet',side:1,drink:1},
 {id:'v7lemon',cat:'drinks',name:'في ٧ ليمون نعناع',desc:'كانز ساقع بقطع الليمون',price:20,img:'v7-lemon',side:1,drink:1},
 {id:'juice',cat:'drinks',name:'عصير جهينة برتقال',desc:'علبة ٢٣٥ مل ساقعة',price:15,img:'juice',side:1,drink:1},
 {id:'water',cat:'drinks',name:'مياه',desc:'مياه معدنية اكوا دلتا',price:10,img:'water',side:1,drink:1},
 {id:'chipsy',cat:'drinks',name:'شيبسي',desc:'شطة حارة وليمون',price:15,img:'chipsy',side:1,drink:1},
];
// Combo: fries + a can for each burger or panne, picked in the cart.
const COMBO_PRICE=45, COMBO_FOR=['burger','panne'];
ITEMS.filter(i=>i.drink&&/كانز/.test(i.desc)).forEach(d=>ITEMS.push({id:'combo_'+d.id,cat:'addon',name:'كومبو: بطاطس + '+d.name,desc:'بطاطس + '+d.name,price:COMBO_PRICE,img:'bw-fries',side:1,hidden:1,combo:1,drinkName:d.name}));
function artSrc([k,c1,c2,bg]){
  const shadow='<ellipse cx="100" cy="176" rx="46" ry="7" fill="#000" opacity=".12"/>';
  const shapes={
   can:`<rect x="72" y="34" width="56" height="12" rx="5" fill="#C9CDD3"/><rect x="68" y="42" width="64" height="126" rx="12" fill="${c1}"/><path d="M68 96q32-22 64 0v22q-32-22-64 0z" fill="${c2}"/><path d="M68 112q32-14 64 0v6q-32-14-64 0z" fill="#fff" opacity=".85"/><rect x="66" y="160" width="68" height="10" rx="5" fill="#B9BEC5"/><rect x="78" y="52" width="8" height="100" rx="4" fill="#fff" opacity=".28"/><circle cx="120" cy="64" r="3" fill="#fff" opacity=".6"/><circle cx="114" cy="140" r="2.5" fill="#fff" opacity=".6"/>`,
   carton:`<path d="M70 62l12-26h36l12 26z" fill="${c2}"/><rect x="70" y="62" width="60" height="108" rx="4" fill="${c1}"/><rect x="104" y="22" width="5" height="22" rx="2" fill="#fff" transform="rotate(14 106 33)"/><circle cx="100" cy="112" r="20" fill="${c2}"/><path d="M100 92q8-10 16-6q-6 8-16 6z" fill="#3E9B3A"/><rect x="78" y="70" width="7" height="92" rx="3.5" fill="#fff" opacity=".22"/>`,
   bottle:`<rect x="88" y="22" width="24" height="14" rx="3" fill="${c1}"/><path d="M90 36h20v12q16 10 16 30v80q0 10-10 10h-32q-10 0-10-10v-80q0-20 16-30z" fill="${c2}" opacity=".9"/><rect x="74" y="98" width="52" height="34" fill="${c1}"/><path d="M76 115q12-8 24 0t24 0" stroke="#fff" stroke-width="3" fill="none"/><rect x="82" y="58" width="7" height="100" rx="3.5" fill="#fff" opacity=".5"/>`,
   bag:`<path d="M56 40h88l-4 8 4 8-4 8q8 50 0 100l4 8-4 8 4 8H56l4-8-4-8 4-8q-8-50 0-100l-4-8 4-8z" fill="${c1}"/><path d="M60 100h80v30H60z" fill="${c2}"/><ellipse cx="100" cy="82" rx="22" ry="14" fill="#F2B544" stroke="#C98A1E" stroke-width="3"/><ellipse cx="88" cy="150" rx="12" ry="8" fill="#F2B544"/><ellipse cx="114" cy="155" rx="10" ry="7" fill="#F2B544"/>`};
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${bg}"/><circle cx="100" cy="104" r="78" fill="#fff" opacity=".55"/>${shadow}${shapes[k]}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
ITEMS.forEach(i=>{i.src=i.art?artSrc(i.art):'img/'+i.img+'.jpg';i.offer=!i.side&&i.price===OFFER_PRICE});
const BY=Object.fromEntries(ITEMS.map(i=>[i.id,i]));
const CATS=[['all','الكل',null],['offer','العروض','٣'],['kebda','كبدة','kebda'],['sogo2','سجق','sharqy'],['mda5n','مدخن','mda5n'],['panne','بانيه','panne'],['burger','برجر','burger'],['sweet','سكلانس','sakalans'],['sides','بطاطس وإضافات','fries'],['drinks','مشروبات وسناكس','pepsi']];
const $=s=>document.querySelector(s), ar=n=>String(n);
let cart={}; try{cart=JSON.parse(localStorage.getItem('be_cart')||'{}')||{}}catch(e){cart={}}
for(const k in cart) if(!BY[k]||!(cart[k]>0)) delete cart[k];
const save=()=>{try{localStorage.setItem('be_cart',JSON.stringify(cart))}catch(e){}};
let filter='all', step='cart';

// ticker
const tk=ITEMS.filter(i=>!i.side).map(i=>`<span>${i.name}</span>`).join('');
$('#ticker').innerHTML=tk+tk+tk+tk;

// categories
$('#catBar').innerHTML=CATS.map(([k,l,im])=>`<button class="cat" data-filter="${k}" aria-pressed="${k==='all'}">${im?(BY[im]?`<img src="${BY[im].src}" alt="">`:`<span class="ph">${im}</span>`):'<span class="ph">✦</span>'}${l}</button>`).join('');

function ctrl(i){const q=cart[i.id]||0;
  return q?`<div class="stepper" data-id="${i.id}"><button data-act="dec" aria-label="أقل">−</button><output class="num">${q}</output><button data-act="inc" aria-label="أكتر">+</button></div>`
          :`<button class="add" data-act="inc" data-id="${i.id}">+ أضف للسلة</button>`}
function card(i){const b=[i.badge?`<span class="badge">${i.badge}</span>`:'',i.offer?`<span class="badge y">داخل عرض ٣ بـ ١٠٠</span>`:''].join('');
  return `<article class="p-card" data-open="${i.id}" tabindex="0" aria-label="${i.name}">
   <div class="p-media"><img src="${i.src}" alt="${i.name}" loading="lazy"><div class="badges">${b}</div></div>
   <div class="p-body"><h3>${i.name}</h3><p>${i.desc}</p>
   <div class="p-foot"><span class="price num">${ar(i.price)} <small>ج</small></span><span class="ctl" data-ctl="${i.id}">${ctrl(i)}</span></div></div></article>`}
function renderGrid(){
  const list=ITEMS.filter(i=>!i.hidden&&(filter==='all'||(filter==='offer'?i.offer:i.cat===filter)));
  $('#grid').innerHTML=list.map(card).join('')||'<div class="empty-filter">مفيش أصناف هنا دلوقتي</div>';
  document.querySelectorAll('.cat').forEach(c=>c.setAttribute('aria-pressed',c.dataset.filter===filter));
}
function renderBoard(){
  $('#board').innerHTML=ITEMS.filter(i=>i.drink).map(i=>`<div class="tile" data-open="${i.id}" tabindex="0" aria-label="${i.name}"><img src="${i.src}" alt="${i.name}">
   <div class="tile-body"><div class="tile-row"><b>${i.name}</b><span class="price num">${ar(i.price)} <small>ج</small></span></div><span class="ctl" data-ctl="${i.id}">${ctrl(i)}</span></div></div>`).join('');
}
function setFilter(f){filter=f;renderGrid();
  const el=document.querySelector(`.cat[data-filter="${f}"]`); el&&el.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});}

// totals
function calc(){
  let sub=0,count=0,offerUnits=0;
  for(const [k,q] of Object.entries(cart)){const i=BY[k];sub+=i.price*q;count+=q;if(i.offer)offerUnits+=q}
  const groups=Math.floor(offerUnits/3), disc=groups*(OFFER_PRICE*3-OFFER_TOTAL);
  const fee=form.mode==='pickup'?0:(ZONES[form.area]??0);
  return {sub,count,offerUnits,groups,disc,fee,total:count?sub-disc+fee:0};
}
function capAddons(){const n=id=>cart[id]||0;
  const p=Math.min(n('patty'),n('burger')); if(p)cart.patty=p; else delete cart.patty;
  let room=COMBO_FOR.reduce((s,id)=>s+n(id),0);
  ITEMS.filter(i=>i.combo).forEach(c=>{const q=Math.min(n(c.id),room);room-=q;if(q)cart[c.id]=q;else delete cart[c.id]});}
function setQty(id,q){q=Math.max(0,Math.min(50,q)); if(q)cart[id]=q; else delete cart[id]; capAddons(); orderId=null; save(); refresh(id)}
function refresh(id){
  if(id){document.querySelectorAll(`[data-ctl="${id}"]`).forEach(e=>e.innerHTML=ctrl(BY[id]))}
  const t=calc(), cc=$('#cartCount');
  cc.hidden=!t.count; if(cc.textContent!=ar(t.count)){cc.textContent=ar(t.count);cc.classList.remove('bump');void cc.offsetWidth;cc.classList.add('bump')}
  $('#cartbar').classList.toggle('show',t.count>0 && !$('#drawer').classList.contains('on'));
  $('#cbN').textContent=ar(t.count); $('#cbT').textContent=ar(t.sub-t.disc)+' ج';
  if($('#drawer').classList.contains('on')) renderDrawer();
}
let toastT; function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),1600)}

// overlays
let lastFocus=null;
function openLayer(el){lastFocus=document.activeElement;closeLayers(true);el.classList.add('on');$('#scrim').classList.add('on');document.body.style.overflow='hidden';
  setTimeout(()=>{const f=el.querySelector('button,input,a');f&&f.focus({preventScroll:true})},50);refresh()}
function closeLayers(keep){['#qv','#drawer','#mnav'].forEach(s=>$(s).classList.remove('on'));if(keep!==true){$('#scrim').classList.remove('on');document.body.style.overflow='';lastFocus&&lastFocus.focus&&lastFocus.focus({preventScroll:true});refresh()}}

// quick view
let qvItem=null,qvQty=1;
function openQV(id){const i=BY[id];qvItem=i;qvQty=1;
  $('#qvImg').src=i.src;$('#qvImg').alt=i.name;$('#qvName').textContent=i.name;$('#qvDesc').textContent=i.desc;
  $('#qvPrice').innerHTML=`${ar(i.price)} <small>ج</small>`;
  $('#qvBadges').innerHTML=(i.badge?`<span class="badge">${i.badge}</span>`:'')+(i.offer?`<span class="badge y">داخل عرض ٣ بـ ١٠٠</span>`:'');
  const ex=[...ITEMS.filter(x=>x.addonFor&&x.addonFor.includes(i.id)),...ITEMS.filter(x=>x.side&&!x.hidden&&x.id!==i.id)];
  $('#qvExtrasWrap').hidden=!!i.side;
  $('#qvExtras').innerHTML=ex.map(x=>`<label class="extra"><img src="${x.src}" alt=""><span>${x.name}</span><b class="num">+${ar(x.price)} ج</b><input type="checkbox" id="ex-${x.id}" value="${x.id}"></label>`).join('');
  updQV();openLayer($('#qv'))}
function updQV(){const ex=[...document.querySelectorAll('#qvExtras input:checked')].reduce((s,c)=>s+BY[c.value].price,0);
  $('#qvQty').textContent=ar(qvQty);$('#qvAdd').textContent=`أضف للسلة · ${ar(qvItem.price*qvQty+ex)} ج`}
$('#qvMinus').onclick=()=>{qvQty=Math.max(1,qvQty-1);updQV()};
$('#qvPlus').onclick=()=>{qvQty=Math.min(50,qvQty+1);updQV()};
$('#qvExtras').addEventListener('change',updQV);
$('#qvAdd').onclick=()=>{setQty(qvItem.id,(cart[qvItem.id]||0)+qvQty);
  document.querySelectorAll('#qvExtras input:checked').forEach(c=>setQty(c.value,(cart[c.value]||0)+1));
  closeLayers();toast(`اتضاف ${qvItem.name} للسلة`)};

// cart drawer
const form={mode:'delivery',name:'',phone:'',area:Object.keys(ZONES)[0],address:'',floor:'',notes:''};
function modeHTML(){return `<div class="seg" role="radiogroup" aria-label="طريقة الاستلام">
  <button type="button" role="radio" data-mode="delivery" aria-checked="${form.mode==='delivery'}">توصيل</button>
  <button type="button" role="radio" data-mode="pickup" aria-checked="${form.mode==='pickup'}">استلام من الفرع</button></div>`}
function comboHTML(){const mains=COMBO_FOR.reduce((s,id)=>s+(cart[id]||0),0); if(!mains)return '';
  const combos=ITEMS.filter(i=>i.combo), used=combos.reduce((s,i)=>s+(cart[i.id]||0),0);
  return `<div class="combo"><div><b>خليها كومبو بـ ${ar(COMBO_PRICE)} ج</b><span>بطاطس + مشروب ساقع مع كل برجر أو بانيه · ${ar(used)} من ${ar(mains)}</span></div>
  ${used<mains?`<div class="combo-row"><select id="comboDrink" aria-label="اختار المشروب">${combos.map(c=>`<option value="${c.id}">${c.drinkName}</option>`).join('')}</select><button class="btn btn-red" id="addCombo" type="button">+ ضيف كومبو</button></div>`
    :'<span class="ok">✓ كل البرجر والبانيه بقوا كومبو</span>'}</div>`}
function lineHTML(k,q){const i=BY[k];return `<div class="line"><img src="${i.src}" alt=""><div><b>${i.name}</b><span class="num">${ar(i.price)} ج × ${ar(q)}</span></div>
  <div class="stepper" data-id="${k}"><button data-act="dec" aria-label="أقل">−</button><output class="num">${ar(q)}</output><button data-act="inc" aria-label="أكتر">+</button></div></div>`}
function totalsHTML(t){return `<div class="tot"><span>المجموع</span><span class="num">${ar(t.sub)} ج</span></div>
  ${t.disc?`<div class="tot disc"><span>خصم عرض ٣ بـ ١٠٠ (×${ar(t.groups)})</span><span class="num">−${ar(t.disc)} ج</span></div>`:''}
  ${form.mode==='pickup'?`<div class="tot disc"><span>استلام من الفرع</span><span>بدون توصيل</span></div>`
    :`<div class="tot"><span>التوصيل (${form.area})</span><span class="num">${ar(t.fee)} ج</span></div>`}
  <div class="tot grand"><span>الإجمالي</span><span class="num">${ar(t.total)} ج</span></div>`}
// One id per confirmed order: shown in the WhatsApp message and the sheet so they can be matched.
let orderId=null, loggedId=null;
function newOrderId(){const d=new Date(),p=n=>String(n).padStart(2,'0');
  return `BE-${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${Math.random().toString(36).slice(2,6).toUpperCase().padEnd(4,'0')}`}
function logOrder(t){
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(SHEETS_URL)||!orderId||loggedId===orderId)return;
  loggedId=orderId;
  const pk=form.mode==='pickup';
  const payload={orderId,mode:form.mode,name:form.name.trim(),phone:form.phone.replace(/\D/g,''),
    area:pk?'':form.area,address:pk?'':form.address.trim(),floor:pk?'':form.floor.trim(),notes:form.notes.trim(),
    items:Object.entries(cart).map(([id,qty])=>({id,qty})),clientTotal:t.total};
  // text/plain + no-cors = a "simple" request Apps Script accepts; keepalive lets it finish while WhatsApp opens.
  fetch(SHEETS_URL,{method:'POST',mode:'no-cors',keepalive:true,headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
    .catch(()=>{loggedId=null});
}
function orderText(t){const L=Object.entries(cart).map(([k,q])=>`• ${BY[k].name} × ${q} = ${BY[k].price*q} ج`);
  return ['طلب جديد — بيت عليوه',`رقم الطلب: ${orderId}`,'',...L,'',`المجموع: ${t.sub} ج`,t.disc?`خصم العرض: −${t.disc} ج`:null,form.mode==='pickup'?'استلام من الفرع: بدون مصاريف توصيل':`التوصيل: ${t.fee} ج`,`الإجمالي: ${t.total} ج`,'',
   form.mode==='pickup'?`🏪 استلام من الفرع (${BRANCH})`:'🛵 توصيل',
   `الاسم: ${form.name}`,`الموبايل: ${form.phone}`,
   ...(form.mode==='pickup'?[]:[`المنطقة: ${form.area}`,`العنوان: ${form.address}${form.floor?' — '+form.floor:''}`]),
   form.notes?`ملاحظات: ${form.notes}`:null,'الدفع: كاش عند الاستلام'].filter(x=>x!==null).join('\n')}
function renderDrawer(){
  const t=calc(),B=$('#drawerBody'),F=$('#drawerFoot');
  if(!t.count&&step!=='done'){step='cart';$('#drawerTitle').textContent='سلة الطلب';
    B.innerHTML=`<div class="empty"><div class="logo-mark">ع</div><b>السلة فاضية</b><p>ابدأ بسندوتش كبدة — الأكثر طلباً عندنا.</p></div>`;
    F.innerHTML=`<button class="btn btn-red" data-close data-go="menu">تصفح المنيو</button>`;return}
  if(step==='cart'){$('#drawerTitle').textContent='سلة الطلب';
    const rem=(3-t.offerUnits%3)%3;
    const meter=t.offerUnits===0?`<div class="offer-meter">ضيف ٣ من سندوتشات الـ ٣٥ جنيه وخدهم بـ ١٠٠ جنيه بس<div class="meter"><i style="width:0%"></i></div></div>`
      :rem? `<div class="offer-meter">ضيف ${rem===1?'سندوتش واحد':'سندوتشين'} كمان من الـ ٣٥ جنيه وتاخد العرض<div class="meter"><i style="width:${(t.offerUnits%3)/3*100}%"></i></div></div>`
      :`<div class="offer-meter ok">✓ العرض اتطبق — وفّرت ${ar(t.disc)} جنيه</div>`;
    const ups=[...(cart.burger&&(cart.patty||0)<cart.burger?[BY.patty]:[]),
      ...ITEMS.filter(i=>(i.side||i.offer)&&!i.hidden&&!cart[i.id]).sort((a,b)=>(b.drink||0)-(a.drink||0))].slice(0,8);
    B.innerHTML=meter+Object.entries(cart).map(([k,q])=>lineHTML(k,q)).join('')+comboHTML()+
      (ups.length?`<div class="upsell"><h4>ناس كتير بتضيف</h4><div class="upsell-row">${ups.map(i=>`<button class="up" data-act="inc" data-id="${i.id}"><img src="${i.src}" alt="">${i.name}<br><span class="num">+${ar(i.price)} ج</span></button>`).join('')}</div></div>`:'');
    const ac=$('#addCombo'); if(ac) ac.onclick=()=>{const id=$('#comboDrink').value; setQty(id,(cart[id]||0)+1); toast('اتضاف الكومبو')};
    F.innerHTML=modeHTML()+totalsHTML(t)+`<button class="btn btn-red" id="toCheckout">كمّل الطلب · ${ar(t.total)} ج</button>`;
    $('#toCheckout').onclick=()=>{step='form';renderDrawer()};
  } else if(step==='form'){const pk=form.mode==='pickup';$('#drawerTitle').textContent=pk?'بيانات الاستلام':'بيانات التوصيل';
    B.innerHTML=`<button class="back" id="back">→ رجوع للسلة</button>
     <div style="margin-top:14px">${modeHTML()}</div>
     <form id="coForm" novalidate style="margin-top:14px">
      <div class="field"><label for="f-name">الاسم</label><input id="f-name" name="name" autocomplete="name" value="${esc(form.name)}"><span class="err">اكتب اسمك</span></div>
      <div class="field"><label for="f-phone">رقم الموبايل</label><input id="f-phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="01xxxxxxxxx" value="${esc(form.phone)}" dir="ltr" style="text-align:right"><span class="err">اكتب رقم موبايل مصري من ١١ رقم يبدأ بـ 01</span></div>
      ${pk?`<div class="pay" style="margin-bottom:14px"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg> هتستلم من الفرع: ${BRANCH}</div>`:`
      <div class="field"><label for="f-area">المنطقة</label><select id="f-area" name="area">${Object.entries(ZONES).map(([z,f])=>`<option value="${z}"${form.area===z?' selected':''}>${z} — توصيل ${f} ج</option>`).join('')}</select></div>
      <div class="field"><label for="f-address">العنوان بالتفصيل</label><input id="f-address" name="address" placeholder="مثال: ٢٥ شارع سعد زغلول، عمارة ٤" value="${esc(form.address)}"><span class="err">اكتب العنوان عشان الطيار يوصلك</span></div>
      <div class="field"><label for="f-floor">الدور / الشقة</label><input id="f-floor" name="floor" placeholder="مثال: الدور ٣ شقة ٦" value="${esc(form.floor)}"></div>`}
      <div class="field"><label for="f-notes">ملاحظات على الطلب</label><textarea id="f-notes" name="notes" rows="2" placeholder="مثال: بدون كاتشاب، حراق زيادة">${esc(form.notes)}</textarea></div>
      <div class="pay"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg> الدفع كاش عند الاستلام</div>
     </form>`;
    F.innerHTML=totalsHTML(t)+`<button class="btn btn-red" type="submit" form="coForm">راجع الطلب</button>`;
    $('#back').onclick=()=>{step='cart';renderDrawer()};
    $('#coForm').addEventListener('input',e=>{if(e.target.name){form[e.target.name]=e.target.value;e.target.closest('.field').classList.remove('bad')}
      if(e.target.name==='area'){$('#drawerFoot').querySelector('.tot')&&renderFormFoot()}});
    const renderFormFoot=()=>{const b=F.querySelector('button[form]');F.innerHTML=totalsHTML(calc());F.appendChild(b)};
    $('#coForm').addEventListener('submit',e=>{e.preventDefault();let ok=true;
      const chk=(n,v)=>{const f=$('#f-'+n).closest('.field');f.classList.toggle('bad',!v);if(!v)ok=false};
      chk('name',form.name.trim().length>1);chk('phone',/^01[0125]\d{8}$/.test(form.phone.replace(/\D/g,'')));if(form.mode!=='pickup')chk('address',form.address.trim().length>4);
      if(ok){step='done';renderDrawer()}else{const b=document.querySelector('.field.bad input');b&&b.focus()}});
  } else {$('#drawerTitle').textContent='ابعت الطلب';
    if(!orderId)orderId=newOrderId();
    const txt=orderText(t);
    B.innerHTML=`<button class="back" id="back">→ تعديل البيانات</button>
      <p style="margin:14px 0 10px">آخر خطوة: افتح واتساب واضغط إرسال. الطلب بيتأكد لما توصلنا الرسالة ونرد عليك.</p>
      <div class="msg" id="msg">${esc(txt)}</div>
      <button class="btn btn-ghost" id="copy" style="margin-top:10px;width:100%">انسخ نص الطلب</button>`;
    F.innerHTML=`<div class="tot grand"><span>الإجمالي</span><span class="num">${ar(t.total)} ج</span></div>
      <a class="btn wa" id="waBtn" href="https://wa.me/${PHONE_WA}?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener">افتح واتساب وابعت الطلب</a>
      <span style="font-size:13px;color:var(--muted);text-align:center">أو كلمنا على <span class="num" style="direction:ltr;user-select:all">0103 474 5251</span></span>`;
    $('#back').onclick=()=>{orderId=null;step='form';renderDrawer()};
    $('#waBtn').addEventListener('click',()=>logOrder(t));
    $('#copy').onclick=()=>{navigator.clipboard.writeText(txt).then(()=>toast('اتنسخ نص الطلب')).catch(()=>{const r=document.createRange();r.selectNodeContents($('#msg'));const s=getSelection();s.removeAllRanges();s.addRange(r);toast('النص متحدد — انسخه')})};
  }
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

// events
document.addEventListener('click',e=>{
  const md=e.target.closest('[data-mode]');
  if(md){form.mode=md.dataset.mode;renderDrawer();return}
  const act=e.target.closest('[data-act]');
  if(act){e.stopPropagation();const id=act.dataset.id||act.closest('[data-id]').dataset.id;const q=cart[id]||0;
    if(act.dataset.act==='inc'){setQty(id,q+1);if(!q)toast(cart[id]?`اتضاف ${BY[id].name} للسلة`:'ضيف البرجر الأول')}else setQty(id,q-1);return}
  const f=e.target.closest('[data-filter]');
  if(f){setFilter(f.dataset.filter);if(!f.classList.contains('cat'))$('#menu').scrollIntoView({behavior:'smooth'});return}
  const o=e.target.closest('[data-open]'); if(o){openQV(o.dataset.open);return}
  const c=e.target.closest('[data-close]'); if(c){closeLayers();if(c.dataset.go)$('#'+c.dataset.go).scrollIntoView({behavior:'smooth'});return}
  const a=e.target.closest('.mnav a'); if(a){closeLayers();return}
  const j=e.target.closest('[data-jump]'); if(j){e.preventDefault();$('#menu').scrollIntoView({behavior:'smooth'})}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLayers();
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.p-card,.tile')){e.preventDefault();openQV(e.target.dataset.open)}});
$('#scrim').onclick=()=>closeLayers();
$('#cartBtn').onclick=$('#cartbarBtn').onclick=()=>{if(step==='done'&&calc().count)step='cart';openLayer($('#drawer'))};
$('#burgerBtn').onclick=()=>openLayer($('#mnav'));

// hero parallax
if(!matchMedia('(prefers-reduced-motion: reduce)').matches){const h=$('#heroImg');let tk2=false;
  addEventListener('scroll',()=>{if(tk2)return;tk2=true;requestAnimationFrame(()=>{const y=Math.min(scrollY,700);h.style.transform=`translateY(${y*.12}px) scale(1.04)`;tk2=false})},{passive:true})}

capAddons();save();renderGrid();renderBoard();refresh();
