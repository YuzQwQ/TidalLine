/* 使用现有物品图标流程整理本轮电子产品，并登记已完成状态。 */
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),file=path.join(root,'assets/electronics-generation.json'),spec=JSON.parse(fs.readFileSync(file,'utf8'));
const promptFile=path.join(root,'assets/item-icon-prompts.json'),prompts=JSON.parse(fs.readFileSync(promptFile,'utf8'));
const folder=path.join(root,'assets/item-art/electronics/sources'),ready=spec.items.filter(a=>fs.existsSync(path.join(folder,a.source)));
for(const a of ready){const record={id:a.id,name:a.name,subject:a.visual,source:a.source,prompt:a.prompt,paletteColours:16,sourceArchive:'assets/item-art/electronics/sources/'+a.source};const at=prompts.items.findIndex(i=>i.id===a.id);if(at>=0)prompts.items[at]={...prompts.items[at],...record};else prompts.items.push(record);}
fs.writeFileSync(promptFile,JSON.stringify(prompts,null,2)+'\n');
for(const a of ready){cp.execFileSync(process.execPath,[path.join(root,'tools/prepare-item-icons.js'),folder,a.id],{cwd:root,stdio:'inherit'});a.status='generated';}
fs.writeFileSync(file,JSON.stringify(spec,null,2)+'\n');
const reviewFile=path.join(root,'design/items/classification.json'),review=JSON.parse(fs.readFileSync(reviewFile,'utf8'));
for(const a of ready){const item=review.items.find(i=>i.id===a.id);if(item)delete item.pendingArt;}
fs.writeFileSync(reviewFile,JSON.stringify(review,null,2)+'\n');
console.log('电子产品已整理 '+ready.length+'/'+spec.items.length+' 件');
