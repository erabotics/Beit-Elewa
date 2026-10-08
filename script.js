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
 {id:'mda5n',cat:'mda5n',name:'سجق مدخن',desc:'سجق مدخن بالطعم المصري الجميل في عيش فينو طازة',price:25,img:'bw-mda5n'},
 {id:'panne',cat:'panne',name:'بانيه',desc:'بانيه فراخ مقرمش مع الخس والصوص',price:120,img:'bw-panne'},
 {id:'burger',cat:'burger',name:'كلاسيك برجر',desc:'كلاسيك برجر بالجبنة',price:130,img:'bw-burger',badge:'مميز'},
 {id:'patty',cat:'addon',name:'قطعة برجر زيادة',desc:'قطعة لحمة برجر زيادة جوه الساندوتش',price:90,img:'bw-burger',side:1,hidden:1,addonFor:['burger']},
 {id:'cheese',cat:'addon',name:'جبنة زيادة',desc:'جبنة سايحة زيادة على الساندوتش',price:15,img:'sharqy-cheese-v2',side:1,hidden:1,addonFor:['kebda','khalta','sharqy','sharqyc','mda5n','panne','burger']},
 {id:'sakalans',cat:'sweet',name:'سكلانس',desc:'حلاوة بالقشطة والمربى في عيش فينو',price:35,img:'bw-sakalans'},
 {id:'fries',cat:'sides',name:'بطاطس',desc:'بطاطس مقلية مقرمشة',price:25,img:'bw-fries',side:1},
 {id:'tahina',cat:'sides',name:'طحينة',desc:'طحينة طازة',price:15,img:'bw-tahina',side:1},
 {id:'pickles',cat:'sides',name:'مخلل',desc:'مخلل بلدي',price:10,img:'bw-pickles',side:1},
 {id:'tomato',cat:'sides',name:'طماطم متبلة',desc:'طماطم متبلة بالتوابل والكزبرة',price:15,img:'bw-tomato',side:1},
 // drinks & snacks — prices are placeholders until the restaurant confirms them
 {id:'pepsi',cat:'drinks',name:'بيبسي',desc:'كانز ساقع',price:20,img:'pepsi-wood',side:1,drink:1},
 {id:'7up',cat:'drinks',name:'سفن أب',desc:'كانز ساقع',price:20,img:'7up-wood',side:1,drink:1},
 {id:'vcola',cat:'drinks',name:'في كولا',desc:'كانز ساقع',price:20,img:'vcola-wood',side:1,drink:1},
 {id:'vdiet',cat:'drinks',name:'في كولا دايت',desc:'كانز ساقع — بدون سكر',price:20,img:'vcola-diet-wood',side:1,drink:1},
 {id:'v7lemon',cat:'drinks',name:'في ٧ ليمون نعناع',desc:'كانز ساقع بقطع الليمون',price:20,img:'v7-lemon-wood',side:1,drink:1},
 {id:'juice',cat:'drinks',name:'عصير جهينة برتقال',desc:'علبة ٢٣٥ مل ساقعة',price:15,img:'juice-wood',side:1,drink:1},
 {id:'water',cat:'drinks',name:'مياه',desc:'مياه معدنية اكوا دلتا',price:10,img:'water-wood',side:1,drink:1},
 {id:'chipsy',cat:'drinks',name:'شيبسي',desc:'شطة حارة وليمون',price:15,img:'chipsy-wood',side:1,drink:1},
];
// Combo: fries + a can for each sandwich, picked in the cart.
let COMBO_PRICE=45, COMBO_FOR=['kebda','khalta','sharqy','sharqyc','mda5n','panne','burger','sakalans'];
ITEMS.filter(i=>i.drink&&/كانز/.test(i.desc)).forEach(d=>ITEMS.push({id:'combo_'+d.id,cat:'addon',name:'كومبو: بطاطس + '+d.name,desc:'بطاطس + '+d.name,price:COMBO_PRICE,img:'bw-fries',side:1,hidden:1,combo:1,drinkName:d.name}));
ITEMS.forEach(i=>{i.src='img/'+i.img+'.jpg';i.offer=!i.side&&i.price===OFFER_PRICE});
const BY=Object.fromEntries(ITEMS.map(i=>[i.id,i]));
const CATS=[['all','الكل',null],['offer','العروض','٣'],['kebda','كبدة','kebda'],['sogo2','سجق','sharqy'],['mda5n','مدخن','mda5n'],['panne','بانيه','panne'],['burger','برجر','burger'],['sweet','سكلانس','sakalans'],['sides','بطاطس وإضافات','fries'],['drinks','مشروبات وسناكس','pepsi']];
const $=s=>document.querySelector(s), ar=n=>String(n);
let cart={}; try{cart=JSON.parse(localStorage.getItem('be_cart')||'{}')||{}}catch(e){cart={}}
for(const k in cart){const q=Math.floor(Number(cart[k])); if(!Object.prototype.hasOwnProperty.call(BY,k)||!(q>0)) delete cart[k]; else cart[k]=Math.min(50,q)}
const save=()=>{try{localStorage.setItem('be_cart',JSON.stringify(cart))}catch(e){}};
let filter='all', step='cart';

