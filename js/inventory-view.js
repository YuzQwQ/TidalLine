/* Shared warehouse queries. View state belongs to the calling screen. */
const InventoryView={
 matches(item,category='all'){
  if(category==='all')return true;if(category.startsWith('cat:'))return item.cat===category.slice(4);
  if(category==='weapons')return ['gun','melee'].includes(item.equip?.kind);
  if(category==='protection')return item.equip?.kind==='armor';if(category==='bags')return item.equip?.kind==='bag';
  if(category==='attachments')return item.equip?.kind==='attachment';
  if(category==='collectibles')return itemGroup(item)==='collectible';return item.cat===category;
 },
 list(entries,state){const {category='all',quality='all',query='',sort='value'}=state;
  const value=e=>entryValue(stashItem(e),e)*(e.n||1);
  return entries.filter(e=>{const it=stashItem(e);return it&&this.matches(it,category)&&(quality==='all'||it.r===Number(quality))&&it.name.toLowerCase().includes(query.trim().toLowerCase());}).sort((a,b)=>{const ia=stashItem(a),ib=stashItem(b);if(sort==='priceUp')return value(a)-value(b);if(sort==='rarity')return (ib.r||1)-(ia.r||1)||value(b)-value(a);if(sort==='name')return ia.name.localeCompare(ib.name,'zh-CN');if(sort==='category')return itemCategoryLabel(ia).localeCompare(itemCategoryLabel(ib),'zh-CN')||value(b)-value(a);return value(b)-value(a);});
 }
};
