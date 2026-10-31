/* Admin V3: only available to logged-in admin via RLS. */
(function(){
const el=id=>document.getElementById(id);let known=new Set(),initialized=false,lastRows=[];
const escapeCsv=v=>{const s=String(v??'');return '"'+( /^[=+@\-]/.test(s)?'\''+s:s).replace(/"/g,'""')+'"'};
function csvExport(){
 if(!lastRows.length){alert('Tiada rekod untuk dieksport. Tekan Muat Semula dahulu.');return;}
 const fields=['booking_ref','concept','booking_date','slot_time','customer_name','phone','guests','total_amount','deposit','deposit_verified_at','balance_paid','status','checkin_status','checked_in_at','created_at'];
 const content='\uFEFF'+fields.join(',')+'\r\n'+lastRows.map(r=>fields.map(k=>escapeCsv(r[k])).join(',')).join('\r\n');
 const blob=new Blob([content],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='VC_STUDIO_KULIM_BOOKINGS_'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function verify(b){
 if(!confirm('Duit deposit RM50 untuk '+b.customer_name+' ('+b.booking_ref+') benar-benar sudah MASUK ke akaun Maybank?'))return;
 const r=await db.rpc('admin_verify_deposit',{p_id:b.id});if(r.error)alert('Gagal sahkan. Pastikan SQL V3 sudah dijalankan. '+r.error.message);else{alert('Deposit disahkan dan direkod.');await loadAll()}
}
async function checkin(b,status){
 const r=await db.from('studio_bookings').update({checkin_status:status,checked_in_at:status==='arrived'?new Date().toISOString():null}).eq('id',b.id).eq('status','confirmed');
 if(r.error)alert('Gagal simpan kehadiran: '+r.error.message);else await loadAll();
}
function render(rows){
 lastRows=rows||[];
 const newOnes=lastRows.filter(b=>b.status==='awaiting_payment'||b.status==='pending_review');
 const ids=new Set(newOnes.map(b=>b.id));
 if(initialized){const newCount=newOnes.filter(b=>!known.has(b.id)).length;if(newCount>0)el('v3NewCount').textContent='🔔 '+newCount+' booking baharu sejak semakan sebelum ini! Semak deposit di Maybank.';else el('v3NewCount').textContent='Menunggu deposit / semakan: '+newOnes.length+' booking.'}
 else{initialized=true;el('v3NewCount').textContent='Menunggu deposit / semakan: '+newOnes.length+' booking.'}
 known=ids;
 const wrap=el('v3Tools');wrap.replaceChildren();
 for(const b of lastRows.filter(x=>!['cancelled','expired'].includes(x.status))){
  const box=document.createElement('div');box.style.cssText='border-bottom:1px solid #ddd;padding:10px 0';
  const label=document.createElement('div');label.textContent=b.booking_ref+' | '+b.customer_name+' | '+b.booking_date+' '+String(b.slot_time).slice(0,5)+' | '+b.status+' | '+(b.deposit_verified_at?'Deposit disahkan':'Deposit belum disahkan');box.append(label);
  if(!b.deposit_verified_at&&['awaiting_payment','pending_review','confirmed'].includes(b.status)){const btn=document.createElement('button');btn.textContent='✅ Sahkan Deposit RM50';btn.className='inlineAction';btn.onclick=()=>verify(b);box.append(btn)}
  if(b.status==='confirmed'){const sel=document.createElement('select');for(const [val,name] of [['not_arrived','Belum hadir'],['arrived','Sudah hadir'],['no_show','Tidak hadir']]){const o=document.createElement('option');o.value=val;o.textContent=name;sel.append(o)}sel.value=b.checkin_status||'not_arrived';sel.onchange=()=>checkin(b,sel.value);box.append(sel)}
  wrap.append(box);
 }
 el('v3Status').textContent='Nota: Booking confirmed lama tanpa rekod deposit akan ditanda belum disahkan sehingga admin semak semula.';
}
async function refresh(){
 const session=await db.auth.getUser();if(!session.data?.user)return;
 const admin=await db.rpc('is_studio_admin');if(admin.error||!admin.data)return;
 const expired=await db.rpc('admin_expire_studio_holds');if(expired.error){el('v3Status').textContent='Sila jalankan SQL V3 dahulu: '+expired.error.message;return;}
 const r=await db.from('studio_bookings').select('*').order('created_at',{ascending:false}).limit(1000);
 if(r.error){el('v3Status').textContent=r.error.message;return;}
 render(r.data||[]);
}
el('v3CheckNew').onclick=refresh;el('v3Export').onclick=csvExport;
const oldLoad=loadAll;
loadAll=async function(){await oldLoad();await refresh()};
})();