// ticker
const tk=ITEMS.filter(i=>!i.side).map(i=>`<span>${i.name}</span>`).join('');
$('#ticker').innerHTML=tk+tk+tk+tk;

// categories
$('#catBar').innerHTML=CATS.map(([k,l,im])=>`<button class="cat" data-filter="${k}" aria-pressed="${k==='all'}">${im?(BY[im]?`<img src="${BY[im].src}" alt="">`:`<span class="ph">${im}</span>`):'<span class="ph">✦</span>'}${l}</button>`).join('');

function ctrl(i){const q=cart[i.id]||0; if(i.unavailable&&!q) return '<button class="add" disabled>مش متاح دلوقتي</button>';
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
const addonMax=a=>a.addonFor.reduce((s,id)=>s+(cart[id]||0),0);
function capAddons(){const n=id=>cart[id]||0;
  ITEMS.filter(a=>a.addonFor).forEach(a=>{const q=Math.min(n(a.id),addonMax(a)); if(q)cart[a.id]=q; else delete cart[a.id]});
  let room=COMBO_FOR.reduce((s,id)=>s+n(id),0);
  ITEMS.filter(i=>i.combo).forEach(c=>{const q=Math.min(n(c.id),room);room-=q;if(q)cart[c.id]=q;else delete cart[c.id]});}
function setQty(id,q){q=Math.max(0,Math.min(50,q)); if(BY[id]&&BY[id].unavailable&&q>(cart[id]||0)) return; if(q)cart[id]=q; else delete cart[id]; capAddons(); orderId=null; save(); refresh(id)}
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
  updQV();$('#qvAdd').disabled=!!i.unavailable;if(i.unavailable)$('#qvAdd').textContent='مش متاح دلوقتي';openLayer($('#qv'))}
function updQV(){const ex=[...document.querySelectorAll('#qvExtras input:checked')].reduce((s,c)=>s+BY[c.value].price,0);
  $('#qvQty').textContent=ar(qvQty);$('#qvAdd').textContent=`أضف للسلة · ${ar(qvItem.price*qvQty+ex)} ج`}
$('#qvMinus').onclick=()=>{qvQty=Math.max(1,qvQty-1);updQV()};
$('#qvPlus').onclick=()=>{qvQty=Math.min(50,qvQty+1);updQV()};
$('#qvExtras').addEventListener('change',updQV);
$('#qvAdd').onclick=()=>{setQty(qvItem.id,(cart[qvItem.id]||0)+qvQty);
  document.querySelectorAll('#qvExtras input:checked').forEach(c=>setQty(c.value,(cart[c.value]||0)+1));
  closeLayers();toast(`اتضاف ${qvItem.name} للسلة`)};

// cart drawer
const form={website:'',mode:'delivery',name:'',phone:'',area:Object.keys(ZONES)[0],address:'',floor:'',notes:''};
function modeHTML(){return `<div class="seg" role="radiogroup" aria-label="طريقة الاستلام">
  <button type="button" role="radio" data-mode="delivery" aria-checked="${form.mode==='delivery'}">توصيل</button>
  <button type="button" role="radio" data-mode="pickup" aria-checked="${form.mode==='pickup'}">استلام من الفرع</button></div>`}
