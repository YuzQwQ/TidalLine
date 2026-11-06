/* Preserve user WAV originals; encode stereo release music and register via audio-add. */
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),option=process.argv.find(s=>s.startsWith('--ffmpeg='));
const ffmpeg=option?option.slice(9):process.env.FFMPEG_PATH||'ffmpeg',ffprobe=path.isAbsolute(ffmpeg)?path.join(path.dirname(ffmpeg),'ffprobe.exe'):'ffprobe';
const tracks=[
 {id:'base',title:'退潮之后',english:'After the Ebb',source:'退潮之后 _ After the Ebb.wav'},
 {id:'no_one_answers',title:'无人应答',english:'No One Answers',source:'《无人应答 _ No One Answers》.wav'},
 {id:'beyond_the_grey',title:'越过灰色地带',english:'Beyond the Grey',source:'《越过灰色地带 _ Beyond the Grey》.wav'},
 {id:'business_as_usual',title:'照常营业',english:'Business as Usual',source:'《照常营业 _ Business as Usual》.wav',scene:'shop'}
];
const only=process.argv.find(s=>s.startsWith('--only='))?.slice(7);if(only&&!tracks.some(t=>t.id===only))throw Error('Unknown track '+only);
for(const t of tracks.filter(t=>!only||t.id===only)){
 const original='assets/audio/_source/音乐/'+t.source,target='assets/audio/bgm_'+t.id+'.mp3';if(!fs.existsSync(path.join(root,original)))throw Error('Missing original '+original);
 cp.execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',path.join(root,original),'-map','0:a:0','-vn','-c:a','libmp3lame','-b:a','192k','-ar','44100','-ac','2','-map_metadata','-1','-id3v2_version','3','-metadata','title='+t.title+' / '+t.english,path.join(root,target)],{stdio:'inherit'});
 cp.execFileSync(process.execPath,[path.join(__dirname,'audio-add.js'),path.join(root,target),'--music','--id='+t.id,'--ffprobe='+ffprobe,'--title='+t.title,'--english='+t.english,'--scene='+(t.scene||'lobby'),'--original='+original,'--from=user-lobby-music','--note=用户创作的局外音乐；原稿保留；192kbps、44.1kHz、双声道MP3，保留完整时长'],{stdio:'inherit'});
}
const file=path.join(root,'assets/audio/manifest.json'),manifest=JSON.parse(fs.readFileSync(file));manifest.sources??=[];if(!manifest.sources.some(s=>s.id==='user-lobby-music'))manifest.sources.push({id:'user-lobby-music',name:'用户创作的局外音乐',site:'用户提供',license:'用户原作，供本项目使用',originalDirectory:'assets/audio/_source/音乐'});fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
require('./build-music-data').build();console.log('Prepared full-length stereo music'+(only?': '+only:''));
