/* 将内置image_gen返回的原稿复制入项目，并合并实际提示词；不删除生成源。 */
const fs=require('fs'),path=require('path'),folder=path.resolve(__dirname,'../assets/scene-furniture-batch-02'),file=path.join(folder,'manifest.json'),m=JSON.parse(fs.readFileSync(file,'utf8'));
for(const name of fs.readdirSync(folder).filter(f=>/^generation-log.*\.json$/.test(f))){
 for(const g of JSON.parse(fs.readFileSync(path.join(folder,name),'utf8'))){
  const a=m.assets.find(a=>a.id===g.id);if(!a)throw Error('未登记原稿 '+g.id);
  const dest=path.join(folder,a.source);if(fs.existsSync(g.originalSource)){const bytes=fs.readFileSync(g.originalSource);if(!fs.existsSync(dest)||!fs.readFileSync(dest).equals(bytes))fs.writeFileSync(dest,bytes);}else if(!fs.existsSync(dest))throw Error('原稿缺失 '+a.id);
  a.prompt=g.prompt;a.originalSource=g.originalSource;
 }
}
fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n');console.log('已归档 '+m.assets.filter(a=>a.prompt).length+' 张实际提示词与原稿');