function comboHTML(){const mains=COMBO_FOR.reduce((s,id)=>s+(cart[id]||0),0); if(!mains)return '';
  const combos=ITEMS.filter(i=>i.combo), used=combos.reduce((s,i)=>s+(cart[i.id]||0),0);
  return `<div class="combo"><div><b>خليها كومبو بـ ${ar(COMBO_PRICE)} ج</b><span>بطاطس + مشروب ساقع مع كل ساندوتش · ${ar(used)} من ${ar(mains)}</span></div>
  ${used<mains?`<div class="combo-row"><select id="comboDrink" aria-label="اختار المشروب">${combos.map(c=>`<option value="${c.id}">${c.drinkName}</option>`).join('')}</select><button class="btn btn-red" id="addCombo" type="button">+ ضيف كومبو</button></div>`
    :'<span class="ok">✓ كل السندوتشات بقت كومبو</span>'}</div>`}
function lineHTML(k,q){const i=BY[k];return `<div class="line"><img src="${i.src}" alt=""><div><b>${i.name}</b><span class="num">${ar(i.price)} ج × ${ar(q)}</span></div>
  <div class="stepper" data-id="${k}"><button data-act="dec" aria-label="أقل">−</button><output class="num">${ar(q)}</output><button data-act="inc" aria-label="أكتر">+</button></div></div>`}
function totalsHTML(t){return `<div class="tot"><span>المجموع</span><span class="num">${ar(t.sub)} ج</span></div>
  ${t.disc?`<div class="tot disc"><span>خصم عرض ٣ بـ ١٠٠ (×${ar(t.groups)})</span><span class="num">−${ar(t.disc)} ج</span></div>`:''}
  ${form.mode==='pickup'?`<div class="tot disc"><span>استلام من الفرع</span><span>بدون توصيل</span></div>`
    :`<div class="tot"><span>التوصيل (${esc(form.area)})</span><span class="num">${ar(t.fee)} ج</span></div>`}
  <div class="tot grand"><span>الإجمالي</span><span class="num">${ar(t.total)} ج</span></div>`}
// One id per confirmed order: shown in the WhatsApp message and the sheet so they can be matched.
let orderId=null, loggedId=null;
function newOrderId(){const d=new Date(),p=n=>String(n).padStart(2,'0');
  return `BE-${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${Math.random().toString(36).slice(2,6).toUpperCase().padEnd(4,'0')}`}
