
/* VC STUDIO KULIM: admin tools; all booking data stays in Supabase. */
window.vcAdminExtra={
 rows:[],
 render(rows){
  this.rows=rows||[];
  this.stats();this.search();this.calendar();this.tomorrow();
 },
 search(){
  const q=($('searchCustomer').value||'').trim().toLowerCase(),rows=this.rows;
  const visible=rows.filter(b=>[b.customer_name,b.phone,b.booking_ref].some(v=>String(v||'').toLowerCase().includes(q)));
  document.querySelectorAll('#bookings tr').forEach((tr,i)=>{tr.classList.toggle('searchhide',!visible.includes(rows[i]))});
  $('searchCount').textContent='Memaparkan '+visible.length+' daripada '+rows.length+' rekod (maksimum 1,000)';
 },
 stats(){
  const confirmed=this.rows.filter(b=>b.status==='confirmed');
  const sales=confirmed.reduce((a,b)=>a+Number(b.total_amount||0),0);
  const dep=confirmed.reduce((a,b)=>a+Number(b.deposit||0),0);
  const paid=confirmed.reduce((a,b)=>a+Number(b.balance_paid||0),0);
  const dest=$('salesStats');dest.replaceChildren();
  const vals=[['Booking disahkan',confirmed.length],['Nilai jualan','RM'+sales],['Deposit mengikut rekod','RM'+dep],['Baki direkod dibayar','RM'+paid],['Baki belum direkod bayar','RM'+Math.max(0,sales-dep-paid)]];
  for(const [label,val] of vals){const e=document.createElement('b');e.textContent=label+': '+val;dest.append(e)}
 },
 calendar(){
  const value=$('calendarMonth').value;if(!/^\d{4}-\d{2}$/.test(value))return;
  const [year,month]=value.split('-').map(Number),first=new Date(Date.UTC(year,month-1,1)),days=new Date(Date.UTC(year,month,0)).getUTCDate(),offset=(first.getUTCDay()+6)%7;
  const wrap=$('monthlyCalendar');wrap.replaceChildren();const grid=document.createElement('div');grid.className='calendargrid';
  for(const day of ['Isn','Sel','Rab','Kha','Jum','Sab','Aha']){const h=document.createElement('b');h.textContent=day;h.style.textAlign='center';grid.append(h)}
  for(let i=0;i<offset;i++){const blank=document.createElement('div');blank.className='callday blank';grid.append(blank)}
  for(let d=1;d<=days;d++){
   const date=value+'-'+String(d).padStart(2,'0'),bookings=this.rows.filter(b=>b.booking_date===date&&b.status==='confirmed');
   const a=bookings.filter(b=>b.concept==='A').length,b=bookings.filter(b=>b.concept==='B').length;
   const button=document.createElement('button');button.type='button';button.className='callday'+(a+b?' has':'');
   button.innerHTML='<strong>'+d+'</strong><small>A: '+a+' | B: '+b+'</small>';
   button.onclick=()=>{$('checkDate').value=date;$('checkDateBtn').click();$('checkDate').scrollIntoView({behavior:'smooth',block:'center'})};
   grid.append(button)
  }
  wrap.append(grid)
 },
 tomorrow(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  const date=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)+1)).toISOString().slice(0,10);
  const rows=this.rows.filter(b=>b.booking_date===date&&b.status==='confirmed');
  const wrap=$('tomorrowReminders');wrap.replaceChildren();const info=document.createElement('p');info.textContent='Tarikh esok: '+date+' — '+rows.length+' booking confirmed';wrap.append(info);
  for(const b of rows){const btn=document.createElement('button');btn.type='button';btn.className='inlineAction';btn.textContent='📲 '+b.slot_time.slice(0,5)+' · '+b.concept+' · '+b.customer_name;btn.onclick=()=>reminderWhatsApp(b);wrap.append(btn)}
 },
 confirmationWhatsApp(b){
  if(b.status!=='confirmed'){alert('Booking belum disahkan.');return}
  let phone=String(b.phone||'').replace(/\D/g,'');
  if(phone.startsWith('0'))phone='60'+phone.slice(1);
  else if(!phone.startsWith('60')&&phone.length>=9&&phone.length<=10)phone='60'+phone;
  if(!/^60\d{9,10}$/.test(phone)){alert('Nombor WhatsApp tidak sah.');return}
  const t=String(b.slot_time||'').slice(0,5);
  const msg='Assalamualaikum '+b.customer_name+' 😊\n\nBooking VC STUDIO KULIM telah DISAHKAN.\nRujukan: '+b.booking_ref+'\nTarikh: '+b.booking_date+'\nMasa: '+t+'\nKonsep: '+b.concept+'\nBilangan: '+b.guests+' orang\n\nSila hadir 5–10 minit lebih awal. Lokasi: 973B Jalan Lembah Impiana 7, 09000 Kulim, Kedah.\n\nTerima kasih! 📸';
  window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(msg),'_blank','noopener,noreferrer');
 },
 async markBalance(b){
  if(b.status!=='confirmed'){alert('Sahkan booking dahulu.');return;}
  const max=Number(b.total_amount)-Number(b.deposit),current=Number(b.balance_paid||0);
  const raw=prompt('Masukkan JUMLAH TERKUMPUL baki yang telah diterima setakat ini (RM0 hingga RM'+max+'). Semak transaksi bank dahulu. Jumlah semasa: RM'+current+'.',String(current));
  if(raw===null)return;
  if(!/^\d+$/.test(raw)||Number(raw)>max||Number(raw)<current){alert('Jumlah tidak sah. Masukkan jumlah terkumpul yang sama atau lebih tinggi daripada rekod semasa.');return;}
  const next=Number(raw);
  if(next===current){alert('Tiada perubahan pada rekod bayaran.');return;}
  if(!confirm('Sahkan bahawa tambahan bayaran RM'+(next-current)+' benar-benar telah diterima? Jumlah baki terkumpul selepas simpan: RM'+next+'.'))return;
  const auth=await db.auth.getUser(),userId=auth.data?.user?.id||null;
  const patch={balance_paid:next,balance_paid_at:new Date().toISOString(),balance_paid_by:userId};
  const r=await db.from('studio_bookings').update(patch).eq('id',b.id);
  if(r.error){alert('Rekod baki belum boleh disimpan. Jalankan admin_features_v4.sql di Supabase dahulu.\n'+r.error.message);return;}
  alert('Bayaran baki berjaya direkod. Anda kini boleh jana resit bayaran baki.');loadAll();
 },
 async reschedule(b){
  if(b.status!=='confirmed'){alert('Hanya booking confirmed boleh dipindah.');return}
  const date=prompt('Tarikh baharu YYYY-MM-DD:',b.booking_date);if(date===null)return;
  const time=prompt('Masa baharu HH:MM (contoh 10:30):',b.slot_time.slice(0,5));if(time===null)return;
  const concept=prompt('Konsep A atau B:',b.concept);if(concept===null)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):(00|30)$/.test(time)||!['A','B'].includes(concept.toUpperCase())){alert('Tarikh, masa atau konsep tidak sah');return}
  if(!confirm('Pindahkan '+b.booking_ref+' ke '+date+' '+time+' Konsep '+concept.toUpperCase()+'? Pastikan pelanggan setuju.'))return;
  const r=await db.rpc('admin_reschedule_studio_booking',{p_id:b.id,p_date:date,p_time:time,p_concept:concept.toUpperCase()});
  if(r.error){alert('Tidak berjaya. Jalankan admin_features_v2.sql jika belum.\n'+r.error.message);return}
  alert('Slot berjaya dipindah. Maklumkan pelanggan tentang perubahan.');loadAll()
 },
 receipt(b,type='deposit'){
  if(b.status!=='confirmed'){alert('Booking perlu disahkan dahulu.');return;}
  const paid=Number(b.balance_paid||0),total=Number(b.total_amount||0),deposit=Number(b.deposit||0);
  const isBalance=type==='balance';
  if(!b.deposit_verified_at){alert('Resit deposit hanya boleh dijana selepas admin mengesahkan deposit.');return;}
  if(isBalance&&paid<=0){alert('Belum ada bayaran baki direkodkan.');return;}
  const w=window.open('','_blank');
  if(!w){alert('Benarkan pop-up untuk membuka resit.');return;}
  const escaped=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'RM'+Number(n||0).toFixed(2);
  const dateTime=value=>value?new Intl.DateTimeFormat('ms-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Belum direkodkan';
  const bookingDate=/^\d{4}-\d{2}-\d{2}$/.test(String(b.booking_date||''))?new Intl.DateTimeFormat('ms-MY',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'long',year:'numeric'}).format(new Date(b.booking_date+'T00:00:00+08:00')):b.booking_date;
  const suffix=String(b.booking_ref||'').replace(/[^A-Z0-9-]/gi,'');
  const receiptNo='VC-'+(isBalance?'BAKI-':'DEP-')+suffix.replace(/^VC-/i,'');
  const rows=[
   ['No. resit',receiptNo],
   ['Rujukan booking',b.booking_ref],
   ['Nama pelanggan',b.customer_name],
   ['Tarikh photoshoot',bookingDate],
   ['Masa photoshoot',String(b.slot_time||'').slice(0,5)],
   ['Konsep',b.concept],
   ['Bilangan orang',String(b.guests)+' orang'],
   ['Kaedah pembayaran',b.payment_method==='QR'?'DuitNow QR':(b.payment_method||'Tidak dinyatakan')],
   ['Tarikh bayaran deposit disahkan',dateTime(b.deposit_verified_at)],
   ['Jumlah pakej',money(total)],
   ['Deposit diterima',money(deposit)]
  ];
  if(isBalance){
   rows.push(['Tarikh rekod bayaran baki',dateTime(b.balance_paid_at)]);
   rows.push(['Bayaran baki terkumpul diterima',money(paid)]);
   rows.push(['Jumlah keseluruhan diterima',money(deposit+paid)]);
   rows.push(['Baki belum dijelaskan',money(Math.max(0,total-deposit-paid))]);
  }else{
   rows.push(['Bayaran diterima melalui resit ini',money(deposit)]);
   rows.push(['Baki selepas deposit',money(Math.max(0,total-deposit))]);
  }
  let phone=String(b.phone||'').replace(/\D/g,'');
  if(phone.startsWith('0'))phone='60'+phone.slice(1);
  else if(!phone.startsWith('60')&&phone.length>=9&&phone.length<=10)phone='60'+phone;
  const waValid=/^60\d{9,10}$/.test(phone);
  const amountText=isBalance?money(paid):money(deposit);
  const message='Assalamualaikum '+b.customer_name+' 😊\n\nDilampirkan resit pembayaran VC STUDIO KULIM.\nNo. resit: '+receiptNo+'\nRujukan booking: '+b.booking_ref+'\nJumlah bayaran direkod: '+amountText+'\n\nTerima kasih kerana memilih VC STUDIO KULIM. 📸';
  const waUrl=waValid?'https://wa.me/'+phone+'?text='+encodeURIComponent(message):'';
  const title=isBalance?'Resit Bayaran Baki':'Resit Deposit';
  const html='<!doctype html><html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escaped(title)+' - '+escaped(receiptNo)+'</title><style>'+
   '*{box-sizing:border-box}body{font:15px/1.65 Arial,sans-serif;color:#20382f;max-width:760px;margin:30px auto;padding:28px}header{text-align:center;border-bottom:3px solid #c49a5b;padding-bottom:18px;margin-bottom:20px}h1{font:700 27px Georgia,serif;letter-spacing:1px;color:#194c3c;margin:0}header p{margin:4px 0;color:#92713d;font-size:12px;letter-spacing:2px}h2{font-size:21px;text-align:center;margin:20px 0 5px}.paid{text-align:center;color:#176b45;font-weight:800;letter-spacing:1px;margin-bottom:20px}.meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#59685f;font-size:13px;margin:12px 0}table{width:100%;border-collapse:collapse;margin:16px 0}td{padding:10px 8px;border-bottom:1px solid #e5e5df;vertical-align:top}td:first-child{color:#637168;width:52%}td:last-child{text-align:right;font-weight:700}.total{background:#f3f0e7;padding:14px;border-radius:10px;margin-top:18px}.total strong{font-size:23px;color:#194c3c}.note{font-size:12px;color:#69756e;margin-top:22px;border-top:1px solid #ddd;padding-top:14px}.actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:24px 0}.actions button,.actions a{border:0;border-radius:8px;padding:12px 16px;background:#194c3c;color:white;text-decoration:none;font-weight:700;cursor:pointer}.actions a{background:#176b45}.howto{text-align:center;font-size:12px;color:#66736d}.thanks{text-align:center;margin-top:22px;font-weight:700;color:#194c3c}@media(max-width:520px){body{padding:16px;margin:0}h1{font-size:23px}}@media print{body{margin:0 auto;padding:12mm}.actions,.howto{display:none}header{break-after:avoid}}'+
   '</style></head><body><header><h1>VC STUDIO KULIM</h1><p>RESIT PEMBAYARAN</p></header><h2>'+escaped(title)+'</h2><div class="paid">✓ PEMBAYARAN DISAHKAN</div><div class="meta"><span>No. resit: <strong>'+escaped(receiptNo)+'</strong></span><span>Tarikh resit: '+escaped(dateTime(isBalance?(b.balance_paid_at||new Date().toISOString()):b.deposit_verified_at))+'</span></div><table>'+rows.map(([k,v])=>'<tr><td>'+escaped(k)+'</td><td>'+escaped(v)+'</td></tr>').join('')+'</table><div class="total"><div>Jumlah bayaran direkod dalam resit ini</div><strong>'+escaped(amountText)+'</strong></div><p class="note">Resit ini dikeluarkan oleh VC STUDIO KULIM selepas admin mengesahkan penerimaan bayaran dalam akaun bank. Dokumen ini ialah resit daripada studio dan bukan pengganti slip transaksi atau resit bank.</p><p class="thanks">Terima kasih kerana memilih VC STUDIO KULIM.</p><div class="actions"><button onclick="window.print()">Cetak / Simpan PDF</button>'+(waUrl?'<a href="'+escaped(waUrl)+'" target="_blank" rel="noopener">Buka WhatsApp Pelanggan</a>':'')+'</div><p class="howto">Cara hantar: pilih Cetak / Simpan PDF, simpan fail PDF, kemudian buka WhatsApp dan lampirkan fail PDF secara manual. WhatsApp tidak melampirkan PDF secara automatik.</p></body></html>';
  w.document.open();w.document.write(html);w.document.close();
 }
};
$('searchCustomer').addEventListener('input',()=>vcAdminExtra.search());
$('calendarMonth').addEventListener('change',()=>vcAdminExtra.calendar());
