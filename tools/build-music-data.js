const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
function build(){
 const records=JSON.parse(fs.readFileSync(path.join(root,'assets/audio/manifest.json'))).music||[];if(!records.length)throw Error('音乐登记表为空，请先准备音乐成品');
 const tracks={};for(const t of records){if(tracks[t.id])throw Error('重复曲目ID '+t.id);if(!fs.existsSync(path.join(root,'assets/audio',t.file)))throw Error('缺音乐成品 '+t.file);tracks[t.id]={file:'assets/audio/'+t.file,title:t.title,english:t.english,name:t.title+' / '+t.english,duration:t.dur,scene:t.scene||'lobby',gain:1};}
 const file=path.join(root,'js/music-player.js'),source=fs.readFileSync(file,'utf8'),block='/* BEGIN MUSIC TRACKS */\n  TRACKS: '+JSON.stringify(tracks,null,2).replace(/\n/g,'\n  ')+',\n  /* END MUSIC TRACKS */';
 if(!source.includes('/* BEGIN MUSIC TRACKS */'))throw Error('缺音乐生成边界');fs.writeFileSync(file,source.replace(/\/\* BEGIN MUSIC TRACKS \*\/[\s\S]*?\/\* END MUSIC TRACKS \*\//,block));console.log('已同步局外曲库：'+records.length+'首');return tracks;
}
module.exports={build};if(require.main===module)build();