function logOrder(t){
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(SHEETS_URL)||!orderId||loggedId===orderId||form.website)return;
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
    const ups=[...ITEMS.filter(a=>a.addonFor&&(cart[a.id]||0)<addonMax(a)),
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
      <div class="field"><label for="f-name">الاسم</label><input id="f-name" name="name" autocomplete="name" maxlength="60" value="${esc(form.name)}"><span class="err">اكتب اسمك</span></div>
      <div class="field"><label for="f-phone">رقم الموبايل</label><input id="f-phone" name="phone" inputmode="tel" autocomplete="tel" maxlength="15" placeholder="01xxxxxxxxx" value="${esc(form.phone)}" dir="ltr" style="text-align:right"><span class="err">اكتب رقم موبايل مصري من ١١ رقم يبدأ بـ 01</span></div>
      ${pk?`<div class="pay" style="margin-bottom:14px"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg> هتستلم من الفرع: ${BRANCH}</div>`:`
      <div class="field"><label for="f-area">المنطقة</label><select id="f-area" name="area">${Object.entries(ZONES).map(([z,f])=>`<option value="${z}"${form.area===z?' selected':''}>${z} — توصيل ${f} ج</option>`).join('')}</select></div>
      <div class="field"><label for="f-address">العنوان بالتفصيل</label><input id="f-address" name="address" maxlength="200" placeholder="مثال: ٢٥ شارع سعد زغلول، عمارة ٤" value="${esc(form.address)}"><span class="err">اكتب العنوان عشان الطيار يوصلك</span></div>
      <div class="field"><label for="f-floor">الدور / الشقة</label><input id="f-floor" name="floor" maxlength="60" placeholder="مثال: الدور ٣ شقة ٦" value="${esc(form.floor)}"></div>`}
      <div class="field"><label for="f-notes">ملاحظات على الطلب</label><textarea id="f-notes" name="notes" rows="2" maxlength="300" placeholder="مثال: بدون كاتشاب، حراق زيادة">${esc(form.notes)}</textarea></div>
      <div class="hp" aria-hidden="true"><label for="f-website">Website</label><input id="f-website" name="website" tabindex="-1" autocomplete="off"></div>
      <div class="pay"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg> الدفع كاش عند الاستلام</div>
     </form>`;
    F.innerHTML=totalsHTML(t)+`<button class="btn btn-red" type="submit" form="coForm">راجع الطلب</button>`;
    $('#back').onclick=()=>{step='cart';renderDrawer()};
    $('#coForm').addEventListener('input',e=>{if(e.target.name){form[e.target.name]=e.target.name==='area'&&!Object.prototype.hasOwnProperty.call(ZONES,e.target.value)?Object.keys(ZONES)[0]:e.target.value;e.target.closest('.field').classList.remove('bad')}
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
    if(act.dataset.act==='inc'){setQty(id,q+1);if(!q)toast(cart[id]?`اتضاف ${BY[id].name} للسلة`:'ضيف الساندوتش الأول')}else setQty(id,q-1);return}
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

// ---------------------------------------------------------------- dark mode switch
const MOON='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';
const SUN='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
function isDark(){const t=document.documentElement.getAttribute('data-theme');return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches}
function paintTheme(){const d=isDark(),b=$('#themeBtn');b.innerHTML=d?SUN:MOON;b.setAttribute('aria-pressed',String(d));b.setAttribute('aria-label',d?'الوضع الفاتح':'الوضع الليلي')}
function initTheme(){
  try{const t=localStorage.getItem('be_theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}
  paintTheme();
  $('#themeBtn').onclick=()=>{const next=isDark()?'light':'dark';document.documentElement.setAttribute('data-theme',next);try{localStorage.setItem('be_theme',next)}catch(e){}paintTheme()};
  try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',paintTheme)}catch(e){}
}

// ---------------------------------------------------------------- open now (Cairo time, 11 AM - 3 AM)
function initOpenNow(){const el=$('#openNow');if(!el)return;
  const upd=()=>{let hr;try{hr=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',hour:'numeric',hourCycle:'h23'}).format(new Date()))}catch(e){hr=(new Date().getUTCHours()+3)%24}
    const open=hr>=11||hr<3; el.classList.toggle('closed',!open);
    el.querySelector('span').textContent=open?'مفتوحين دلوقتي · ١١ ص – ٣ ف':'مقفولين دلوقتي · بنفتح ١١ الصبح'};
  upd();setInterval(upd,60000)}

// ---------------------------------------------------------------- prices & availability from the manager's sheet
const SHEETS_OK=/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(SHEETS_URL);
async function syncMenu(){if(!SHEETS_OK)return;
  try{const d=await (await fetch(SHEETS_URL+'?menu=1')).json(); if(!d||d.ok!==true||!Array.isArray(d.items))return;
    d.items.forEach(x=>{if(!x||typeof x.id!=='string')return; const p=Number(x.price), ok=Number.isInteger(p)&&p>0&&p<10000;
      if(x.id==='combo'){if(ok){COMBO_PRICE=p;ITEMS.filter(i=>i.combo).forEach(i=>{i.price=p})}return}
      const i=Object.prototype.hasOwnProperty.call(BY,x.id)?BY[x.id]:null; if(!i||i.combo)return;
      if(ok)i.price=p; i.unavailable=x.available===false; if(typeof x.offer==='boolean'&&!i.side)i.offer=x.offer});
    renderGrid();renderBoard();refresh();
  }catch(e){/* keep the built-in menu */}}

// ---------------------------------------------------------------- AI assistant
const WA_URL='https://wa.me/'+PHONE_WA, IG_URL='https://www.instagram.com/beit.elewa/', FB_URL='https://www.facebook.com/share/1CJu7JSAZc/';
const CHAT_LINK_RE=/https:\/\/(?:wa\.me\/201034745251|www\.instagram\.com\/beit\.elewa\/?|www\.facebook\.com\/share\/1CJu7JSAZc\/?|erabotics\.github\.io\/Beit-Elewa\/?)/g;
const CHIPS={ar:['إيه أنواع اللحمة عندكم؟','إيه أفضل لحمة للشوي؟','إزاي أطلب؟','عندكم توصيل؟','فين السوشيال ميديا بتاعتكم؟'],
             en:['What types of meat do you sell?','Which meat is best for grilling?','How can I order?','Do you offer delivery?','Where can I find your social media?']};
const EN={kebda:'Alexandria-style liver',khalta:'Sausage with peppers',sharqy:'Oriental grilled sausage',sharqyc:'Oriental grilled sausage with cheese',mda5n:'Smoked sausage',panne:'Crispy chicken panne',burger:'Classic cheeseburger',sakalans:'Sakalans (sweet: halawa, cream & jam)',fries:'Fries',tahina:'Tahini',pickles:'Pickles',tomato:'Spiced tomatoes',pepsi:'Pepsi','7up':'7Up',vcola:'V Cola',vdiet:'V Cola Diet',v7lemon:'V7 Lemon Mint',juice:'Juhayna orange juice',chipsy:'Chipsy (chili & lime)',water:'Water',patty:'Extra burger patty',cheese:'Extra cheese'};
const EN_KEYS={kebda:/liver|kebda|kibda|كبد/,khalta:/khalta|خلطه/,sharqy:/sharqy|shar2y|oriental|شرقي/,mda5n:/smoked|mda5en|mdakhan|مدخن/,panne:/panne|pane|chicken|بانيه|فراخ/,burger:/burger|برجر/,sakalans:/sakalans|سكلانس/,fries:/fries|batates|بطاطس/,pepsi:/pepsi|بيبسي/,'7up':/7 ?up|سفن/,vcola:/v ?cola|في كولا/,juice:/juice|juhayna|عصير|جهينه/,chipsy:/chipsy|شيبسي/,water:/water|مياه|ميه/};
let chatLog=[], chatBusy=false, chatLang='ar';
try{const s=JSON.parse(sessionStorage.getItem('be_chat')||'[]');if(Array.isArray(s))chatLog=s.filter(m=>m&&(m.role==='user'||m.role==='assistant')&&typeof m.content==='string').slice(-30)}catch(e){}
function chatId(){try{let id=localStorage.getItem('be_cid');if(!/^[a-z0-9]{12}$/.test(id||'')){const a='abcdefghijklmnopqrstuvwxyz0123456789';id=Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>a[b%36]).join('');localStorage.setItem('be_cid',id)}return id}catch(e){return 'anon00000000'}}
const norm=t=>String(t).toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[\u064B-\u0652]/g,'');
const isAr=t=>/[\u0600-\u06FF]/.test(t)||/[a-z][2375]|[2375][a-z]|\b(3and|3ayz|3ayez|eh|ezay|ezzay|feen|fen|bkam|mesh|msh|ya3ni|7aga|el)\b/i.test(t);
function chatHTML(s){const label=u=>/wa\.me/.test(u)?'WhatsApp':/instagram/.test(u)?'Instagram':/facebook/.test(u)?'Facebook':u;
  return esc(s).replace(CHAT_LINK_RE,u=>`<a href="${u}" target="_blank" rel="noopener nofollow">${label(u)}</a>`).replace(/\n/g,'<br>')}
function renderMsg(m){const d=document.createElement('div');d.className='msg '+(m.role==='user'?'me':'bot');d.dir='auto';d.innerHTML=chatHTML(m.content);$('#chatLog').appendChild(d);$('#chatLog').scrollTop=$('#chatLog').scrollHeight}
function addMsg(role,content){const m={role,content:String(content).slice(0,2000)};chatLog.push(m);chatLog=chatLog.slice(-30);renderMsg(m);try{sessionStorage.setItem('be_chat',JSON.stringify(chatLog))}catch(e){}}
function typing(on){const ex=$('#chatTyping');if(on&&!ex){const d=document.createElement('div');d.id='chatTyping';d.className='msg bot typing';d.setAttribute('aria-label','بيكتب');d.innerHTML='<i></i><i></i><i></i>';$('#chatLog').appendChild(d);$('#chatLog').scrollTop=$('#chatLog').scrollHeight}else if(!on&&ex)ex.remove()}
function renderChips(){const other=chatLang==='ar'?'en':'ar';
  $('#chatChips').innerHTML=CHIPS[chatLang].map(q=>`<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')+`<button type="button" class="lang" data-lang="${other}">${other==='en'?'English':'عربي'}</button>`;
  $('#chatChips').querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>sendChat(b.dataset.q));
  $('#chatChips').querySelector('[data-lang]').onclick=e=>{chatLang=e.target.dataset.lang;renderChips()}}
