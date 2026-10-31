(function(){
 const el=id=>document.getElementById(id);
 const wa='60162475836';
 const link=el('changeSlotLink');
 el('lookupBtn').addEventListener('click',async()=>{
  const ref=el('lookupRef').value.trim().toUpperCase(),phone=el('lookupPhone').value.trim(),out=el('lookupResult');
  out.hidden=false;out.textContent='Menyemak tempahan…';link.classList.add('hidden');
  if(!/^VC-[A-Z0-9]{7,14}$/.test(ref)||!/^\+?[0-9][0-9\s-]{7,18}$/.test(phone)){out.textContent='Masukkan rujukan VC-... dan nombor WhatsApp yang sah.';return}
  if(typeof db==='undefined'||!db){out.textContent='Sambungan belum tersedia.';return}
  const r=await db.rpc('lookup_studio_booking',{p_ref:ref,p_phone:phone});
  if(r.error){out.textContent='Semakan belum tersedia. Sila hubungi studio jika memerlukan bantuan.';return}
  if(!r.data?.length){out.textContent='Tempahan aktif tidak dijumpai. Semak nombor rujukan dan WhatsApp, atau hubungi studio.';return}
  const b=r.data[0],time=String(b.slot_time||'').slice(0,5);
  const status={'confirmed':'Disahkan','awaiting_payment':'Menunggu bayaran','pending_review':'Dalam semakan'}[b.status]||'Dalam proses';
  out.replaceChildren();for(const txt of ['Rujukan: '+b.booking_ref,'Konsep: '+b.concept,'Tarikh: '+b.booking_date,'Masa: '+time,'Bilangan: '+b.guests+' orang','Status: '+status]){const p=document.createElement('p');p.textContent=txt;out.append(p)}
  const msg='Assalamualaikum VC STUDIO KULIM. Saya nak mohon tukar tarikh atau masa booking '+b.booking_ref+' ('+b.booking_date+' '+time+', Konsep '+b.concept+'). Boleh semak slot yang kosong?';
  link.href='https://wa.me/'+wa+'?text='+encodeURIComponent(msg);link.classList.remove('hidden');
 });
})();