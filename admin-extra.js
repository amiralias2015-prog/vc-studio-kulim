
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
 async markBalance(b){
  if(b.status!=='confirmed'){alert('Sahkan booking dahulu.');return;}
  const max=Number(b.total_amount)-Number(b.deposit);
  const raw=prompt('Baki telah diterima (jumlah keseluruhan dalam RM, 0 hingga '+max+'). Semak penyata Maybank dahulu:',String(b.balance_paid||0));
  if(raw===null)return;
  if(!/^\d+$/.test(raw)||Number(raw)>max){alert('Jumlah tidak sah.');return;}
  if(!confirm('Pastikan bayaran RM'+raw+' benar-benar diterima. Simpan rekod?'))return;
  const r=await db.from('studio_bookings').update({balance_paid:Number(raw)}).eq('id',b.id);
  if(r.error){alert('Rekod baki belum boleh disimpan. Jalankan admin_features_v2.sql di Supabase dahulu.\n'+r.error.message);return}
  alert('Rekod baki berjaya disimpan.');loadAll()
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
 receipt(b){
  if(b.status!=='confirmed'){alert('Resit pengesahan untuk booking confirmed sahaja.');return}
  const paid=Number(b.balance_paid||0),total=Number(b.total_amount||0),deposit=Number(b.deposit||0);
  const w=window.open('','_blank');
  if(!w){alert('Benarkan pop-up untuk cetak resit.');return}
  const escaped=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const fields=[['Rujukan booking',b.booking_ref],['Nama pelanggan',b.customer_name],['Tarikh',b.booking_date],['Masa',String(b.slot_time).slice(0,5)],['Konsep',b.concept],['Bilangan orang',b.guests],['Jumlah pakej','RM'+total],['Deposit direkod','RM'+deposit],['Baki diterima direkod','RM'+paid],['Baki tertunggak','RM'+(total-deposit-paid)]];
  w.document.write('<!doctype html><html lang="ms"><meta charset="utf-8"><title>VC STUDIO KULIM - '+escaped(b.booking_ref)+'</title><style>body{font:16px/1.7 system-ui;max-width:700px;margin:45px auto;padding:20px}h1{color:#194c3c}table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #ddd;padding:10px}td:first-child{width:45%}@media print{button{display:none}}</style><h1>VC STUDIO KULIM</h1><h2>Pengesahan Booking Photoshoot</h2><table>'+fields.map(([a,v])=>'<tr><td>'+escaped(a)+'</td><td>'+escaped(v)+'</td></tr>').join('')+'</table><p>Booking berstatus confirmed. Ini bukan bukti pindahan bank; rujuk rekod transaksi sebenar.</p><button onclick="window.print()">Cetak / Simpan PDF</button></html>');
  w.document.close()
 }
};
$('searchCustomer').addEventListener('input',()=>vcAdminExtra.search());
$('calendarMonth').addEventListener('change',()=>vcAdminExtra.calendar());