function contactText(ar){return ar?`تقدر تكلم حد من المطعم مباشرة:\n• واتساب: ${WA_URL}\n• تليفون: 0103 474 5251\n• إنستجرام: ${IG_URL}\n• فيسبوك: ${FB_URL}`
  :`You can reach the Beit Elewa team directly:\n• WhatsApp: ${WA_URL}\n• Phone: 0103 474 5251\n• Instagram: ${IG_URL}\n• Facebook: ${FB_URL}`}

// Answers from the website's own data, used when the AI service is not connected or not reachable.
function localAnswer(text){const t=norm(text), ar=isAr(text), has=re=>re.test(t);
  const nm=i=>ar?i.name:(EN[i.id]||i.name), pr=n=>ar?`${n} ج`:`${n} EGP`;
  const ZONE_EN={"زهراء مدينة نصر":"Zahraa Nasr City","الواحة":"El Waha"};const zones=Object.entries(ZONES).map(([z,f])=>ar?`${z} (${f} ج)`:`${ZONE_EN[z]||z} (${f} EGP)`).join(ar?' و':' and ');
  const offerItems=ITEMS.filter(i=>i.offer).map(nm).join(ar?'، ':', ');
  if(has(/تيك ?توك|يوتيوب|tiktok|youtube/))return ar?`معنديش لينك رسمي لتيك توك أو يوتيوب. حساباتنا الرسمية:\n• إنستجرام: ${IG_URL}\n• فيسبوك: ${FB_URL}`:`I don't have an official TikTok or YouTube link. Our official accounts:\n• Instagram: ${IG_URL}\n• Facebook: ${FB_URL}`;
  if(has(/انستا|انستجرام|انستغرام|فيس|سوشيال|سوشال|صفحه|صفحتكم|instagram|insta|facebook|\bfb\b|social/))return ar?`تقدر تتابعنا هنا:\n• إنستجرام: ${IG_URL}\n• فيسبوك: ${FB_URL}\nولو حابب تكلمنا: ${WA_URL}`:`You can follow Beit Elewa here:\n• Instagram: ${IG_URL}\n• Facebook: ${FB_URL}\nOr message us on WhatsApp: ${WA_URL}`;
  if(has(/تتبع|متابعه|فين طلبي|طلبي فين|track|my order|where is my/))return ar?`الموقع مفيهوش صفحة لمتابعة الطلب. الطلب بيتأكد على واتساب، ولمتابعته كلمنا ومعاك رقم الطلب (بيبدأ بـ BE-): ${WA_URL}`:`The website has no order-tracking page. Orders are confirmed on WhatsApp; to follow up, message us with your order number (starts with BE-): ${WA_URL}`;
  if(has(/مواعيد|بتفتحو|تفتحو|بتقفلو|تقفلو|مفتوحين|امتي|hours|open|close|timing|mawa3id/))return ar?'مفتوحين كل يوم من ١١ الصبح لحد ٣ الفجر.':'We are open every day from 11 AM to 3 AM.';
  if(has(/توصيل|دليفري|ديليفري|بتوصلو|توصلو|delivery|deliver|tawsil/))return ar?`أيوه، بنوصّل لـ ${zones} بس. ولو هتستلم من الفرع (زهراء مدينة نصر — موقف الحي العاشر) مفيش مصاريف توصيل. الدفع كاش عند الاستلام.`:`Yes, we deliver to ${zones} only. Pickup from the branch (Zahraa Nasr City, El Hay El Asher parking) has no delivery fee. Payment is cash on delivery.`;
  if(has(/فين|عنوان|فرع|فروع|مكان|لوكيشن|location|address|branch|where are/))return ar?'عندنا فرع واحد في زهراء مدينة نصر — موقف الحي العاشر.':'We have one branch: Zahraa Nasr City, El Hay El Asher parking.';
  if(has(/دفع|فيزا|كاش|كارت|انستاباي|pay|card|cash|visa/))return ar?'الدفع كاش عند الاستلام. مفيش دفع أونلاين على الموقع.':'Payment is cash on delivery or pickup. There is no online payment on the website.';
  if(has(/عرض|عروض|خصم|offer|deal|discount|promo/))return ar?`عرض الأسبوع: أي ٣ سندوتشات من سندوتشات الـ ٣٥ جنيه (${offerItems}) بـ ١٠٠ جنيه، والخصم بيتحسب لوحده في السلة. البرجر والبانيه مش داخلين في العرض.`:`This week's offer: any 3 of the 35 EGP sandwiches (${offerItems}) for 100 EGP; the discount is applied automatically in the cart. Burger and panne are not included.`;
  if(has(/كومبو|combo|اضافات|اضافه|زياده|extra|add.?on/))return ar?`ممكن تخلي أي ساندوتش كومبو بـ ${COMBO_PRICE} ج (بطاطس + كانز تختاره) من السلة. وفيه جبنة زيادة بـ ${BY.cheese.price} ج لأي ساندوتش، وقطعة برجر زيادة بـ ${BY.patty.price} ج مع البرجر.`:`Any sandwich can be a combo for ${COMBO_PRICE} EGP (fries + a can of your choice), added from the cart. Extra cheese is ${BY.cheese.price} EGP, and an extra burger patty is ${BY.patty.price} EGP with the burger.`;
  if(has(/شوي|مشوي|جريل|grill|bbq|shawy|mashwy/)){const g=ITEMS.filter(i=>!i.hidden&&/مشوي/.test(i.desc));
    return (ar?'الأصناف المشوية عندنا:\n':'Our grilled items:\n')+g.map(i=>`• ${nm(i)} — ${pr(i.price)}`).join('\n')+(ar?'\nإحنا بنبيع سندوتشات جاهزة، مش لحمة نيّة بالكيلو.':'\nWe sell ready-made sandwiches, not raw meat by weight.')}
  const item=ITEMS.find(i=>!i.hidden&&!i.combo&&(t.includes(norm(i.name))||(EN_KEYS[i.id]&&EN_KEYS[i.id].test(t))));
  if(item&&!has(/انواع|منيو|menu|types/))return ar?`${item.name}: ${item.desc} — ${pr(item.price)}.${item.offer?' وداخل عرض ٣ بـ ١٠٠.':''}`:`${nm(item)} — ${pr(item.price)}.${item.offer?' It is part of the 3-for-100 offer.':''}`;
  if(has(/لحم|لحوم|انواع|نوع|منيو|عندكم ايه|بتبيعو|meat|menu|types|what do you|sell|la7m|anwa3/)){const s=ITEMS.filter(i=>!i.side&&!i.hidden);
    return (ar?'عندنا سندوتشات في عيش فينو بأنواع مختلفة:\n':'We serve sandwiches in fino bread:\n')+s.map(i=>`• ${nm(i)} — ${pr(i.price)}`).join('\n')+(ar?'\nإحنا بنبيع سندوتشات جاهزة، مش لحمة نيّة بالكيلو. تحب تعرف أكتر عن حاجة معينة؟':'\nWe sell ready-made sandwiches, not raw meat by weight. Want details on any of them?')}
  if(has(/اطلب|طلب|اوردر|سله|اضيف|order|cart|how (do|can) i|a6lob|atlob/))return ar?'الطلب سهل:\n١) اختار الأصناف واضغط "أضف للسلة".\n٢) افتح السلة واختار توصيل أو استلام من الفرع.\n٣) اضغط "كمّل الطلب" واكتب بياناتك.\n٤) اضغط "افتح واتساب وابعت الطلب" وابعت الرسالة، والطلب بيتأكد لما نرد عليك.':'Ordering is easy:\n1) Pick items and tap "أضف للسلة" (Add to cart).\n2) Open the cart and choose delivery or pickup.\n3) Tap "كمّل الطلب" and enter your details.\n4) Tap "افتح واتساب وابعت الطلب" and send the message; we confirm when we reply.';
  if(has(/واتساب|واتس|رقم|تليفون|موبايل|اكلم|كلم|حد من|خدمه العملاء|شكوي|whatsapp|phone|call|human|agent|support|complain|contact/))return contactText(ar);
  return null}
