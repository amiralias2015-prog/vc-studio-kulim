(function(){
const el=id=>document.getElementById(id);
const times=Array.from({length:30},(_,i)=>String(9+Math.floor(i/2)).padStart(2,'0')+':'+(i%2?'30':'00'));
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const fmt=d=>d.split('-').reverse().join('/');
let last=null;
async function getSchedule(){
 const date=el('shooterDate').value;if(!date){el('shooterList').textContent='Pilih tarikh dahulu.';return null}
 const r=await db.from('studio_bookings').select('booking_ref,concept,booking_date,slot_time,customer_name,phone,guests,status').eq('booking_date',date).eq('status','confirmed').order('slot_time',{ascending:true}).limit(1000);
 if(r.error){el('shooterList').textContent='Gagal memuatkan booking: '+r.error.message;return null}
 return {date,rows:r.data||[]};
}
function tableHTML(x,concept){
 const rows=x.rows.filter(b=>b.concept===concept),byTime=new Map(rows.map(b=>[String(b.slot_time).slice(0,5),b]));
 return '<h2>Konsep '+concept+' — '+rows.length+' booking</h2><table><thead><tr><th>Masa</th><th>Nama pelanggan</th><th>Telefon</th><th>Hadir ✓</th></tr></thead><tbody>'+times.map(t=>{const b=byTime.get(t);return '<tr><td>'+t+'</td><td>'+(b?esc(b.customer_name):'—')+'</td><td>'+(b?esc(b.phone):'')+'</td><td>☐</td></tr>'}).join('')+'</tbody></table>'
}
function preview(x){
 const n=x.rows.length;
 el('shooterList').replaceChildren();
 const p=document.createElement('p');p.textContent='Tarikh '+fmt(x.date)+' • Jumlah '+n+' booking confirmed • Konsep A: '+x.rows.filter(b=>b.concept==='A').length+' | B: '+x.rows.filter(b=>b.concept==='B').length;
 el('shooterList').append(p);
 const link=document.createElement('p');link.textContent='Cetakan akan senaraikan semua 30 slot setiap konsep supaya shooter mudah menanda kehadiran.';el('shooterList').append(link);
}
async function prepare(){last=await getSchedule();if(last)preview(last)}
el('shooterPreview').onclick=prepare;
el('shooterPrint').onclick=async()=>{
 const x=await getSchedule();if(!x)return;
 const w=window.open('','_blank');if(!w){alert('Sila benarkan pop-up untuk cetak.');return}
 const html='<!doctype html><html lang="ms"><head><meta charset="utf-8"><title>Jadual Shooter '+esc(x.date)+'</title><style>@page{size:A4 landscape;margin:11mm}body{font:12px system-ui,Arial;color:#172b27}h1{font-size:20px;margin:0}h2{font-size:15px;margin:12px 0 6px}p{margin:5px 0 12px}.wrap{display:grid;grid-template-columns:1fr 1fr;gap:14px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #aaa;padding:3px 5px;text-align:left;height:16px}th{background:#edf2ee}td:last-child,th:last-child{text-align:center}button{margin:10px 0;padding:9px} @media print{button{display:none}} </style></head><body><h1>VC STUDIO KULIM — SENARAI SHOOTER HARIAN</h1><p>Tarikh: '+esc(fmt(x.date))+' | Booking Confirmed: '+x.rows.length+' | Tempoh sesi: 20 minit • Slot setiap 30 minit</p><button onclick="window.print()">Cetak / Simpan PDF</button><div class="wrap">'+tableHTML(x,'A')+tableHTML(x,'B')+'</div><p>Dokumen untuk kegunaan dalaman shooter sahaja. Simpan dengan selamat.</p></body></html>';
 w.document.write(html);w.document.close()
};
el('shooterDate').value='2027-03-11';
})();