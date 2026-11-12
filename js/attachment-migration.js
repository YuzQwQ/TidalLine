/* V2 migration runs on raw JSON before normalizers can drop legacy parts or rounds. */
const AttachmentMigration={
 version:2,
 legacy(id){return ATTACHMENT_LEGACY_MAGAZINES[String(id||'').replace(/^g_/, '')];},
 replacement(id,gun){
  const old=this.legacy(id);if(!old)return null;
  const caliber=old.compatibleTags.find(t=>t.startsWith('cal.'))?.slice(4);
  if(gun&&WEAPONS[canonicalWeaponId(gun)]?.caliber!==caliber)return null;
  const kind=id.endsWith('_quick_ext')?'drum':id.endsWith('_quick')?'competition':'extended';
  let family=gun&&ATTACHMENT_WEAPONS[canonicalWeaponId(gun)]?.magazineFamily;
  if(!gun){const matches=Object.entries(ATTACHMENT_MAGAZINE_FAMILIES).filter(([,f])=>f.caliber===caliber);if(matches.length===1)family=matches[0][0];}
  return ATTACHMENT_MAGAZINE_FAMILIES[family]?.parts[kind]||null;
 },
 convert(input){
  const d=JSON.parse(JSON.stringify(input));if(d.attachmentsVersion>=this.version)return d;
  const spill=[],refund=(part,n=1)=>{d.credits=(Number(d.credits)||0)+part.price*n;};
  const fixGun=eq=>{
   if(!eq||!WEAPONS[canonicalWeaponId(eq.gun)])return;
   const oldId=eq.attachments?.magazine,old=this.legacy(oldId);
   if(old){const replacement=this.replacement(old.id,eq.gun);eq.attachments={...eq.attachments};if(replacement)eq.attachments.magazine=replacement;else{delete eq.attachments.magazine;refund(old);}}
   const w=Attachments.resolve(eq.gun,eq.attachments);if(!w)return;
   const count=Math.max(0,Math.floor(Number(eq.mag)||0));
   const fallback=AMMO_BY_ID[eq.ammo]?.caliber===w.caliber?eq.ammo:w.ammo;
   const rounds=(eq.rounds||[]).slice(0,count).map(id=>AMMO_BY_ID[id]?.caliber===w.caliber?id:fallback);
   while(rounds.length<count)rounds.push(fallback);
   for(const id of rounds.slice(w.mag))spill.push({id,n:1});
   eq.mag=Math.min(count,w.mag);eq.rounds=rounds.slice(0,w.mag);eq.ammo=fallback;
  };
  const fixEntry=e=>{
   if(!e||typeof e!=='object')return e;
   const spec=e.gear?.equip||e.item?.equip||e.equip;
   if(spec?.kind==='gun')fixGun(spec);
   const id=spec?.kind==='attachment'?spec.attachment:String(e.id||'').replace(/^g_/,'');
   const old=this.legacy(id);if(!old)return e;
   const n=Math.max(1,Math.floor(Number(e.n)||1)),replacement=this.replacement(old.id);
   if(!replacement){refund(old,n);return null;}
   const item=EQUIP.attachment(replacement);
   return{id:item.id,n,gear:item};
  };
  for(const key of ['stash','bag','safe','chain'])if(Array.isArray(d[key]))d[key]=d[key].flatMap(e=>{const next=fixEntry(e);return !next?[]:next.gear?Array.from({length:Math.max(1,next.n||1)},()=>({...next,n:1})):[next];});
  if(Array.isArray(d.gear?.weapons))d.gear.weapons=d.gear.weapons.map(e=>{if(e?.equip)fixGun(e.equip);return e;});
  // Unclaimed mail is processed before its normalizer; compensation is paid only once.
  for(const letter of d.mail||[])if(!letter.claimed)letter.items=(letter.items||[]).map(fixEntry).filter(Boolean);
  d.attachmentRecovery=(d.attachmentRecovery||[]).map(e=>{
   const old=this.legacy(e?.id);if(!old)return e;
   const replacement=this.replacement(old.id,e.gun);if(replacement){const item=EQUIP.attachment(replacement);spill.push({id:item.id,n:1,gear:item});}else refund(old);
   return null;
  }).filter(Boolean);
  d.stash=[...(d.stash||[]),...spill];
  // Pending commission rewards are not owned items: update their template, never pay early.
  for(const slot of d.commissionBoard?.slots||[])if(slot.definitionId==='elena_evacuation_voices')for(const reward of slot.rewards?.items||[])if(reward.id==='att_mag_556_quick_ext')reward.id='att_mag_556_60';
  d.attachmentsVersion=this.version;
  return d;
 },
 load(raw,key){
  const parsed=JSON.parse(raw);if(parsed.attachmentsVersion>=this.version)return parsed;
  const next=this.convert(parsed);
  try{const backup=key+'_attachments_v1_backup';if(localStorage.getItem(backup)===null)localStorage.setItem(backup,raw);localStorage.setItem(key,JSON.stringify(next));}
  catch(cause){const e=new Error('配件升级存档写入失败，原存档已保留。请清理浏览器存储后重试。');e.attachmentMigrationFailed=true;e.cause=cause;throw e;}
  return next;
 }
};