function noAnswer(code,ar){const pre={RATE_LIMITED:ar?'بعت رسايل كتير في وقت قصير، استنى شوية وجرب تاني.\n':'You sent many messages in a short time; please wait a bit.\n',BUSY:ar?'المساعد عليه ضغط دلوقتي.\n':'The assistant is busy right now.\n'}[code]||'';
  return pre+(ar?`معنديش إجابة أكيدة على ده دلوقتي. للتأكد كلمنا على واتساب ${WA_URL} أو اتصل 0103 474 5251.`:`I don't have that information right now. For the most accurate answer, contact Beit Elewa on WhatsApp ${WA_URL} or call 0103 474 5251.`)}
async function sendChat(raw){const text=String(raw||'').trim().slice(0,500); if(!text||chatBusy)return;
  const ar=isAr(text); chatLang=ar?'ar':'en'; renderChips();
  addMsg('user',text); chatBusy=true; $('#chatSend').disabled=true; typing(true);
  let reply=null, code='';
  if(SHEETS_OK){try{const ctl=new AbortController(), tm=setTimeout(()=>ctl.abort(),35000);
      const r=await fetch(SHEETS_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},signal:ctl.signal,
        body:JSON.stringify({action:'chat',clientId:chatId(),messages:chatLog.slice(-12)})});
      clearTimeout(tm); const d=await r.json();
      if(d&&d.ok===true&&typeof d.reply==='string'&&d.reply.trim())reply=d.reply.trim(); else code=d&&typeof d.error==='string'?d.error:'ERR';
    }catch(e){code='NETWORK'}}
  if(!reply)reply=(code==='RATE_LIMITED'?null:localAnswer(text))||noAnswer(code,ar);
  typing(false); addMsg('assistant',reply); chatBusy=false; $('#chatSend').disabled=false}
