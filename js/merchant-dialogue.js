/* Presentation-only merchant lines. Timers exist only while the relevant screen is visible. */
const MerchantSpeech={
 idleDelay:45000,idleRepeat:90000,timer:null,line:null,last:{},
 active(key=MerchantUI.key){return !Safehouse.demo&&Game.state==='base'&&Safehouse.view==='merchant'&&MerchantUI.key===key&&!!MERCHANT_DIALOGUE[key]&&!document.hidden;},
 pick(kind,key=MerchantUI.key){const lines=MERCHANT_DIALOGUE[key]?.[kind]||[],cache=key+':'+kind;if(!lines.length)return null;const choices=lines.filter(x=>x!==this.last[cache]);const text=(choices.length?choices:lines)[Math.floor(Math.random()*(choices.length||lines.length))];this.last[cache]=text;return text;},
 say(kind,key=MerchantUI.key){if(!this.active(key)||kind==='procurement')return;const text=this.pick(kind,key);if(!text)return;
  this.line={kind,text,merchant:key};
  this.paint();
  this.schedule();
 },
 paint(){if(!this.line||!this.active(this.line.merchant))return;const el=MerchantUI.detail?.querySelector('.mb-quote p');if(el){el.textContent='“'+this.line.text+'”';el.setAttribute('role','status');el.setAttribute('aria-live','polite');}},
 stop(){clearTimeout(this.timer);this.timer=null;},
 schedule(delay=this.idleDelay){this.stop();if(!this.active())return;this.timer=setTimeout(()=>{this.timer=null;this.idle();},delay);},
 idle(){if(!this.active())return;const deal=document.querySelector('#dealBox');if((deal&&getComputedStyle(deal).display!=='none')||document.querySelector('dialog[open]')){this.schedule();return;}this.say('idle');this.schedule(this.idleRepeat);},
 sync(){if(!this.active()){this.stop();}else if(this.timer===null)this.schedule();},
 mount(){const root=Safehouse.root;if(!root||root.dataset.speechBound)return;root.dataset.speechBound='true';for(const type of ['pointerdown','keydown','input','wheel'])root.addEventListener(type,()=>this.schedule(),{passive:true});}
};
{
 const mount=Safehouse.mount,apply=Safehouse.applyView,open=MerchantUI.open,identity=MerchantUI.renderIdentity,close=Base.close;
 Safehouse.mount=function(){const r=mount.apply(this,arguments);MerchantSpeech.mount();return r;};
 Safehouse.applyView=function(){const r=apply.apply(this,arguments);MerchantSpeech.sync();return r;};
 MerchantUI.open=function(key){MerchantSpeech.stop();MerchantSpeech.line=null;const r=open.apply(this,arguments);MerchantSpeech.say('greeting',key);return r;};
 MerchantUI.renderIdentity=function(){const r=identity.apply(this,arguments);MerchantSpeech.paint();return r;};
 Base.close=function(){MerchantSpeech.stop();return close.apply(this,arguments);};
 for(const key of ['buyGun','buyAmmo','buyMelee','buyAttachment','buyMedical']){const buy=Base[key];Base[key]=function(){const credits=Save.credits,r=buy.apply(this,arguments);if(r===true&&Save.credits<credits)MerchantSpeech.say('purchase',key==='buyMedical'?'doctor':'gun');return r;};}
 const treat=Base.treat;
 Base.treat=function(){const hp=Save.hp,credits=Save.credits,r=treat.apply(this,arguments);if(r===true&&Save.hp>hp&&Save.credits<credits)MerchantSpeech.say('afterTreatment','doctor');return r;};
 const pay=Clinic.pay;
 Clinic.pay=function(){const hp=Save.hp,credits=Save.credits,r=pay.apply(this,arguments);if(r===true&&Save.hp>hp&&Save.credits<credits){const card=document.getElementById('loadoutHealth');if(card){const line=document.createElement('p');line.className='clinic-result-line';line.setAttribute('role','status');line.textContent=SAFEHOUSE_CONFIG.merchants.doctor.name+'：“'+MERCHANT_DIALOGUE.doctor.afterTreatment[0]+'”';card.appendChild(line);}}return r;};
 document.addEventListener('visibilitychange',()=>{if(document.hidden){MerchantSpeech.stop();}else MerchantSpeech.schedule();});
}
