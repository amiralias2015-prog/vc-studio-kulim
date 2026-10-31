const C=window.VC_CONFIG||{},$=id=>document.getElementById(id),db=C.supabaseUrl&&C.supabaseAnonKey?window.supabase.createClient(C.supabaseUrl,C.supabaseAnonKey):null;
if(!db)$('authMsg').textContent='Sambungan Supabase belum disediakan. Booking kekal ditutup.';
const safe=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
Array.from({length:30},(_,i)=>String(9+Math.floor(i/2)).padStart(2,'0')+':'+(i%2?'30':'00')).forEach(t=>{let o=document.createElement('option');o.value=t;o.textContent=t;$('blockTime').append(o)});
async function check(){if(!db)return;const {data:{user}}=await db.auth.getUser();if(!user){$('login').classList.remove('hidden');$('dash').classList.add('hidden');return}const r=await db.rpc('is_studio_admin');if(r.error||!r.data){$('authMsg').textContent='Akaun tidak mempunyai akses admin.';return}$('login').classList.add('hidden');$('dash').classList.remove('hidden');loadAll()}
$('signIn').onclick=async()=>{if(!db)return;const r=await db.auth.signInWithPassword({email:$('email').value,password:$('password').value});$('authMsg').textContent=r.error?r.error.message:'';if(!r.error)check()};
$('signOut').onclick=async()=>{if(db)await db.auth.signOut();check()};$('reload').onclick=loadAll;
function reminderWhatsApp(b){
 if(b.status!=='confirmed'){alert('Reminder hanya untuk booking yang telah disahkan.');return;}
 let phone=String(b.phone||'').replace(/\D/g,'');
 if(phone.startsWith('0'))phone='60'+phone.slice(1);
 else if(!phone.startsWith('60')&&phone.length>=9&&phone.length<=10)phone='60'+phone;
 if(!/^60\d{9,10}$/.test(phone)){alert('Nombor WhatsApp pelanggan tidak sah. Semak nombor dalam booking.');return;}
 const t=String(b.slot_time||'').slice(0,5),parts=t.split(':').map(Number);
 const time=(parts[0]%12||12)+':'+String(parts[1]).padStart(2,'0')+' '+(parts[0]>=12?'petang/malam':'pagi');
 const date=String(b.booking_date||''),dateText=/^\d{4}-\d{2}-\d{2}$/.test(date)?date.split('-').reverse().join('/'):date;
 const message='Assalamualaikum '+b.customer_name+' 😊\n\nPeringatan photoshoot Raya di VC STUDIO KULIM.\n\nRujukan: '+b.booking_ref+'\nTarikh: '+dateText+'\nMasa: '+time+'\nKonsep: '+b.concept+'\nTempoh photoshoot: 20 minit\n\nMohon hadir 5–10 minit lebih awal. Jumpa nanti! 📸';
 window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
}
async function loadAll(){if(!db)return;const r=await db.from('studio_bookings').select('*').order('booking_date',{ascending:true}).order('slot_time',{ascending:true}).limit(1000);if(r.error){$('authMsg').textContent=r.error.message;return}
$('bookings').replaceChildren();for(const b of r.data||[]){const row=document.createElement('tr');for(const v of [b.booking_ref,b.concept,b.booking_date,b.slot_time,b.customer_name,b.phone,b.guests,'RM'+b.total_amount,'RM'+b.deposit,b.status]){const td=document.createElement('td');td.textContent=v;row.append(td)}const td=document.createElement('td'),sel=document.createElement('select');for(const status of ['pending_review','confirmed','cancelled','expired']){const o=document.createElement('option');o.value=status;o.textContent=status;o.selected=b.status===status;sel.append(o)}sel.onchange=async()=>{if(!confirm('Sahkan perubahan selepas semak duit sebenar dalam akaun bank?')){sel.value=b.status;return}const x=await db.from('studio_bookings').update({status:sel.value,confirmed_at:sel.value==='confirmed'?new Date().toISOString():null}).eq('id',b.id);if(x.error)alert(x.error.message);loadAll()};td.append(sel);if(b.status==='confirmed'){for(const [label,fn] of [['💰 Baki',()=>vcAdminExtra.markBalance(b)],['📅 Tukar Slot',()=>vcAdminExtra.reschedule(b)],['🧾 Resit',()=>vcAdminExtra.receipt(b)]]){const action=document.createElement('button');action.type='button';action.className='inlineAction';action.textContent=label;action.onclick=fn;td.append(action)}}if(b.status==='confirmed'){const reminder=document.createElement('button');reminder.type='button';reminder.textContent='📲 Hantar Reminder';reminder.style.cssText='margin:7px 0 0;min-width:145px;display:block';reminder.onclick=()=>reminderWhatsApp(b);td.append(reminder)}row.append(td);$('bookings').append(row)}
if(window.vcAdminExtra)window.vcAdminExtra.render(r.data||[]);
const ss=await db.from('studio_settings').select('*').eq('id',1).single();if(ss.data){for(const k of ['booking_start','booking_end','ramadan_start','ramadan_end','raya_first','raya_second'])$(k).value=ss.data[k]||'';$('booking_open').checked=ss.data.booking_open}}
async function checkBookingDate(){
 const date=$('checkDate').value;if(!date){$('dateSummary').textContent='Sila pilih tarikh.';return;}
 $('dateSummary').textContent='Memuatkan data slot…';$('dateSlots').replaceChildren();
 const [book,blocked,settingsResult]=await Promise.all([
 db.from('studio_bookings').select('concept,slot_time,status,expires_at').eq('booking_date',date),
 db.from('blocked_slots').select('concept,slot_time').eq('booking_date',date),
 db.from('studio_settings').select('ramadan_start,ramadan_end').eq('id',1).single()
 ]);
 if(book.error||blocked.error){$('dateSummary').textContent='Tidak dapat semak: '+(book.error||blocked.error).message;return;}
 const all=book.data||[],closed=blocked.data||[],now=Date.now();
 const active=all.filter(b=>b.status==='confirmed'||b.status==='pending_review'||b.status==='awaiting_payment'&&(!b.expires_at||Date.parse(b.expires_at)>now));
 const ss=settingsResult.data||{},ramadan=ss.ramadan_start&&ss.ramadan_end&&date>=ss.ramadan_start&&date<=ss.ramadan_end;
 const totals={A:0,B:0},pending={A:0,B:0};
 active.forEach(b=>{if(b.concept==='A'||b.concept==='B'){if(b.status==='confirmed')totals[b.concept]++;else pending[b.concept]++;}});
 const countClosed=c=>Array.from({length:30},(_,i)=>String(9+Math.floor(i/2)).padStart(2,'0')+':'+(i%2?'30':'00')).filter(t=>(ramadan&&['19:00','19:30','20:00'].includes(t))||closed.some(x=>x.concept===c&&String(x.slot_time).slice(0,5)===t)).length;
 $('dateSummary').replaceChildren();const stats=document.createElement('div');stats.className='statrow';
 for(const c of ['A','B']){const b=document.createElement('b');b.textContent='Konsep '+c+': '+totals[c]+' confirmed · '+pending[c]+' menunggu · '+(30-countClosed(c)-totals[c]-pending[c])+' tersedia';stats.append(b)}
 $('dateSummary').append(stats);
 for(const c of ['A','B']){const heading=document.createElement('h3');heading.textContent='Konsep '+c;$('dateSlots').append(heading);const grid=document.createElement('div');grid.className='slotgrid';
 for(let i=0;i<30;i++){const t=String(9+Math.floor(i/2)).padStart(2,'0')+':'+(i%2?'30':'00'),entry=active.find(b=>b.concept===c&&String(b.slot_time).slice(0,5)===t),isClosed=(ramadan&&['19:00','19:30','20:00'].includes(t))||closed.some(b=>b.concept===c&&String(b.slot_time).slice(0,5)===t);
 const cell=document.createElement('div');cell.className='slotpill '+(entry?entry.status==='confirmed'?'full':'wait':isClosed?'closed':'');
 cell.textContent=t+' — '+(entry?entry.status==='confirmed'?'Booked':'Menunggu deposit':isClosed?'Tutup':'Kosong');grid.append(cell)}
 $('dateSlots').append(grid)}
}
$('checkDate').value=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
$('checkDateBtn').onclick=checkBookingDate;
$('blockBtn').onclick=async()=>{if(!db)return;const r=await db.from('blocked_slots').insert({concept:$('blockConcept').value,booking_date:$('blockDate').value,slot_time:$('blockTime').value+':00'});$('blockMsg').textContent=r.error?r.error.message:'Slot berjaya ditutup'};
$('saveSettings').onclick=async()=>{if(!db)return;const obj={id:1,booking_open:$('booking_open').checked};for(const k of ['booking_start','booking_end','ramadan_start','ramadan_end','raya_first','raya_second'])obj[k]=$(k).value||null;const r=await db.from('studio_settings').upsert(obj);$('settingsMsg').textContent=r.error?r.error.message:'Tetapan disimpan'};check();