function openChat(){$('#chat').hidden=false;$('#chatFab').hidden=true;
  if(!chatLog.length)addMsg('assistant','أهلاً بيك في بيت عليوه! أنا المساعد الآلي. اسألني عن المنيو والأسعار والتوصيل والعروض أو إزاي تطلب.\nHi! Ask me anything about Beit Elewa, in Arabic or English.');
  setTimeout(()=>$('#chatInput').focus(),50)}
function closeChat(){$('#chat').hidden=true;$('#chatFab').hidden=false;$('#chatFab').focus()}
function initChat(){chatLog.forEach(renderMsg);renderChips();
  $('#chatFab').onclick=openChat; $('#chatClose').onclick=closeChat;
  $('#chatHuman').onclick=()=>addMsg('assistant',contactText(chatLang==='ar'));
  const inp=$('#chatInput'), grow=()=>{inp.style.height='auto';inp.style.height=Math.min(inp.scrollHeight,110)+'px'};
  $('#chatForm').addEventListener('submit',e=>{e.preventDefault();const v=inp.value;inp.value='';grow();sendChat(v)});
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#chatForm').requestSubmit()}});
  inp.addEventListener('input',grow);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#chat').hidden)closeChat()})}

capAddons();save();renderGrid();renderBoard();refresh();initTheme();initOpenNow();initChat();syncMenu();
