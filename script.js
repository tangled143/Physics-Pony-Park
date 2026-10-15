(function(){
'use strict';
var TAU=Math.PI*2, D2R=Math.PI/180, NL=6;
function $(id){return document.getElementById(id);}
function clamp(v,a,b){return Math.min(b,Math.max(a,v));}
function fmt(n,d){ if(d===undefined)d=2; if(!isFinite(n))return '–'; if(Math.abs(n)<0.5*Math.pow(10,-d))n=0; return n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function sgn(n,d){ var s=fmt(n,d); return n>0&&/[1-9]/.test(s)?'+'+s:s; }
function rnd(a,b){return a+Math.random()*(b-a);}
var store={get:function(k){try{return localStorage.getItem(k);}catch(e){return null;}},set:function(k,v){try{localStorage.setItem(k,v);}catch(e){}}};

/* ---------- progress ---------- */
var prog={coaster:[],bumper:[],pops:0};
try{ var pj=JSON.parse(store.get('ppp-prog')||'null'); if(pj){prog.coaster=pj.coaster||[];prog.bumper=pj.bumper||[];prog.pops=pj.pops||0;} }catch(e){}
function saveProg(){ store.set('ppp-prog',JSON.stringify(prog)); }
function lvlStars(g,i){ var r=prog[g][i]; return r?r.s:0; }
function unlocked(g,i){ return i===0||lvlStars(g,i-1)>0; }
function totalStars(){ var t=0,i; for(i=0;i<NL;i++)t+=lvlStars('coaster',i)+lvlStars('bumper',i); return t; }
function starSvg(on,sz){ sz=sz||22; return '<svg class="st'+(on?' on':'')+'" width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6.1 6.7.8-4.9 4.6 1.3 6.6L12 17.5 6 20.7l1.3-6.6L2.4 9.5l6.7-.8z"/></svg>'; }
function starRow(n,sz){ var h='<span class="starrow" role="img" aria-label="'+n+' of 3 stars">',i; for(i=0;i<3;i++)h+=starSvg(i<n,sz); return h+'</span>'; }
function renderTop(){ $('star-total').innerHTML=starSvg(true,16)+'<span>'+totalStars()+'</span>'; }

/* ---------- palette + canvas helpers ---------- */
function pal(){
  var cs=getComputedStyle(document.documentElement); function g(n){return cs.getPropertyValue(n).trim();}
  return {skyA:g('--scene-sky-a'),skyB:g('--scene-sky-b'),ground:g('--scene-ground'),groundLine:g('--scene-ground-line'),grid:g('--scene-grid'),
    ink:g('--scene-ink'),floorA:g('--scene-floor-a'),floorB:g('--scene-floor-b'),rail:g('--scene-rail'),hill:g('--scene-hill'),cloud:g('--scene-cloud'),
    pink:g('--pink'),mint:g('--mint'),sky:g('--sky'),butter:g('--butter'),lilac:g('--lilac'),cream:g('--cream'),accent:g('--accent'),onPastel:g('--on-pastel')};
}
function fit(cv,aspect,minH,maxH){
  var par=cv.parentElement, w=Math.floor(par.clientWidth); if(w<10)return null;
  var h=Math.round(clamp(w*aspect,minH,maxH)), dpr=Math.min(window.devicePixelRatio||1,2);
  if(cv._w!==w||cv._h!==h||cv._d!==dpr){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);cv.style.height=h+'px';cv._w=w;cv._h=h;cv._d=dpr;}
  var ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
  return {ctx:ctx,w:w,h:h};
}
function rr(ctx,x,y,w,h,r){ r=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath(); }
function line(ctx,x1,y1,x2,y2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function star4(ctx,x,y,r){ ctx.beginPath(); for(var i=0;i<8;i++){var a=i*Math.PI/4-Math.PI/2,rad=i%2?r*0.38:r; ctx.lineTo(x+Math.cos(a)*rad,y+Math.sin(a)*rad);} ctx.closePath(); ctx.fill(); }
function ell(ctx,x,y,rx,ry){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();}
function arrow(ctx,x1,y1,x2,y2,color,lw){
  var dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy); if(len<3)return;
  var ux=dx/len,uy=dy/len,hs=Math.min(10,len*0.5);
  ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=lw; ctx.lineCap='round';
  line(ctx,x1,y1,x2-ux*hs*0.6,y2-uy*hs*0.6);
  ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(x2-ux*hs-uy*hs*0.55,y2-uy*hs+ux*hs*0.55); ctx.lineTo(x2-ux*hs+uy*hs*0.55,y2-uy*hs-ux*hs*0.55); ctx.closePath(); ctx.fill();
}
function makeField(host,cfg,onChange){
  var wrap=document.createElement('div'); wrap.className='field';
  wrap.innerHTML='<label for="'+cfg.id+'">'+cfg.label+'</label><div class="field-row"><input id="'+cfg.id+'" type="number" inputmode="decimal" min="'+cfg.min+'" max="'+cfg.max+'" step="'+cfg.step+'" value="'+cfg.value+'"><span class="unit">'+cfg.unit+'</span></div><input id="'+cfg.id+'-r" type="range" min="'+cfg.min+'" max="'+cfg.max+'" step="'+cfg.step+'" value="'+cfg.value+'" aria-label="'+cfg.label.replace(/<[^>]+>/g,'')+' slider">';
  host.appendChild(wrap);
  var n=wrap.querySelector('input[type=number]'), r=wrap.querySelector('input[type=range]'), val=cfg.value;
  function set(v,silent){ v=+v; if(!isFinite(v))return; v=clamp(v,cfg.min,cfg.max); val=v; n.value=String(+v.toFixed(4)); r.value=String(v); if(!silent)onChange(); }
  n.addEventListener('input',function(){ if(n.value===''||!isFinite(+n.value))return; val=clamp(+n.value,cfg.min,cfg.max); r.value=String(val); onChange(); });
  n.addEventListener('change',function(){ set(n.value===''?val:n.value,true); onChange(); });
  r.addEventListener('input',function(){ val=+r.value; n.value=String(val); onChange(); });
  return {get:function(){return val;},set:set,
    range:function(mn,mx,st){ cfg.min=mn;cfg.max=mx; [n,r].forEach(function(x){x.min=mn;x.max=mx;if(st)x.step=st;}); },
    lock:function(b){ n.disabled=b; r.disabled=b; wrap.classList.toggle('locked',b); }};
}

/* ================= AUDIO (synthesised, starts after the first tap) ================= */
var AU={ctx:null,master:null,mus:null,fx:null,nbuf:null,timer:0,next:0,beat:0,musicOn:store.get('ppp-music')!=='0',sfxOn:store.get('ppp-sfx')!=='0'};
var BEAT=0.34;
var MEL=[76,72,67, 72,76,79, 77,74,69, 74,77,81, 79,77,74, 71,74,77, 76,74,72, 72,67,72, 81,76,72, 76,81,84, 81,77,74, 74,77,81, 79,74,71, 74,79,83, 84,79,76, 72,0,0];
var CHORDS=[[48,0],[48,0],[53,0],[53,0],[55,0],[55,0],[48,0],[48,0],[57,1],[57,1],[50,1],[50,1],[55,0],[55,0],[48,0],[48,0]];
function midi(n){return 440*Math.pow(2,(n-69)/12);}
function audioInit(){
  if(AU.ctx){ if(AU.ctx.state==='suspended'&&AU.ctx.resume)AU.ctx.resume(); return; }
  try{
    var C=window.AudioContext||window.webkitAudioContext; if(!C)return;
    var c=new C(); AU.ctx=c;
    AU.master=c.createGain(); AU.master.gain.value=0.9; AU.master.connect(c.destination);
    AU.mus=c.createGain(); AU.mus.gain.value=AU.musicOn?0.16:0; AU.mus.connect(AU.master);
    AU.fx=c.createGain(); AU.fx.gain.value=AU.sfxOn?0.7:0; AU.fx.connect(AU.master);
    AU.nbuf=c.createBuffer(1,c.sampleRate,c.sampleRate); var d=AU.nbuf.getChannelData(0); for(var i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    if(AU.musicOn)musicStart();
  }catch(e){AU.ctx=null;}
}
function toneAt(f,dur,type,vol,when,dest,slide){
  var c=AU.ctx; if(!c)return;
  var o=c.createOscillator(),g=c.createGain(); o.type=type||'sine'; o.frequency.setValueAtTime(f,when);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(slide,1),when+dur);
  g.gain.setValueAtTime(0.0001,when); g.gain.exponentialRampToValueAtTime(vol,when+0.012); g.gain.exponentialRampToValueAtTime(0.0001,when+dur);
  o.connect(g); g.connect(dest||AU.fx); o.start(when); o.stop(when+dur+0.05);
}
function tone(f,dur,type,vol,delay,slide){ if(AU.ctx)toneAt(f,dur,type,vol,AU.ctx.currentTime+(delay||0),AU.fx,slide); }
function noiseAt(dur,vol,when,ftype,f0,f1){
  var c=AU.ctx; if(!c)return;
  var s=c.createBufferSource(); s.buffer=AU.nbuf; s.loop=true;
  var fl=c.createBiquadFilter(); fl.type=ftype; fl.frequency.setValueAtTime(f0,when); if(f1)fl.frequency.exponentialRampToValueAtTime(f1,when+dur);
  var g=c.createGain(); g.gain.setValueAtTime(vol,when); g.gain.exponentialRampToValueAtTime(0.0001,when+dur);
  s.connect(fl); fl.connect(g); g.connect(AU.fx); s.start(when); s.stop(when+dur+0.05);
}
function musicBeat(i,when){
  var m=MEL[i], bar=Math.floor(i/3), pos=i%3, ch=CHORDS[bar];
  if(m){ toneAt(midi(m),BEAT*0.85,'square',0.07,when,AU.mus); toneAt(midi(m+12),BEAT*0.5,'sine',0.05,when,AU.mus); }
  if(pos===0){ toneAt(midi(ch[0]-12),BEAT*0.9,'triangle',0.22,when,AU.mus); }
  else { var third=ch[1]?3:4; [0,third,7].forEach(function(s){ toneAt(midi(ch[0]+12+s),0.11,'square',0.035,when,AU.mus); }); }
}
function musicTick(){
  var c=AU.ctx; if(!c)return;
  if(AU.next<c.currentTime-0.5)AU.next=c.currentTime+0.05;
  while(AU.next<c.currentTime+0.35){ musicBeat(AU.beat%48,AU.next); AU.next+=BEAT; AU.beat++; }
}
function musicStart(){ if(!AU.ctx||AU.timer)return; AU.next=AU.ctx.currentTime+0.1; AU.timer=setInterval(musicTick,100); }
function musicStop(){ if(AU.timer){clearInterval(AU.timer);AU.timer=0;} }
function S(fn){ return function(){ if(!AU.ctx||!AU.sfxOn||AU.ctx.state!=='running')return; try{fn.apply(null,arguments);}catch(e){} }; }
var sfx={
  click:S(function(){ tone(660,0.09,'triangle',0.35,0,990); }),
  back:S(function(){ tone(560,0.1,'triangle',0.3,0,330); }),
  whoosh:S(function(){ var t=AU.ctx.currentTime; noiseAt(0.8,0.5,t,'bandpass',300,2600); tone(160,0.7,'sawtooth',0.1,0,520); }),
  clack:S(function(){ var t=AU.ctx.currentTime; noiseAt(0.05,0.5,t,'bandpass',2200,900); tone(140,0.05,'square',0.12,0,90); }),
  coin:S(function(){ tone(988,0.1,'square',0.18,0); tone(1319,0.22,'square',0.18,0.08); }),
  land:S(function(ok){ var t=AU.ctx.currentTime; noiseAt(0.25,0.4,t,'lowpass',900,200); tone(120,0.25,'sine',0.5,0,40); if(ok){ [523,659,784,1047].forEach(function(f,i){ tone(f,0.25,'triangle',0.3,0.12+i*0.09); }); } }),
  bonk:S(function(){ var t=AU.ctx.currentTime; noiseAt(0.2,0.5,t,'lowpass',1200,200); tone(220,0.3,'square',0.25,0,70); tone(90,0.3,'sine',0.5,0,40); }),
  crash:S(function(){ var t=AU.ctx.currentTime; noiseAt(0.4,0.7,t,'lowpass',2600,250); tone(100,0.35,'sine',0.7,0,38); tone(300,0.15,'sawtooth',0.15,0,80); tone(1175,0.18,'triangle',0.15,0.02,500); }),
  win:S(function(){ [523,659,784,1047,784,1047,1319].forEach(function(f,i){ tone(f,0.28,'square',0.2,i*0.1); tone(f/2,0.28,'triangle',0.25,i*0.1); }); }),
  lose:S(function(){ [392,349,330,262].forEach(function(f,i){ tone(f,0.3,'sawtooth',0.14,i*0.16,f*0.94); }); }),
  pop:S(function(){ var t=AU.ctx.currentTime; noiseAt(0.1,0.7,t,'highpass',1500,4000); tone(500,0.08,'triangle',0.25,0,150); }),
  zap:S(function(){ tone(700,0.18,'sawtooth',0.12,0,120); })
};
function setMusic(b){
  AU.musicOn=b; store.set('ppp-music',b?'1':'0'); $('tog-music').setAttribute('aria-pressed',String(b));
  if(AU.ctx){ AU.mus.gain.setTargetAtTime(b?0.16:0,AU.ctx.currentTime,0.05); if(b)musicStart(); else musicStop(); }
}
function setSfx(b){
  AU.sfxOn=b; store.set('ppp-sfx',b?'1':'0'); $('tog-sfx').setAttribute('aria-pressed',String(b));
  if(AU.ctx)AU.fx.gain.setTargetAtTime(b?0.7:0,AU.ctx.currentTime,0.05);
}
$('tog-music').setAttribute('aria-pressed',String(AU.musicOn));
$('tog-sfx').setAttribute('aria-pressed',String(AU.sfxOn));
$('tog-music').addEventListener('click',function(){ audioInit(); setMusic(!AU.musicOn); });
$('tog-sfx').addEventListener('click',function(){ audioInit(); setSfx(!AU.sfxOn); sfx.click(); });
document.addEventListener('visibilitychange',function(){
  if(!AU.ctx)return;
  if(document.hidden){ if(AU.ctx.suspend)AU.ctx.suspend(); } else if(AU.ctx.resume)AU.ctx.resume();
});
['keydown','click','touchend'].forEach(function(ev){ document.addEventListener(ev,audioInit); });

/* ================= BACKGROUND EFFECTS ================= */
var FX={cv:$('fx'),c:null,w:0,h:0,t:0,last:0,raf:0,balloons:[],parts:[],clouds:[],stars:[],P:null,dark:false,reduced:false};
try{ FX.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
function fxPal(){
  FX.P=pal(); var th=document.documentElement.getAttribute('data-theme');
  try{ FX.dark=th?th==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches; }catch(e){ FX.dark=false; }
}
function fxCols(){ var P=FX.P; return [P.pink,P.butter,P.mint,P.sky,P.lilac]; }
function newBalloon(first){ var w=FX.w,h=FX.h; return {x:rnd(0.04,0.96)*w,y:first?rnd(0.1,1.1)*h:h+rnd(40,260),r:rnd(20,31),vy:rnd(16,38),ph:rnd(0,6.28),sw:rnd(6,18),ci:Math.floor(rnd(0,5))}; }
function fxSeed(){
  var w=FX.w,h=FX.h,i; FX.balloons=[]; FX.clouds=[]; FX.stars=[];
  var nb=clamp(Math.round(w/170),4,9); for(i=0;i<nb;i++)FX.balloons.push(newBalloon(true));
  for(i=0;i<5;i++)FX.clouds.push({x:rnd(0,w),y:rnd(50,h*0.55),s:rnd(0.7,1.5),v:rnd(4,11)});
  for(i=0;i<55;i++)FX.stars.push({x:rnd(0,w),y:rnd(0,h*0.8),r:rnd(0.8,2.1),ph:rnd(0,6.28)});
}
function fxResize(){
  var w=window.innerWidth,h=window.innerHeight,d=Math.min(window.devicePixelRatio||1,2); FX.w=w;FX.h=h;
  FX.cv.width=Math.round(w*d); FX.cv.height=Math.round(h*d); FX.c=FX.cv.getContext('2d'); FX.c.setTransform(d,0,0,d,0,0);
  fxSeed(); fxPal(); if(FX.reduced)fxDraw(0);
}
function fxBurst(x,y,n,spd,life){
  if(FX.reduced)return; var cols=fxCols();
  for(var i=0;i<n;i++){ var a=rnd(0,TAU),s=rnd(0.3,1)*spd; FX.parts.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-spd*0.25,g:520,life:rnd(0.6,1)*life,max:life,col:cols[i%5],sz:rnd(4,8),rot:rnd(0,6),vr:rnd(-8,8),shape:'rect'}); }
}
function fxConfetti(){
  if(FX.reduced)return; var cols=fxCols();
  for(var i=0;i<90;i++)FX.parts.push({x:rnd(0,FX.w),y:rnd(-60,-5),vx:rnd(-60,60),vy:rnd(120,320),g:120,life:rnd(2.4,4.2),max:3,col:cols[i%5],sz:rnd(5,10),rot:rnd(0,6),vr:rnd(-6,6),shape:'rect'});
}
function fxFirework(x,y){
  if(FX.reduced)return; var cols=fxCols(), c=cols[Math.floor(rnd(0,5))];
  for(var i=0;i<34;i++){ var a=i/34*TAU,s=rnd(110,250); FX.parts.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,g:140,life:rnd(0.8,1.4),max:1,col:i%3?c:cols[(i+2)%5],sz:rnd(2.5,4.5),rot:0,vr:0,shape:'spark'}); }
}
function fxFireworks(){ if(FX.reduced)return; for(var k=0;k<3;k++)(function(k){ setTimeout(function(){ fxFirework(rnd(0.2,0.8)*FX.w,rnd(0.12,0.4)*FX.h); },k*260); })(k); }
function fxDraw(dt){
  var c=FX.c,P=FX.P,w=FX.w,h=FX.h,i,t=FX.t; if(!c||!P)return;
  c.clearRect(0,0,w,h);
  /* sparkles / stars */
  for(i=0;i<FX.stars.length;i++){ var s=FX.stars[i],tw=0.5+0.5*Math.sin(t*1.6+s.ph); c.globalAlpha=(FX.dark?0.15+0.5*tw:0.06+0.16*tw); c.fillStyle=FX.dark?'#ffffff':P.lilac; if(s.r>1.7)star4(c,s.x,s.y,s.r*3); else {c.beginPath();c.arc(s.x,s.y,s.r,0,TAU);c.fill();} }
  c.globalAlpha=1;
  /* clouds */
  c.fillStyle=P.cloud;
  for(i=0;i<FX.clouds.length;i++){ var cl=FX.clouds[i]; cl.x+=cl.v*dt; if(cl.x>w+120)cl.x=-140; var k=26*cl.s; c.beginPath(); c.arc(cl.x,cl.y,k,0,TAU); c.arc(cl.x+k*1.1,cl.y+4,k*0.8,0,TAU); c.arc(cl.x-k*1.1,cl.y+5,k*0.7,0,TAU); c.arc(cl.x+k*2,cl.y+8,k*0.55,0,TAU); c.fill(); }
  /* ferris wheel */
  var R=clamp(Math.min(w,h)*0.3,95,250), cx=w-R*0.7, cy=h-R*0.55, spin=t*0.12, cols=fxCols();
  c.globalAlpha=0.2; c.strokeStyle=P.ink; c.lineWidth=3;
  c.beginPath(); c.arc(cx,cy,R,0,TAU); c.stroke(); c.beginPath(); c.arc(cx,cy,R*0.62,0,TAU); c.stroke();
  line(c,cx,cy,cx-R*0.55,h+20); line(c,cx,cy,cx+R*0.55,h+20);
  for(i=0;i<12;i++){ var a=spin+i/12*TAU,ex=cx+Math.cos(a)*R,ey=cy+Math.sin(a)*R; c.lineWidth=2; line(c,cx,cy,ex,ey); c.fillStyle=cols[i%5]; c.globalAlpha=0.5; rr(c,ex-9,ey+3,18,15,5); c.fill(); c.globalAlpha=0.2; c.strokeStyle=P.ink; c.lineWidth=1.5; rr(c,ex-9,ey+3,18,15,5); c.stroke(); }
  c.globalAlpha=1;
  /* balloons */
  for(i=0;i<FX.balloons.length;i++){
    var b=FX.balloons[i]; b.y-=b.vy*dt; if(b.y<-90){ FX.balloons[i]=newBalloon(false); continue; }
    var bx=b.x+Math.sin(t*0.8+b.ph)*b.sw;
    c.strokeStyle=P.ink; c.globalAlpha=0.4; c.lineWidth=1.3; c.beginPath(); c.moveTo(bx,b.y+b.r*1.25); c.quadraticCurveTo(bx+8*Math.sin(t+b.ph),b.y+b.r*1.25+26,bx,b.y+b.r*1.25+56); c.stroke();
    c.globalAlpha=0.75; c.fillStyle=cols[b.ci]; c.beginPath(); c.ellipse(bx,b.y,b.r,b.r*1.22,0,0,TAU); c.fill();
    c.fillStyle='#ffffff'; c.globalAlpha=0.45; c.beginPath(); c.ellipse(bx-b.r*0.35,b.y-b.r*0.45,b.r*0.2,b.r*0.34,0.5,0,TAU); c.fill();
    c.globalAlpha=0.9; c.fillStyle=cols[b.ci]; c.beginPath(); c.moveTo(bx,b.y+b.r*1.2); c.lineTo(bx-5,b.y+b.r*1.45); c.lineTo(bx+5,b.y+b.r*1.45); c.closePath(); c.fill();
  }
  c.globalAlpha=1;
  /* string lights */
  var step=Math.max(80,w/12),n=Math.ceil(w/step),sag=10;
  c.strokeStyle=P.ink; c.globalAlpha=0.5; c.lineWidth=1.4; c.beginPath(); c.moveTo(0,6);
  for(i=0;i<n;i++)c.quadraticCurveTo(i*step+step/2,6+2*sag,(i+1)*step,6);
  c.stroke(); c.globalAlpha=1;
  for(i=0;i<n;i++)for(var q=1;q<=3;q++){ var u=q/4,bx2=i*step+step*u,by2=6+4*sag*u*(1-u),tw2=0.55+0.45*Math.sin(t*2.2+i*1.3+q*2); c.globalAlpha=tw2; c.fillStyle=cols[(i*3+q)%5]; c.beginPath(); c.arc(bx2,by2+4,4.2,0,TAU); c.fill(); }
  c.globalAlpha=1;
  /* particles */
  for(i=FX.parts.length-1;i>=0;i--){
    var p=FX.parts[i]; p.life-=dt; if(p.life<=0||p.y>h+30){FX.parts.splice(i,1);continue;}
    p.vy+=p.g*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt;
    c.globalAlpha=clamp(p.life/(p.shape==='spark'?0.5:0.7),0,1); c.fillStyle=p.col;
    if(p.shape==='spark'){ c.beginPath(); c.arc(p.x,p.y,p.sz,0,TAU); c.fill(); }
    else { c.save(); c.translate(p.x,p.y); c.rotate(p.rot); c.fillRect(-p.sz/2,-p.sz/3,p.sz,p.sz*0.66); c.restore(); }
  }
  c.globalAlpha=1;
}
function fxLoop(now){
  var dt=Math.min((now-FX.last)/1000,0.05); FX.last=now; FX.t+=dt;
  if(!document.hidden)fxDraw(dt);
  FX.raf=requestAnimationFrame(fxLoop);
}
document.addEventListener('pointerdown',function(e){
  var t=e.target; if(!(t===document.body||t===document.documentElement||(t.classList&&t.classList.contains('popzone'))))return;
  for(var i=FX.balloons.length-1;i>=0;i--){
    var b=FX.balloons[i],bx=b.x+Math.sin(FX.t*0.8+b.ph)*b.sw,dx=(e.clientX-bx)/b.r,dy=(e.clientY-b.y)/(b.r*1.22);
    if(dx*dx+dy*dy<=1.5){
      var col=fxCols()[b.ci]; FX.parts.push({x:bx,y:b.y,vx:0,vy:0,g:0,life:0.01,max:0.01,col:col,sz:1,rot:0,vr:0,shape:'rect'});
      fxBurst(bx,b.y,26,260,1.3); FX.balloons[i]=newBalloon(false); sfx.pop(); prog.pops++; saveProg(); $('pop-count').textContent=prog.pops;
      if(FX.reduced)fxDraw(0);
      break;
    }
  }
});

/* ================= ROUTER ================= */
var SCREENS=['menu','coaster-play','coaster-lab','bumper-play','bumper-lab'];
var TITLES={'menu':'Park map','coaster-play':'Rollercoaster · Game','coaster-lab':'Rollercoaster · Physics lab','bumper-play':'Bumper Cars · Game','bumper-lab':'Bumper Cars · Physics lab'};
var cur='menu';
function stopAll(){ cancelAnimationFrame(cs.raf); cs.playing=false; cancelAnimationFrame(bs.raf); bs.playing=false; cancelAnimationFrame(gs.raf); gs.playing=false; gs.raf=0; cancelAnimationFrame(bgs.raf); bgs.playing=false; bgs.raf=0; }
function go(name){
  if(SCREENS.indexOf(name)<0)name='menu';
  if(name!==cur){ stopAll(); cs.t=-cs.tLead; bumperInit(); if(gs.lv){gs.launched=false;gs.t=-0.9;} if(bgs.lv){bgInit();} }
  cur=name;
  SCREENS.forEach(function(s){ $('s-'+s).hidden=s!==name; });
  $('home-btn').hidden=name==='menu'; $('crumb').textContent=TITLES[name];
  try{ if(location.hash!=='#'+name)location.hash=name; }catch(e){}
  window.scrollTo(0,0);
  if(name==='menu')renderMenu();
  if(name==='coaster-play'&&!gs.lv)cgLoad(firstOpen('coaster'));
  if(name==='bumper-play'&&!bgs.lv)bgLoad(firstOpen('bumper'));
    if(name==='coaster-play'){ renderLevels('coaster','cg-levels',gs.i); }
  if(name==='bumper-play'){ renderLevels('bumper','bg-levels',bgs.i); }
  requestAnimationFrame(redrawAll);
}
function firstOpen(g){ for(var i=0;i<NL;i++){ if(lvlStars(g,i)===0)return i; } return 0; }
window.addEventListener('hashchange',function(){ var n=location.hash.replace('#',''); if(n!==cur)go(n||'menu'); });
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-go]'); if(!b)return;
  var to=b.getAttribute('data-go'); if(to==='menu')sfx.back(); else sfx.click(); go(to);
});
function renderMenu(){
  ['coaster','bumper'].forEach(function(g){
    var tot=0,html='',i;
    for(i=0;i<NL;i++){ var s=lvlStars(g,i); tot+=s; html+='<span class="pip'+(unlocked(g,i)?'':' lock')+'" title="Level '+(i+1)+'"><b>'+(i+1)+'</b>'+starRow(s,11)+'</span>'; }
    $('prog-'+g).innerHTML='<div class="pips">'+html+'</div><div class="tot">'+tot+' of '+(NL*3)+' stars</div>';
  });
  $('pop-count').textContent=prog.pops; renderTop();
}
function renderLevels(g,host,curI){
  var h='',i; for(i=0;i<NL;i++){ h+='<button type="button" class="lv" data-lv="'+i+'" title="Level '+(i+1)+'"'+(unlocked(g,i)?'':' disabled')+(i===curI?' aria-current="true"':'')+'><b>'+(i+1)+'</b>'+starRow(lvlStars(g,i),12)+'</button>'; }
  $(host).innerHTML=h;
}

/* ================= SHARED SCENERY ================= */
function drawScenery(ctx,P,w,h,G){
  var gr=ctx.createLinearGradient(0,0,0,h); gr.addColorStop(0,P.skyA); gr.addColorStop(1,P.skyB); ctx.fillStyle=gr; ctx.fillRect(0,0,w,h);
  ctx.fillStyle=P.cloud; [[0.12,0.16,1],[0.46,0.1,1.25],[0.8,0.2,0.9]].forEach(function(c){ var cx=w*c[0],cy=h*c[1],k=c[2]*14; ctx.beginPath(); ctx.arc(cx,cy,k,0,TAU); ctx.arc(cx+k*1.1,cy+3,k*0.8,0,TAU); ctx.arc(cx-k*1.1,cy+4,k*0.7,0,TAU); ctx.fill(); });
  ctx.fillStyle=P.hill; ctx.beginPath(); ctx.moveTo(0,G.gy);
  for(var xh=0;xh<=w;xh+=8){ ctx.lineTo(xh,G.gy-20-14*Math.sin(xh/70)-9*Math.sin(xh/23+1)); }
  ctx.lineTo(w,G.gy); ctx.closePath(); ctx.fill();
  ctx.fillStyle=P.ground; ctx.fillRect(0,G.gy,w,h-G.gy);
  ctx.strokeStyle=P.groundLine; ctx.lineWidth=3; line(ctx,0,G.gy,w,G.gy);
  var steps=[1,2,5,10,20,50,100,200,500,1000], step=1000; for(var i=0;i<steps.length;i++){ if(steps[i]*G.s>=54){step=steps[i];break;} }
  ctx.font='11px "DM Mono",monospace'; ctx.fillStyle=P.ink; ctx.strokeStyle=P.grid; ctx.lineWidth=1; ctx.textAlign='center';
  for(var gx=Math.ceil(G.xmin/step)*step; gx<=G.xmax+0.5*step; gx+=step){ var X=G.sx(gx); if(X>w-10)break; line(ctx,X,G.top,X,G.gy); ctx.fillText(String(gx),X,G.gy+17); }
  ctx.textAlign='left';
  for(var gy2=step; gy2<=G.ymaxView; gy2+=step){ var Y=G.sy(gy2); line(ctx,G.padL-4,Y,w,Y); ctx.fillText(String(gy2),6,Y+4); }
  ctx.textAlign='right'; ctx.fillText('metres',w-8,h-8); ctx.textAlign='left';
  return step;
}
function ponyHead(ctx,P,sz){
  ctx.save(); ctx.lineCap='round';
  var cols=[P.pink,P.butter,P.mint,P.sky,P.lilac];
  for(var i=0;i<5;i++){ ctx.strokeStyle=cols[i]; ctx.lineWidth=2.6; ctx.beginPath(); var y0=-sz*0.55+i*1.8; ctx.moveTo(-sz*0.15,y0); ctx.quadraticCurveTo(-sz*0.7,y0-3+(i%2)*5,-sz*1.25,y0+5+i); ctx.stroke(); }
  ctx.fillStyle=P.cream; ctx.strokeStyle=P.ink; ctx.lineWidth=1.2;
  ell(ctx,0,-sz*0.5,sz*0.42,sz*0.36); ctx.stroke();
  ell(ctx,sz*0.3,-sz*0.4,sz*0.24,sz*0.19); ctx.stroke();
  ctx.fillStyle=P.pink; ctx.beginPath(); ctx.moveTo(-sz*0.15,-sz*0.78); ctx.lineTo(-sz*0.05,-sz*1.12); ctx.lineTo(sz*0.12,-sz*0.8); ctx.closePath(); ctx.fill();
  ctx.fillStyle=P.butter; ctx.beginPath(); ctx.moveTo(sz*0.12,-sz*0.82); ctx.lineTo(sz*0.3,-sz*1.3); ctx.lineTo(sz*0.3,-sz*0.78); ctx.closePath(); ctx.fill();
  ctx.fillStyle=P.ink; ctx.beginPath(); ctx.arc(sz*0.13,-sz*0.55,1.8,0,TAU); ctx.fill();
  ctx.restore();
}
function drawCart(ctx,P,x,y,ang){
  ctx.save(); ctx.translate(x,y); ctx.rotate(-ang);
  ctx.fillStyle=P.pink; ctx.strokeStyle=P.ink; ctx.lineWidth=1.6; rr(ctx,-19,-15,38,13,5); ctx.fill(); ctx.stroke();
  ctx.fillStyle=P.butter; rr(ctx,-19,-9,38,3,1.5); ctx.fill();
  ctx.fillStyle=P.ink; ctx.beginPath(); ctx.arc(-11,-1,4,0,TAU); ctx.arc(11,-1,4,0,TAU); ctx.fill();
  ctx.save(); ctx.translate(3,-12); ponyHead(ctx,P,14); ctx.restore();
  ctx.restore();
}
function ponyFaceTop(ctx,P,sz){
  ctx.save(); ctx.lineCap='round';
  var cols=[P.pink,P.butter,P.mint,P.sky,P.lilac];
  for(var i=0;i<5;i++){ ctx.strokeStyle=cols[i]; ctx.lineWidth=Math.max(2,sz*0.09); var yy=(i-2)*sz*0.1; ctx.beginPath(); ctx.moveTo(-sz*0.25,yy); ctx.quadraticCurveTo(-sz*0.7,yy*1.8+(i%2?3:-3),-sz*1.05,yy*2.2); ctx.stroke(); }
  ctx.fillStyle=P.cream; ctx.strokeStyle=P.ink; ctx.lineWidth=1.2;
  ell(ctx,0,0,sz*0.36,sz*0.3); ctx.stroke(); ell(ctx,sz*0.32,0,sz*0.2,sz*0.15); ctx.stroke();
  ctx.fillStyle=P.pink; ctx.beginPath(); ctx.moveTo(-sz*0.12,-sz*0.22); ctx.lineTo(-sz*0.2,-sz*0.5); ctx.lineTo(sz*0.08,-sz*0.28); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-sz*0.12,sz*0.22); ctx.lineTo(-sz*0.2,sz*0.5); ctx.lineTo(sz*0.08,sz*0.28); ctx.closePath(); ctx.fill();
  ctx.fillStyle=P.butter; ctx.beginPath(); ctx.moveTo(sz*0.12,-sz*0.05); ctx.lineTo(sz*0.62,0); ctx.lineTo(sz*0.12,sz*0.05); ctx.closePath(); ctx.fill();
  ctx.fillStyle=P.ink; ctx.beginPath(); ctx.arc(sz*0.1,-sz*0.14,1.7,0,TAU); ctx.arc(sz*0.1,sz*0.14,1.7,0,TAU); ctx.fill();
  ctx.restore();
}
function drawBumperCar(ctx,P,c,Lpx,Wpx,color,label){
  ctx.save(); ctx.translate(c.px,c.py); ctx.rotate(-(c.ang+c.base));
  ctx.fillStyle=color; ctx.strokeStyle=P.ink; ctx.lineWidth=2; rr(ctx,-Lpx/2,-Wpx/2,Lpx,Wpx,Wpx*0.38); ctx.fill(); ctx.stroke();
  ctx.strokeStyle=P.rail; ctx.lineWidth=3; rr(ctx,-Lpx/2-2,-Wpx/2-2,Lpx+4,Wpx+4,Wpx*0.4); ctx.stroke();
  ctx.fillStyle=P.ink; ctx.globalAlpha=0.85; ctx.beginPath(); ctx.arc(Lpx/2-5,-Wpx*0.28,2.6,0,TAU); ctx.arc(Lpx/2-5,Wpx*0.28,2.6,0,TAU); ctx.fill(); ctx.globalAlpha=1;
  ctx.save(); ctx.translate(-Lpx*0.04,0); ponyFaceTop(ctx,P,Math.min(Wpx*0.85,Lpx*0.55)); ctx.restore();
  ctx.restore();
  ctx.save(); ctx.translate(c.px,c.py); ctx.font='700 11px "Nunito",sans-serif'; ctx.textAlign='center'; ctx.fillStyle=P.ink; ctx.fillText(label,0,Wpx*0.5+16); ctx.restore();
}
function drawArena(ctx,P,w,h,s,ox,oy){
  function sx(x){return ox+x*s;} function sy(y){return oy+(10-y)*s;}
  var gr=ctx.createLinearGradient(0,0,0,h); gr.addColorStop(0,P.skyA); gr.addColorStop(1,P.skyB); ctx.fillStyle=gr; ctx.fillRect(0,0,w,h);
  for(var i=0;i<20;i++)for(var j=0;j<10;j++){ ctx.fillStyle=(i+j)%2?P.floorA:P.floorB; ctx.fillRect(sx(i),sy(j+1),s+0.5,s+0.5); }
  ctx.lineWidth=Math.max(6,s*0.22); ctx.strokeStyle=P.lilac; rr(ctx,ox,oy,20*s,10*s,10); ctx.stroke();
  ctx.lineWidth=2; ctx.strokeStyle=P.butter; ctx.setLineDash([10,10]); rr(ctx,ox+3,oy+3,20*s-6,10*s-6,8); ctx.stroke(); ctx.setLineDash([]);
}

/* ================= COASTER LAB ================= */
var cf={}, cs={p:null,res:null,t:0,tLead:1,playing:false,raf:0,last:0,sinceLand:-1,lastClack:0,released:false};
var cfg=[
  {k:'v0',id:'c-v0',label:'Launch speed v<sub>0</sub>',unit:'m/s',min:0,max:80,step:0.5,value:24},
  {k:'th',id:'c-th',label:'Launch angle θ',unit:'degrees',min:-30,max:80,step:1,value:40},
  {k:'h0',id:'c-h0',label:'Launch height h<sub>0</sub>',unit:'m',min:0,max:60,step:0.5,value:12},
  {k:'g',id:'c-g',label:'Gravity g',unit:'m/s²',min:0.5,max:30,step:0.01,value:9.81}
];
cfg.forEach(function(c){ cf[c.k]=makeField($('coaster-fields'),c,coasterChanged); });
function coasterCompute(){
  var p={v0:cf.v0.get(),th:cf.th.get(),h0:cf.h0.get(),g:cf.g.get()};
  var a=p.th*D2R, vx=p.v0*Math.cos(a), vy0=p.v0*Math.sin(a);
  var disc=vy0*vy0+2*p.g*p.h0, T=(vy0+Math.sqrt(disc))/p.g;
  var tApex=vy0>0?vy0/p.g:0, H=p.h0+(vy0>0?vy0*vy0/(2*p.g):0);
  var R=vx*T, vyE=vy0-p.g*T, vE=Math.hypot(vx,vyE), angE=Math.atan2(-vyE,vx)/D2R;
  var sth=Math.sin(a), cth=Math.cos(a), Lr;
  if(sth>0.001)Lr=Math.min(10,p.h0/sth); else Lr=10;
  if(p.h0<=0.05&&sth>0)Lr=0;
  Lr=Math.max(Lr,0);
  cs.p=p; cs.res={vx:vx,vy0:vy0,disc:disc,T:T,tApex:tApex,H:H,R:R,vyE:vyE,vE:vE,angE:angE,Lr:Lr,x0:-Lr*cth,y0:p.h0-Lr*sth,xApex:vx*tApex};
  cs.tLead=Lr>0.3?clamp(Lr/Math.max(p.v0,1),0.5,1.4):0.001;
}
function coasterReport(){
  var r=cs.res,p=cs.p;
  var rows=[['Time in the air',fmt(r.T),'s'],['Range (distance flown)',fmt(r.R),'m'],['Highest point',fmt(r.H),'m'],['Time to the top',fmt(r.tApex),'s'],
    ['Speed sideways vₓ',fmt(r.vx),'m/s'],['Landing speed',fmt(r.vE),'m/s'],['Landing angle below flat',fmt(r.angE,1),'°'],['Landing speed downward',fmt(Math.abs(r.vyE)),'m/s']];
  $('coaster-report').innerHTML=rows.map(function(x){return '<div class="row"><dt>'+x[0]+'</dt><dd>'+x[1]+' <i>'+x[2]+'</i></dd></div>';}).join('');
  $('coaster-note').textContent=r.T<=0?'The car never leaves the ground with these numbers. Raise the launch angle, speed or height.':(p.th<0?'The car launches downward, so the highest point is the launch height.':'The same equations work at every moment of the flight: x = vₓt and y = h₀ + v₀ᵧt − ½gt².');
  var th=fmt(p.th,0);
  var w=[
    ['Split the launch speed','<div class="eq">vₓ = v₀ cos θ = '+fmt(p.v0)+' × cos '+th+'° = <b>'+fmt(r.vx)+' m/s</b><br>v₀ᵧ = v₀ sin θ = '+fmt(p.v0)+' × sin '+th+'° = <b>'+fmt(r.vy0)+' m/s</b></div>'],
    ['Time in the air','<div class="eq">0 = h₀ + v₀ᵧt − ½gt²<br>t = (v₀ᵧ + √(v₀ᵧ² + 2gh₀)) ÷ g<br>t = ('+fmt(r.vy0)+' + √('+fmt(r.vy0*r.vy0)+' + '+fmt(2*p.g*p.h0)+')) ÷ '+fmt(p.g)+' = <b>'+fmt(r.T)+' s</b></div>'],
    ['Range','<div class="eq">R = vₓ × t<br>R = '+fmt(r.vx)+' × '+fmt(r.T)+' = <b>'+fmt(r.R)+' m</b></div>'],
    ['Highest point',r.vy0>0?'<div class="eq">t<sub>top</sub> = v₀ᵧ ÷ g = '+fmt(r.vy0)+' ÷ '+fmt(p.g)+' = <b>'+fmt(r.tApex)+' s</b><br>H = h₀ + v₀ᵧ² ÷ (2g)<br>H = '+fmt(p.h0)+' + '+fmt(r.vy0*r.vy0)+' ÷ '+fmt(2*p.g)+' = <b>'+fmt(r.H)+' m</b></div>':'<div class="eq">v₀ᵧ is zero or negative, so the car never climbs.<br>H = h₀ = <b>'+fmt(p.h0)+' m</b></div>'],
    ['Landing velocity','<div class="eq">vᵧ = v₀ᵧ − g t = '+fmt(r.vy0)+' − '+fmt(p.g)+' × '+fmt(r.T)+' = <b>'+fmt(r.vyE)+' m/s</b><br>v = √(vₓ² + vᵧ²) = <b>'+fmt(r.vE)+' m/s</b><br>angle = tan⁻¹(|vᵧ| ÷ vₓ) = <b>'+fmt(r.angE,1)+'°</b></div>']
  ];
  $('coaster-work').innerHTML=w.map(function(s){return '<li><h4>'+s[0]+'</h4>'+s[1]+'</li>';}).join('');
}
function coasterGeom(w,h){
  var r=cs.res,p=cs.p, padL=46,padR=22,padT=26,padB=40;
  var xmin=Math.min(0,r.x0), xmax=Math.max(r.R,0), ymax=Math.max(r.H,r.y0,p.h0);
  var Wx=Math.max((xmax-xmin)*1.06,10), Wy=Math.max(ymax,5);
  var s=Math.min((w-padL-padR)/Wx,(h-padT-padB)/(Wy*1.12));
  var ox=padL+((w-padL-padR)-Wx*s)/2-xmin*s, gy=h-padB;
  return {s:s,gy:gy,top:padT,padL:padL,xmin:xmin,xmax:xmax,ymaxView:(gy-padT)/s,sx:function(x){return ox+x*s;},sy:function(y){return gy-y*s;}};
}
function cartAt(t){
  var r=cs.res,p=cs.p;
  if(t<0){ var f=clamp((t+cs.tLead)/cs.tLead,0,1); return {x:r.x0*(1-f),y:r.y0+(p.h0-r.y0)*f,ang:p.th*D2R}; }
  var tt=Math.min(t,r.T), vy=r.vy0-p.g*tt;
  return {x:r.vx*tt,y:Math.max(p.h0+r.vy0*tt-0.5*p.g*tt*tt,0),ang:Math.atan2(vy,r.vx)};
}
function drawCoaster(){
  var cv=$('coaster-canvas'); if(!cv||$('s-coaster-lab').hidden)return;
  var b=fit(cv,0.54,300,470); if(!b)return;
  var ctx=b.ctx,w=b.w,h=b.h,P=pal(),r=cs.res,p=cs.p,G=coasterGeom(w,h),sx=G.sx,sy=G.sy,s=G.s,t=cs.t;
  var step=drawScenery(ctx,P,w,h,G);
  var Ax=sx(r.x0),Ay=sy(r.y0),Bx=sx(0),By=sy(p.h0);
  ctx.lineCap='round'; ctx.strokeStyle=P.ink; ctx.globalAlpha=0.5; ctx.lineWidth=2;
  var np=Math.max(2,Math.round(r.Lr/2.5));
  for(var k=0;k<=np;k++){ var f=k/np,px=Ax+(Bx-Ax)*f,py=Ay+(By-Ay)*f; if(G.gy-py>3)line(ctx,px,py,px,G.gy); }
  if(G.gy-By>3){ ctx.lineWidth=4; line(ctx,Bx,By,Bx,G.gy); }
  ctx.globalAlpha=1;
  if(r.Lr>0.3){ ctx.strokeStyle=P.ink; ctx.lineWidth=7; line(ctx,Ax,Ay,Bx,By); ctx.strokeStyle=P.rail; ctx.lineWidth=3; line(ctx,Ax,Ay,Bx,By); }
  ctx.fillStyle=P.butter; ctx.strokeStyle=P.ink; ctx.lineWidth=1.5; rr(ctx,Bx-9,By-3,18,6,3); ctx.fill(); ctx.stroke();
  var lx0=sx(Math.max(r.R-2.5/Math.max(s/6,1),0)), lx1=sx(r.R)+34;
  ctx.fillStyle=P.ink; ctx.globalAlpha=0.5; for(var sl=lx0; sl<lx1; sl+=10){ ctx.fillRect(sl,G.gy-3,5,6); } ctx.globalAlpha=1;
  ctx.strokeStyle=P.ink; ctx.lineWidth=5; line(ctx,lx0,G.gy-3,lx1,G.gy-3); ctx.strokeStyle=P.rail; ctx.lineWidth=2; line(ctx,lx0,G.gy-3,lx1,G.gy-3);
  var fx=sx(r.R); ctx.strokeStyle=P.ink; ctx.lineWidth=2; line(ctx,fx,G.gy,fx,G.gy-34);
  ctx.fillStyle=P.pink; ctx.beginPath(); ctx.moveTo(fx,G.gy-34); ctx.lineTo(fx+17,G.gy-28); ctx.lineTo(fx,G.gy-22); ctx.closePath(); ctx.fill();
  ctx.fillStyle=P.ink; ctx.font='600 12px "DM Mono",monospace'; ctx.textAlign=(fx>w-90)?'right':'left'; ctx.fillText('R = '+fmt(r.R,1)+' m',(fx>w-90)?fx-6:fx+22,G.gy-40); ctx.textAlign='left';
  if(r.T>0&&r.vy0>0){
    var pxA=sx(r.xApex),pyA=sy(r.H);
    ctx.setLineDash([3,4]); ctx.strokeStyle=P.ink; ctx.globalAlpha=0.55; ctx.lineWidth=1.5; line(ctx,pxA,pyA,pxA,G.gy); line(ctx,G.padL-4,pyA,pxA,pyA); ctx.setLineDash([]); ctx.globalAlpha=1;
    ctx.fillStyle=P.butter; ctx.strokeStyle=P.ink; ctx.beginPath(); ctx.arc(pxA,pyA,5,0,TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle=P.ink; ctx.font='600 12px "DM Mono",monospace'; ctx.textAlign='center'; ctx.fillText('H = '+fmt(r.H,1)+' m',clamp(pxA,60,w-60),Math.max(pyA-10,14)); ctx.textAlign='left';
  }
  function pathTo(tEnd){ var N=Math.max(2,Math.round(120*tEnd/Math.max(r.T,0.001))); ctx.beginPath(); for(var q=0;q<=N;q++){ var tt=tEnd*q/N, X2=sx(r.vx*tt), Y2=sy(Math.max(p.h0+r.vy0*tt-0.5*p.g*tt*tt,0)); if(q===0)ctx.moveTo(X2,Y2); else ctx.lineTo(X2,Y2); } ctx.stroke(); }
  if(r.T>0){
    ctx.setLineDash([6,6]); ctx.strokeStyle=P.ink; ctx.globalAlpha=0.45; ctx.lineWidth=2; pathTo(r.T); ctx.setLineDash([]); ctx.globalAlpha=1;
    if(t>0){
      var gg=ctx.createLinearGradient(sx(0),0,sx(r.R)+1,0); [P.pink,P.butter,P.mint,P.sky,P.lilac].forEach(function(c,ix){gg.addColorStop(ix/4,c);});
      ctx.strokeStyle=gg; ctx.lineWidth=6; ctx.lineCap='round'; pathTo(Math.min(t,r.T));
    }
  }
  var c=cartAt(t); drawCart(ctx,P,sx(c.x),sy(c.y),c.ang);
  if(cs.sinceLand>=0&&cs.sinceLand<1.3){
    var u=cs.sinceLand/1.3; ctx.globalAlpha=1-u;
    var cols=[P.pink,P.butter,P.mint,P.sky,P.lilac,P.pink,P.butter,P.mint];
    for(var m=0;m<8;m++){ var aa=Math.PI*(0.1+0.8*m/7), rad=14+u*46; ctx.fillStyle=cols[m]; star4(ctx,fx+Math.cos(aa)*rad*1.3,G.gy-6-Math.sin(aa)*rad,5+4*(1-u)); }
    ctx.globalAlpha=1;
  }
  ctx.fillStyle=P.ink; ctx.font='11px "DM Mono",monospace'; ctx.fillText('1 grid square = '+step+' m',G.padL,16);
  coasterLive();
}
function coasterLive(){
  var r=cs.res,p=cs.p; if(!r)return;
  var tt=clamp(cs.t,0,r.T), vy=r.vy0-p.g*tt, x=r.vx*tt, y=Math.max(p.h0+r.vy0*tt-0.5*p.g*tt*tt,0);
  $('lv-t').textContent=fmt(tt); $('lv-x').textContent=fmt(x); $('lv-y').textContent=fmt(y); $('lv-vx').textContent=fmt(r.vx); $('lv-vy').textContent=fmt(vy); $('lv-v').textContent=fmt(Math.hypot(r.vx,vy));
}
function coasterReset(){ cancelAnimationFrame(cs.raf); cs.playing=false; cs.sinceLand=-1; cs.t=-cs.tLead; $('c-go').textContent='Launch the car'; drawCoaster(); }
function coasterChanged(){ coasterCompute(); coasterReport(); coasterReset(); }
function coasterLoop(now){
  if(!cs.playing)return;
  var real=Math.min((now-cs.last)/1000,0.05); cs.last=now;
  var sp=+$('c-speed').value;
  if(cs.t<cs.res.T){
    var was=cs.t; cs.t+=real*sp;
    if(cs.t<0){ var kk=Math.floor((cs.t+cs.tLead)*8); if(kk!==cs.lastClack){cs.lastClack=kk;sfx.clack();} }
    else if(!cs.released){ cs.released=true; sfx.whoosh(); }
    if(cs.t>=cs.res.T){cs.t=cs.res.T; cs.sinceLand=0; sfx.land(true); fxBurst(FX.w*0.5,FX.h*0.5,18,220,1.1);}
  } else { cs.sinceLand+=real; }
  drawCoaster();
  if(cs.t>=cs.res.T&&cs.sinceLand>1.3){ cs.playing=false; cs.sinceLand=-1; $('c-go').textContent='Launch again'; drawCoaster(); return; }
  cs.raf=requestAnimationFrame(coasterLoop);
}
$('c-go').addEventListener('click',function(){
  cancelAnimationFrame(cs.raf); coasterCompute(); cs.t=-cs.tLead; cs.sinceLand=-1; cs.playing=true; cs.released=false; cs.lastClack=-1; cs.last=performance.now(); $('c-go').textContent='Flying…'; cs.raf=requestAnimationFrame(coasterLoop);
});
$('c-reset').addEventListener('click',coasterReset);
$('planets').addEventListener('click',function(e){ var b=e.target.closest('button[data-g]'); if(b){ sfx.click(); cf.g.set(b.getAttribute('data-g')); } });

/* ================= BUMPER LAB ================= */
var bf={}, bs={p:null,r:null,cars:[],t:0,tc:0,collided:false,tCol:0,flash:-1,playing:false,raf:0,last:0,done:false,cp:{x:10,y:5}};
function carCfg(pfx,m,v,a){
  return [
    {k:pfx+'m',id:pfx+'-m',label:'Mass m',unit:'kg',min:40,max:500,step:5,value:m},
    {k:pfx+'v',id:pfx+'-v',label:'Velocity v (right is +)',unit:'m/s',min:-12,max:12,step:0.1,value:v},
    {k:pfx+'L',id:pfx+'-L',label:'Length L',unit:'m',min:1,max:3,step:0.05,value:1.8},
    {k:pfx+'W',id:pfx+'-W',label:'Width W',unit:'m',min:0.8,max:2,step:0.05,value:1.2},
    {k:pfx+'a',id:pfx+'-a',label:'Hit point from centre',unit:'m',min:-1,max:1,step:0.05,value:a}
  ];
}
carCfg('a',220,5,0.4).forEach(function(c){ bf[c.k]=makeField($('a-fields'),c,bumperChanged); });
carCfg('b',160,-2,-0.3).forEach(function(c){ bf[c.k]=makeField($('b-fields'),c,bumperChanged); });
bf.e=makeField($('shared-fields'),{k:'e',id:'b-e',label:'Bounciness e (0 sticks, 1 bounces fully)',unit:'',min:0,max:1,step:0.01,value:0.6},bumperChanged);
function bumperCompute(){
  var p={m1:bf.am.get(),v1:bf.av.get(),L1:bf.aL.get(),W1:bf.aW.get(),a1r:bf.aa.get(),
         m2:bf.bm.get(),v2:bf.bv.get(),L2:bf.bL.get(),W2:bf.bW.get(),a2r:bf.ba.get(),e:bf.e.get()};
  p.a1=clamp(p.a1r,-p.W1/2,p.W1/2); p.a2=clamp(p.a2r,-p.W2/2,p.W2/2);
  var I1=p.m1*(p.L1*p.L1+p.W1*p.W1)/12, I2=p.m2*(p.L2*p.L2+p.W2*p.W2)/12;
  var vrel=p.v2-p.v1, approaching=vrel<-1e-9;
  var denom=1/p.m1+1/p.m2+p.a1*p.a1/I1+p.a2*p.a2/I2;
  var J=approaching?-(1+p.e)*vrel/denom:0;
  var v1p=p.v1-J/p.m1, v2p=p.v2+J/p.m2, w1=p.a1*J/I1, w2=-p.a2*J/I2;
  var P0=p.m1*p.v1+p.m2*p.v2, P1=p.m1*v1p+p.m2*v2p;
  var K0=0.5*p.m1*p.v1*p.v1+0.5*p.m2*p.v2*p.v2;
  var K1a=0.5*p.m1*v1p*v1p+0.5*I1*w1*w1, K1b=0.5*p.m2*v2p*v2p+0.5*I2*w2*w2;
  var Lc0=p.m1*p.a1*p.v1+p.m2*p.a2*p.v2, Lc1=I1*w1+p.m1*p.a1*v1p+I2*w2+p.m2*p.a2*v2p;
  bs.p=p; bs.r={I1:I1,I2:I2,vrel:vrel,approaching:approaching,denom:denom,J:J,v1p:v1p,v2p:v2p,w1:w1,w2:w2,P0:P0,P1:P1,K0:K0,K1a:K1a,K1b:K1b,K1:K1a+K1b,Lc0:Lc0,Lc1:Lc1,
    ke1a:0.5*p.m1*p.v1*p.v1,ke1b:0.5*p.m2*p.v2*p.v2};
}
function bumperReport(){
  var p=bs.p,r=bs.r;
  var rows=[
    ['Velocity v (m/s)',sgn(p.v1),sgn(r.v1p),sgn(p.v2),sgn(r.v2p)],
    ['Momentum p = mv (kg·m/s)',sgn(p.m1*p.v1,1),sgn(p.m1*r.v1p,1),sgn(p.m2*p.v2,1),sgn(p.m2*r.v2p,1)],
    ['Spin ω (rad/s)','0.00',sgn(r.w1),'0.00',sgn(r.w2)],
    ['Kinetic energy (J)',fmt(r.ke1a,1),fmt(r.K1a,1),fmt(r.ke1b,1),fmt(r.K1b,1)]
  ];
  $('bumper-table').innerHTML='<thead><tr><th></th><th>Car A before</th><th>Car A after</th><th>Car B before</th><th>Car B after</th></tr></thead><tbody>'+rows.map(function(x){return '<tr><td>'+x[0]+'</td><td>'+x[1]+'</td><td>'+x[2]+'</td><td>'+x[3]+'</td><td>'+x[4]+'</td></tr>';}).join('')+'</tbody>';
  var kind=p.e>=0.995?'Elastic bounce':(p.e<=0.005?'Perfectly sticky':'Partly bouncy');
  var lost=r.K0-r.K1, conserved=Math.abs(r.P1-r.P0)<1e-6*Math.max(1,Math.abs(r.P0));
  var d=[
    ['Collision type',r.approaching?kind:'No collision'],
    ['Impulse J',fmt(r.J,1)+' <i>N·s</i>'],
    ['Moment of inertia I<sub>A</sub>',fmt(r.I1)+' <i>kg·m²</i>'],
    ['Moment of inertia I<sub>B</sub>',fmt(r.I2)+' <i>kg·m²</i>'],
    ['Total momentum before',sgn(r.P0,1)+' <i>kg·m/s</i>'],
    ['Total momentum after',sgn(r.P1,1)+' <i>kg·m/s</i>'],
    ['Angular momentum before (about hit point)',fmt(r.Lc0,1)+' <i>kg·m²/s</i>'],
    ['Angular momentum after (about hit point)',fmt(r.Lc1,1)+' <i>kg·m²/s</i>'],
    ['Energy lost as heat and noise',fmt(lost,1)+' <i>J</i>']
  ];
  $('bumper-report').innerHTML=d.map(function(x){return '<div class="row"><dt>'+x[0]+'</dt><dd>'+x[1]+'</dd></div>';}).join('');
  var note=[];
  if(!r.approaching)note.push('Car B is moving away from car A or at the same speed, so the cars never touch. Make car A faster or car B slower.');
  else note.push('Total momentum is '+(conserved?'conserved':'not conserved')+' because the cars push on each other with equal and opposite impulses.');
  if(p.a1!==p.a1r||p.a2!==p.a2r)note.push('A hit point was limited to half the car width so it stays on the bumper.');
  $('bumper-note').textContent=note.join(' ');
  var A='<b>',Z='</b>';
  var w=[
    ['Moment of inertia','<div class="eq">I = ⅟₁₂ m (L² + W²)<br>I<sub>A</sub> = ⅟₁₂ × '+fmt(p.m1,0)+' × ('+fmt(p.L1)+'² + '+fmt(p.W1)+'²) = '+A+fmt(r.I1)+' kg·m²'+Z+'<br>I<sub>B</sub> = ⅟₁₂ × '+fmt(p.m2,0)+' × ('+fmt(p.L2)+'² + '+fmt(p.W2)+'²) = '+A+fmt(r.I2)+' kg·m²'+Z+'</div>'],
    ['Closing speed','<div class="eq">v<sub>rel</sub> = v<sub>B</sub> − v<sub>A</sub> = '+fmt(p.v2)+' − ('+fmt(p.v1)+') = '+A+fmt(r.vrel)+' m/s'+Z+'<br>'+(r.approaching?'Negative means the cars are closing, so they collide.':'Not negative, so the cars do not collide.')+'</div>'],
    ['Impulse','<div class="eq">J = −(1 + e) v<sub>rel</sub> ÷ (1/m<sub>A</sub> + 1/m<sub>B</sub> + a<sub>A</sub>²/I<sub>A</sub> + a<sub>B</sub>²/I<sub>B</sub>)<br>denominator = '+(1/p.m1).toFixed(5)+' + '+(1/p.m2).toFixed(5)+' + '+(p.a1*p.a1/r.I1).toFixed(5)+' + '+(p.a2*p.a2/r.I2).toFixed(5)+' = '+r.denom.toFixed(5)+'<br>J = '+A+fmt(r.J,1)+' N·s'+Z+'</div>'],
    ['Speeds after the hit','<div class="eq">v<sub>A</sub>′ = v<sub>A</sub> − J ÷ m<sub>A</sub> = '+fmt(p.v1)+' − '+fmt(r.J,1)+' ÷ '+fmt(p.m1,0)+' = '+A+fmt(r.v1p)+' m/s'+Z+'<br>v<sub>B</sub>′ = v<sub>B</sub> + J ÷ m<sub>B</sub> = '+fmt(p.v2)+' + '+fmt(r.J,1)+' ÷ '+fmt(p.m2,0)+' = '+A+fmt(r.v2p)+' m/s'+Z+'</div>'],
    ['Spin after the hit','<div class="eq">ω<sub>A</sub> = a<sub>A</sub> J ÷ I<sub>A</sub> = '+fmt(p.a1)+' × '+fmt(r.J,1)+' ÷ '+fmt(r.I1)+' = '+A+fmt(r.w1)+' rad/s'+Z+'<br>ω<sub>B</sub> = −a<sub>B</sub> J ÷ I<sub>B</sub> = −('+fmt(p.a2)+') × '+fmt(r.J,1)+' ÷ '+fmt(r.I2)+' = '+A+fmt(r.w2)+' rad/s'+Z+'<br>Positive spin turns counter-clockwise seen from above.</div>'],
    ['Conservation check','<div class="eq">Σp before = '+fmt(r.P0,1)+', after = '+fmt(r.P1,1)+' kg·m/s<br>ΣL before = '+fmt(r.Lc0,1)+', after = '+fmt(r.Lc1,1)+' kg·m²/s<br>KE before = '+fmt(r.K0,1)+' J, after = '+fmt(r.K1,1)+' J<br>Energy lost = '+A+fmt(lost,1)+' J'+Z+'</div>']
  ];
  $('bumper-work').innerHTML=w.map(function(s){return '<li><h4>'+s[0]+'</h4>'+s[1]+'</li>';}).join('');
}
function bumperInit(){
  if(!bs.p)return;
  var p=bs.p,r=bs.r,cx=10,tc,f1,f2;
  if(r.approaching){ var sp=Math.max(Math.abs(p.v1),Math.abs(p.v2),0.1); tc=Math.min(1.3,6.5/sp); f1=cx-p.v1*tc; f2=cx-p.v2*tc; }
  else{ tc=Infinity; f1=cx-1.5; f2=cx+1.5; }
  var y1=5-(p.a1-p.a2)/2, y2=y1+p.a1-p.a2;
  bs.cars=[{x:f1-p.L1/2,y:y1,ang:0,base:0,v:p.v1,w:0},{x:f2+p.L2/2,y:y2,ang:0,base:Math.PI,v:p.v2,w:0}];
  bs.tc=tc; bs.t=0; bs.collided=false; bs.tCol=0; bs.flash=-1; bs.done=false; bs.cp={x:cx,y:y1+p.a1};
}
function bumperAdvance(dt){ bs.cars.forEach(function(c){c.x+=c.v*dt;c.ang+=c.w*dt;}); bs.t+=dt; }
function bumperCollide(){ var r=bs.r; bs.cars[0].v=r.v1p; bs.cars[1].v=r.v2p; bs.cars[0].w=r.w1; bs.cars[1].w=r.w2; bs.collided=true; bs.tCol=bs.t; bs.flash=0; sfx.crash(); if(Math.abs(r.w1)+Math.abs(r.w2)>0.3)sfx.zap(); fxBurst(FX.w*0.5,FX.h*0.45,22,260,1.2); }
function bumperStep(dt){
  var rem=dt;
  if(!bs.collided&&bs.r.approaching&&bs.t+rem>=bs.tc){ var d1=Math.max(bs.tc-bs.t,0); bumperAdvance(d1); bumperCollide(); rem-=d1; }
  bumperAdvance(rem);
  var hit=bs.cars.some(function(c,i){ var L=i?bs.p.L2:bs.p.L1; return c.x-L/2<=0.1||c.x+L/2>=19.9; });
  if(bs.collided&&bs.t-bs.tCol>2.6)bs.done=true;
  if(!bs.r.approaching&&bs.t>3.5)bs.done=true;
  if(hit)bs.done=true;
}
function drawBumper(){
  var cv=$('bumper-canvas'); if(!cv||$('s-bumper-lab').hidden||!bs.p)return;
  var b=fit(cv,0.5,200,430); if(!b)return;
  var ctx=b.ctx,w=b.w,h=b.h,P=pal(),s=Math.min(w/20,h/10),ox=(w-20*s)/2,oy=(h-10*s)/2;
  function sx(x){return ox+x*s;} function sy(y){return oy+(10-y)*s;}
  drawArena(ctx,P,w,h,s,ox,oy);
  var p=bs.p,r=bs.r;
  if(!bs.collided&&r.approaching){ ctx.strokeStyle=P.ink; ctx.globalAlpha=0.55; ctx.lineWidth=1.5; ctx.setLineDash([3,4]); ctx.beginPath(); ctx.arc(sx(bs.cp.x),sy(bs.cp.y),9,0,TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1; }
  var dims=[[p.L1,p.W1,P.pink,'A'],[p.L2,p.W2,P.mint,'B']];
  bs.cars.forEach(function(c,i){
    var cc={px:sx(c.x),py:sy(c.y),ang:c.ang,base:c.base};
    drawBumperCar(ctx,P,cc,dims[i][0]*s,dims[i][1]*s,dims[i][2],dims[i][3]);
    var vv=c.v, tip=sy(c.y)-dims[i][1]*s*0.5-14, k=clamp(Math.abs(vv)*7,0,90);
    if(Math.abs(vv)>0.02){ arrow(ctx,cc.px,tip,cc.px+Math.sign(vv)*k,tip,P.ink,2.5); ctx.fillStyle=P.ink; ctx.font='600 11px "DM Mono",monospace'; ctx.textAlign='center'; ctx.fillText(fmt(vv,1)+' m/s',cc.px+Math.sign(vv)*k/2,tip-8); }
    if(Math.abs(c.w)>0.02){ ctx.fillStyle=P.ink; ctx.font='600 11px "DM Mono",monospace'; ctx.textAlign='center'; ctx.fillText((c.w>0?'↺ ':'↻ ')+fmt(Math.abs(c.w),1)+' rad/s',cc.px,sy(c.y)+dims[i][1]*s*0.5+30); }
  });
  if(bs.flash>=0&&bs.flash<0.8){ var u=bs.flash/0.8; ctx.globalAlpha=1-u; ctx.fillStyle=P.butter; star4(ctx,sx(bs.cp.x),sy(bs.cp.y),14+u*30); ctx.fillStyle=P.pink; star4(ctx,sx(bs.cp.x),sy(bs.cp.y),8+u*14); ctx.globalAlpha=1; }
  ctx.textAlign='left'; ctx.fillStyle=P.ink; ctx.font='11px "DM Mono",monospace'; ctx.fillText('Arena 20 m × 10 m, top view',ox+12,oy+22);
  bumperLive();
}
function bumperLive(){
  if(!bs.cars.length)return;
  var a=bs.cars[0],c=bs.cars[1];
  $('bl-t').textContent=fmt(bs.t); $('bl-va').textContent=sgn(a.v); $('bl-vb').textContent=sgn(c.v); $('bl-wa').textContent=sgn(a.w); $('bl-wb').textContent=sgn(c.w);
  $('bl-st').textContent=bs.done?'Ride over':(bs.collided?'After hit':(bs.playing?'Rolling in':'Ready'));
}
function bumperReset(){ cancelAnimationFrame(bs.raf); bs.playing=false; bumperInit(); $('b-go').textContent='Start the crash'; drawBumper(); }
function bumperChanged(){ bumperCompute(); bumperReport(); bumperReset(); }
function bumperLoop(now){
  if(!bs.playing)return;
  var real=Math.min((now-bs.last)/1000,0.05); bs.last=now;
  bumperStep(real*(+$('b-speed').value));
  if(bs.flash>=0)bs.flash+=real;
  drawBumper();
  if(bs.done){ bs.playing=false; $('b-go').textContent='Crash again'; drawBumper(); return; }
  bs.raf=requestAnimationFrame(bumperLoop);
}
$('b-go').addEventListener('click',function(){ cancelAnimationFrame(bs.raf); bumperInit(); bs.playing=true; bs.last=performance.now(); $('b-go').textContent='Rolling…'; bs.raf=requestAnimationFrame(bumperLoop); });
$('b-reset').addEventListener('click',bumperReset);
var presets={
  head:{am:200,av:4,aa:0,bm:200,bv:-4,ba:0,e:1},
  heavy:{am:300,av:3,aa:0,bm:100,bv:-3,ba:0,e:0.8},
  sticky:{am:220,av:5,aa:0,bm:160,bv:-2,ba:0,e:0},
  spin:{am:200,av:5,aa:0.5,bm:200,bv:0,ba:-0.4,e:0.5}
};
$('presets').addEventListener('click',function(e){
  var btn=e.target.closest('button[data-p]'); if(!btn)return; sfx.click(); var pr=presets[btn.getAttribute('data-p')];
  Object.keys(pr).forEach(function(k){ bf[k].set(pr[k],true); }); bumperChanged();
});

/* ================= COASTER GAME ================= */
var CL=[
  {name:'Warm-Up Hill',g:9.81,h0:0,v:20,th:45,hw:5,pv:'full',vmax:35,obs:0,coins:[],blurb:'On flat ground the longest flight comes from a 45° launch. A dotted line shows the predicted path while you learn.'},
  {name:'Cloud Jump',g:9.81,h0:18,v:18,th:25,hw:4.5,pv:'part',vmax:35,obs:0,coins:[],blurb:'Launching from a tall platform gives the car extra time in the air, so even a low angle travels far. You only see the first part of the path.'},
  {name:'Moon Bounce',g:1.62,h0:10,v:14,th:40,hw:7,pv:'none',vmax:30,obs:0,coins:[],blurb:'The Moon pulls with 1.62 m/s², about one sixth of Earth. The same launch flies much farther, so go gently. No path preview from here on.'},
  {name:'Mars Hurdle',g:3.71,h0:6,v:18,th:45,hw:6,pv:'none',vmax:30,obs:1,coins:[],blurb:'A tower stands in the way. The car has to clear it and still land on the pad.'},
  {name:'Star Chaser',g:9.81,h0:20,v:22,th:35,hw:4,pv:'none',vmax:40,obs:0,coins:[0.3,0.55,0.8],blurb:'Grab the gold stars on the way down for 30 bonus points each. They sit on a path that also reaches the pad.'},
  {name:'Jupiter Express',g:24.79,h0:5,v:40,th:30,hw:3.5,pv:'none',vmax:60,obs:1,coins:[0.35,0.65],blurb:'Jupiter pulls with 24.79 m/s², so flights are short and fast. Clear the tower, grab the stars and land on the pad.'}
];
var gs={i:0,lv:null,F:{},tx:0,obs:null,coins:[],xmax:100,ymax:50,p:null,pL:null,fl:null,t:-0.9,tL:0.9,playing:false,launched:false,ended:false,released:false,lastClack:0,raf:0,last:0,clock:0,endClock:-9,sparks:[],attempts:0,hints:0,gotCount:0,ts:1,drag:false,res:null};
gs.F.v=makeField($('cg-fields'),{id:'cg-v',label:'Launch speed v<sub>0</sub>',unit:'m/s',min:1,max:35,step:0.1,value:20},cgChanged);
gs.F.th=makeField($('cg-fields'),{id:'cg-th',label:'Launch angle θ',unit:'degrees',min:-10,max:80,step:0.5,value:40},cgChanged);

function flightOf(g,h0,v,th){
  var a=th*D2R,vx=v*Math.cos(a),vy=v*Math.sin(a),T=(vy+Math.sqrt(vy*vy+2*g*h0))/g,sth=Math.sin(a),cth=Math.cos(a);
  var Lr=sth>0.001?Math.min(9,h0/sth):9; if(h0<=0.05&&sth>0)Lr=0; Lr=Math.max(Lr,0); T=Math.max(T,0);
  return {g:g,h0:h0,v:v,th:th,a:a,vx:vx,vy:vy,T:T,R:vx*T,H:h0+(vy>0?vy*vy/(2*g):0),Lr:Lr,x0:-Lr*cth,y0:h0-Lr*sth};
}
function posAt(fl,t){ return {x:fl.vx*t,y:Math.max(fl.h0+fl.vy*t-0.5*fl.g*t*t,0),vy:fl.vy-fl.g*t}; }
function cgSetup(i){
  var L=CL[i], fl=flightOf(L.g,L.h0,L.v,L.th), tx=Math.round(fl.R*2)/2;
  function refY(x){ var t=x/fl.vx; return L.h0+fl.vy*t-0.5*L.g*t*t; }
  var obs=null; if(L.obs){ var ox=Math.round(0.42*fl.R); obs={x:ox,h:Math.max(3,Math.floor(refY(ox)-3)),w:1.6}; }
  var coins=L.coins.map(function(f){ var t=f*fl.T; return {x:fl.vx*t,y:L.h0+fl.vy*t-0.5*L.g*t*t,got:false,r:Math.max(1.6,0.03*tx)}; });
  gs.lv=L; gs.tx=tx; gs.obs=obs; gs.coins=coins; gs.xmax=Math.max(tx+L.hw+0.12*tx,tx*1.2); gs.ymax=Math.max(fl.H,L.h0,obs?obs.h:0)*1.22+4;
}
function cgLoad(i){
  stopAll(); gs.i=i; cgSetup(i); var L=gs.lv;
  gs.attempts=0; gs.hints=0; gs.sparks=[]; gs.launched=false; gs.ended=false; gs.gotCount=0; gs.t=-0.9; gs.res=null;
  gs.F.v.range(1,L.vmax,0.1); gs.F.v.set(Math.round(L.vmax*0.45*10)/10,true); gs.F.th.set(40,true);
  $('cg-hintbox').textContent=''; $('cg-go').textContent='Launch!'; $('cg-go').disabled=false;
  $('cgl-c').textContent='0 / '+gs.coins.length;
  var facts='<span><b>Pad centre</b>'+fmt(gs.tx,1)+' m</span><span><b>Pad half-width</b>±'+fmt(L.hw,1)+' m</span><span><b>Gravity</b>'+fmt(L.g)+' m/s²</span><span><b>Launch height</b>'+fmt(L.h0,0)+' m</span>';
  if(gs.obs)facts+='<span><b>Tower</b>'+fmt(gs.obs.x,0)+' m away, '+fmt(gs.obs.h,0)+' m tall</span>';
  if(gs.coins.length)facts+='<span><b>Gold stars</b>'+gs.coins.length+' to grab</span>';
  $('cg-brief').innerHTML='<h3>Level '+(i+1)+' · '+L.name+'</h3><p>'+L.blurb+'</p><div class="facts">'+facts+'</div><p class="note">Land inside the pad for a star. Land close to its centre for three.</p>';
  $('cg-result').innerHTML='<p>Set your angle and speed, then press Launch. You can also drag on the picture to aim: the direction sets the angle and the length sets the speed.</p>';
  renderLevels('coaster','cg-levels',i); cgDraw();
}
function cgChanged(){ if(gs.playing||!gs.lv)return; gs.launched=false; gs.ended=false; gs.t=-0.9; cgDraw(); }
function cgGeom(w,h){
  var padL=44,padR=18,padT=24,padB=40, xmin=-12, xmax=gs.xmax, ymax=gs.ymax;
  var s=Math.min((w-padL-padR)/(xmax-xmin),(h-padT-padB)/ymax), ox=padL-xmin*s, gy=h-padB;
  return {s:s,gy:gy,top:padT,padL:padL,xmin:xmin,xmax:xmax,ymaxView:(gy-padT)/s,sx:function(x){return ox+x*s;},sy:function(y){return gy-y*s;}};
}
function drawPad(ctx,P,G,tx,hw){
  var y=G.gy, x0=G.sx(tx-hw), x1=G.sx(tx+hw), m=G.sx(tx);
  ctx.lineWidth=2; ctx.strokeStyle=P.ink; ctx.fillStyle=P.mint; rr(ctx,x0,y-8,x1-x0,11,3); ctx.fill(); ctx.stroke();
  var a=G.sx(tx-hw*0.7),b=G.sx(tx+hw*0.7); ctx.fillStyle=P.pink; ctx.fillRect(a,y-7,b-a,9);
  a=G.sx(tx-hw*0.35); b=G.sx(tx+hw*0.35); ctx.fillStyle=P.butter; ctx.fillRect(a,y-7,b-a,9);
  ctx.strokeStyle=P.ink; ctx.lineWidth=2; line(ctx,m,y-8,m,y-44);
  ctx.fillStyle=P.pink; ctx.beginPath(); ctx.moveTo(m,y-44); ctx.lineTo(m+18,y-38); ctx.lineTo(m,y-32); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle=P.ink; ctx.font='600 12px "DM Mono",monospace'; ctx.textAlign='center'; ctx.fillText('pad '+fmt(tx,1)+' m',clamp(m,50,G.sx(G.xmax)),y-50); ctx.textAlign='left';
}
function drawTower(ctx,P,G,o){
  var x0=G.sx(o.x-o.w/2),x1=G.sx(o.x+o.w/2),yt=G.sy(o.h),wpx=Math.max(x1-x0,10),cx=(x0+x1)/2;
  ctx.fillStyle=P.lilac; ctx.strokeStyle=P.ink; ctx.lineWidth=2; rr(ctx,cx-wpx/2,yt,wpx,G.gy-yt,3); ctx.fill(); ctx.stroke();
  ctx.globalAlpha=0.5; ctx.lineWidth=1.2; for(var y=yt+14;y<G.gy-4;y+=14)line(ctx,cx-wpx/2,y,cx+wpx/2,y); ctx.globalAlpha=1;
  ctx.lineWidth=2; line(ctx,cx,yt,cx,yt-24); ctx.fillStyle=P.butter; ctx.beginPath(); ctx.moveTo(cx,yt-24); ctx.lineTo(cx+16,yt-18); ctx.lineTo(cx,yt-12); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle=P.ink; ctx.font='600 12px "DM Mono",monospace'; ctx.textAlign='center'; ctx.fillText(fmt(o.h,0)+' m',cx,yt-30); ctx.textAlign='left';
}
function drawCoin(ctx,P,x,y,r,ph){
  var rx=Math.max(2.5,r*Math.abs(Math.cos(ph)));
  ctx.fillStyle=P.butter; ctx.strokeStyle=P.ink; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(x,y,rx,r,0,0,TAU); ctx.fill(); ctx.stroke();
  if(rx>6){ ctx.fillStyle=P.ink; star4(ctx,x,y,Math.min(rx,r)*0.6); }
}
function cgDraw(){
  var cv=$('cg-canvas'); if(!cv||$('s-coaster-play').hidden||!gs.lv)return;
  var b=fit(cv,0.56,300,470); if(!b)return;
  var ctx=b.ctx,w=b.w,h=b.h,P=pal(),G=cgGeom(w,h),L=gs.lv,sx=G.sx,sy=G.sy;
  var p=gs.launched?gs.pL:{v:gs.F.v.get(),th:gs.F.th.get()};
  var fl=(gs.launched&&gs.fl)?gs.fl:flightOf(L.g,L.h0,p.v,p.th);
  var t=gs.t;
  drawScenery(ctx,P,w,h,G);
  /* ramp */
  var Ax=sx(fl.x0),Ay=sy(fl.y0),Bx=sx(0),By=sy(L.h0);
  ctx.lineCap='round'; ctx.strokeStyle=P.ink; ctx.globalAlpha=0.5; ctx.lineWidth=2;
  var np=Math.max(2,Math.round(fl.Lr/2.5));
  for(var k=0;k<=np;k++){ var f=k/np,px=Ax+(Bx-Ax)*f,py=Ay+(By-Ay)*f; if(G.gy-py>3)line(ctx,px,py,px,G.gy); }
  if(G.gy-By>3){ ctx.lineWidth=4; line(ctx,Bx,By,Bx,G.gy); }
  ctx.globalAlpha=1;
  if(fl.Lr>0.3){ ctx.strokeStyle=P.ink; ctx.lineWidth=7; line(ctx,Ax,Ay,Bx,By); ctx.strokeStyle=P.rail; ctx.lineWidth=3; line(ctx,Ax,Ay,Bx,By); }
  ctx.fillStyle=P.butter; ctx.strokeStyle=P.ink; ctx.lineWidth=1.5; rr(ctx,Bx-9,By-3,18,6,3); ctx.fill(); ctx.stroke();
  drawPad(ctx,P,G,gs.tx,L.hw);
  if(gs.obs)drawTower(ctx,P,G,gs.obs);
  /* preview path */
  if(!gs.launched&&L.pv!=='none'&&fl.T>0){
    var tEnd=L.pv==='full'?fl.T:fl.T*0.45, N=70; ctx.setLineDash([2,9]); ctx.lineCap='round'; ctx.strokeStyle=P.ink; ctx.lineWidth=3.5; ctx.globalAlpha=0.65; ctx.beginPath();
    for(var q=0;q<=N;q++){ var tt=tEnd*q/N,pp=posAt(fl,tt); if(q===0)ctx.moveTo(sx(pp.x),sy(pp.y)); else ctx.lineTo(sx(pp.x),sy(pp.y)); } ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
  }
  /* coins */
  var ph=gs.clock*3;
  gs.coins.forEach(function(c,ix){ if(!c.got)drawCoin(ctx,P,sx(c.x),sy(c.y),Math.max(9,c.r*G.s),ph+ix); });
  /* travelled trail */
  if(gs.launched&&t>0){
    var te=Math.min(t,fl.T), gg=ctx.createLinearGradient(sx(0),0,sx(Math.max(fl.R,1))+1,0); [P.pink,P.butter,P.mint,P.sky,P.lilac].forEach(function(c,ix){gg.addColorStop(ix/4,c);});
    ctx.strokeStyle=gg; ctx.lineWidth=6; ctx.lineCap='round'; ctx.beginPath(); var N2=Math.max(2,Math.round(100*te/Math.max(fl.T,0.001)));
    for(var q2=0;q2<=N2;q2++){ var t2=te*q2/N2,p2=posAt(fl,t2); if(q2===0)ctx.moveTo(sx(p2.x),sy(p2.y)); else ctx.lineTo(sx(p2.x),sy(p2.y)); } ctx.stroke();
  }
  /* cart */
  var cx,cy,cang;
  if(t<0){ var ff=clamp((t+gs.tL)/gs.tL,0,1); ff=ff*ff; cx=fl.x0*(1-ff); cy=fl.y0+(L.h0-fl.y0)*ff; cang=fl.a; }
  else { var q3=posAt(fl,Math.min(t,fl.T)); cx=q3.x; cy=q3.y; cang=Math.atan2(q3.vy,fl.vx); }
  drawCart(ctx,P,sx(cx),sy(cy),cang);
  /* aim arrow */
  if(!gs.launched){
    var len=Math.max(14,clamp(p.v/L.vmax,0,1)*0.30*w), lx=sx(0),ly=sy(L.h0), ex=lx+Math.cos(fl.a)*len, ey=ly-Math.sin(fl.a)*len;
    arrow(ctx,lx,ly,ex,ey,P.accent,4);
    ctx.fillStyle=P.ink; ctx.font='600 12px "DM Mono",monospace'; ctx.textAlign='left'; ctx.fillText(fmt(p.th,1)+'°  '+fmt(p.v,1)+' m/s',clamp(ex+10,8,w-120),clamp(ey-8,14,h-50));
  }
  /* sparks */
  var cols=[P.pink,P.butter,P.mint,P.sky,P.lilac,P.pink,P.butter,P.mint];
  gs.sparks=gs.sparks.filter(function(sp){ return gs.clock-sp.t0<1.2; });
  gs.sparks.forEach(function(sp){
    var u=(gs.clock-sp.t0)/1.2; ctx.globalAlpha=1-u;
    for(var m=0;m<8;m++){ var aa=TAU*m/8, rad=(sp.big?18:10)+u*(sp.big?50:36); ctx.fillStyle=cols[m]; star4(ctx,sx(sp.x)+Math.cos(aa)*rad,sy(sp.y)-6-Math.sin(aa)*rad,5+4*(1-u)); }
    ctx.globalAlpha=1;
  });
  ctx.fillStyle=P.ink; ctx.font='11px "DM Mono",monospace'; ctx.textAlign='left'; ctx.fillText('g = '+fmt(L.g)+' m/s²',G.padL,16);
  cgLive(fl);
}
function cgLive(fl){
  var tt=clamp(gs.t,0,fl.T), q=posAt(fl,tt);
  var spd=gs.launched||gs.t>=0?Math.hypot(fl.vx,q.vy):0; if(!gs.launched)spd=0;
  $('cgl-t').textContent=fmt(gs.launched?tt:0); $('cgl-x').textContent=fmt(gs.launched?q.x:0); $('cgl-y').textContent=fmt(gs.launched?q.y:fl.h0); $('cgl-v').textContent=fmt(spd);
  $('cgl-c').textContent=gs.gotCount+' / '+gs.coins.length;
}
function cgLaunch(){
  if(gs.playing||!gs.lv)return; audioInit();
  var p={v:gs.F.v.get(),th:gs.F.th.get()}; gs.pL=p; gs.fl=flightOf(gs.lv.g,gs.lv.h0,p.v,p.th);
  gs.coins.forEach(function(c){c.got=false;}); gs.gotCount=0; gs.attempts++; gs.sparks=[];
  gs.tL=gs.fl.Lr>0.3?0.9:0.45; gs.t=-gs.tL; gs.launched=true; gs.playing=true; gs.ended=false; gs.released=false; gs.lastClack=-1;
  gs.ts=Math.max(1,gs.fl.T/5.5);
  $('cg-go').textContent='Flying…'; $('cg-result').innerHTML='<p>Climbing the ramp…</p>';
  gs.last=performance.now(); cancelAnimationFrame(gs.raf); gs.raf=requestAnimationFrame(cgLoop);
}
function cgStep(){
  var fl=gs.fl;
  if(gs.t<0){ var k=Math.floor((gs.t+gs.tL)*9); if(k!==gs.lastClack){gs.lastClack=k;sfx.clack();} return; }
  if(!gs.released){ gs.released=true; sfx.whoosh(); }
  if(gs.t>=fl.T){ gs.t=fl.T; cgFinish('land'); return; }
  var q=posAt(fl,gs.t);
  gs.coins.forEach(function(c){ if(!c.got&&Math.hypot(q.x-c.x,q.y-c.y)<c.r+1.2){ c.got=true; gs.gotCount++; sfx.coin(); gs.sparks.push({x:c.x,y:c.y,t0:gs.clock}); } });
  if(gs.obs){ var o=gs.obs; if(q.x>o.x-o.w/2-0.4&&q.x<o.x+o.w/2+0.4&&q.y<o.h){ cgFinish('hit',q); return; } }
}
function cgLoop(now){
  var real=Math.min((now-gs.last)/1000,0.05); gs.last=now; gs.clock+=real;
  if(gs.playing){
    var rem=real*(gs.t<0?1:gs.ts);
    while(rem>1e-9&&gs.playing){ var hh=Math.min(rem,0.01); gs.t+=hh; rem-=hh; cgStep(); }
  }
  cgDraw();
  if(gs.playing||gs.clock-gs.endClock<1.4){ gs.raf=requestAnimationFrame(cgLoop); } else gs.raf=0;
}
function cgFinish(kind,q){
  gs.playing=false; gs.ended=true; gs.endClock=gs.clock; $('cg-go').textContent='Launch again';
  var L=gs.lv,fl=gs.fl,tx=gs.tx,hw=L.hw,R=fl.R,err=R-tx,res={ok:false,stars:0,msg:''};
  if(kind==='hit'){
    sfx.bonk(); sfx.lose(); gs.sparks.push({x:q.x,y:q.y,t0:gs.clock,big:1});
    res.msg='Bonk! The car hit the tower, which is '+fmt(gs.obs.x,0)+' m away and '+fmt(gs.obs.h,0)+' m tall. At that distance the car was only '+fmt(q.y,1)+' m high. Launch higher or faster to clear it.';
  } else {
    var ae=Math.abs(err); res.ok=ae<=hw; res.stars=ae<=0.35*hw?3:(ae<=0.7*hw?2:(ae<=hw?1:0));
    gs.sparks.push({x:R,y:0,t0:gs.clock}); sfx.land(res.ok);
    if(res.ok)res.msg='Landed '+fmt(R,1)+' m from the ramp, '+fmt(ae,1)+' m from the centre of the pad.';
    else { sfx.lose(); res.msg=(err<0?'Too short. ':'Too far. ')+'The car landed at '+fmt(R,1)+' m but the pad centre is at '+fmt(tx,1)+' m, so you missed by '+fmt(ae-hw,1)+' m beyond the pad edge.'; }
  }
  var pts=0;
  if(res.ok){
    pts=Math.max(10,res.stars*100+gs.gotCount*30-gs.hints*20-(gs.attempts-1)*10);
    var rec=prog.coaster[gs.i]; if(!rec||res.stars>rec.s||(res.stars===rec.s&&pts>rec.p))prog.coaster[gs.i]={s:res.stars,p:pts};
    saveProg(); renderTop(); renderLevels('coaster','cg-levels',gs.i);
    sfx.win(); fxConfetti(); fxFireworks();
  }
  var h='<h3 class="'+(res.ok?'good':'bad')+'">'+(res.ok?'Smooth landing!':'Not this time')+(res.ok?starRow(res.stars,30):'')+'</h3><p>'+res.msg+'</p>';
  if(res.ok)h+='<p><b>'+pts+' points</b> ('+res.stars+' star'+(res.stars===1?'':'s')+(gs.coins.length?', '+gs.gotCount+' of '+gs.coins.length+' gold stars':'')+(gs.hints?', '+gs.hints+' hint'+(gs.hints>1?'s':''):'')+').</p>';
  h+='<p class="mono">Flight time '+fmt(fl.T)+' s · range '+fmt(R,1)+' m · peak '+fmt(fl.H,1)+' m</p><div class="btnrow">';
  if(res.ok&&gs.i<NL-1)h+='<button class="btn primary" type="button" data-act="next">Next level</button>';
  if(res.ok&&gs.i===NL-1)h+='<button class="btn primary" type="button" data-go="menu">Back to the park map</button>';
  h+='<button class="btn" type="button" data-act="again">Adjust and try again</button><button class="btn" type="button" data-act="lab">Check it in the lab</button></div>';
  $('cg-result').innerHTML=h;
  if(!gs.raf)gs.raf=requestAnimationFrame(cgLoop);
}
function cgToLab(){
  var p=gs.launched&&gs.pL?gs.pL:{v:gs.F.v.get(),th:gs.F.th.get()}, L=gs.lv;
  cf.v0.set(p.v,true); cf.th.set(p.th,true); cf.h0.set(L.h0,true); cf.g.set(L.g,true); coasterCompute(); coasterReport(); coasterReset(); go('coaster-lab');
}
$('cg-go').addEventListener('click',cgLaunch);
$('cg-lab').addEventListener('click',function(){ sfx.click(); cgToLab(); });
$('cg-levels').addEventListener('click',function(e){ var b=e.target.closest('button[data-lv]'); if(!b||b.disabled)return; sfx.click(); cgLoad(+b.getAttribute('data-lv')); });
$('cg-result').addEventListener('click',function(e){
  var b=e.target.closest('[data-act]'); if(!b)return; var a=b.getAttribute('data-act'); sfx.click();
  if(a==='next')cgLoad(gs.i+1); else if(a==='lab')cgToLab(); else if(a==='again'){ gs.launched=false; gs.ended=false; gs.t=-0.9; $('cg-go').textContent='Launch!'; $('cg-result').innerHTML='<p>Change the angle or speed, then launch again.</p>'; cgDraw(); }
});
$('cg-hint').addEventListener('click',function(){
  if(!gs.lv||gs.playing)return; sfx.click();
  var L=gs.lv,th=gs.F.th.get(); function R(v){ return flightOf(L.g,L.h0,v,th).R; }
  var hi=L.vmax*3; if(R(hi)<gs.tx){ $('cg-hintbox').textContent='At '+fmt(th,1)+'° no speed reaches the pad. Try a higher angle, or a lower one if you launch from high up.'; return; }
  var lo=0.1; for(var i=0;i<60;i++){ var mid=(lo+hi)/2; if(R(mid)<gs.tx)lo=mid; else hi=mid; }
  gs.hints++; var need=(lo+hi)/2;
  $('cg-hintbox').textContent='At '+fmt(th,1)+'° you need about '+fmt(need,1)+' m/s to hit the pad centre'+(need>L.vmax?' (more than this level allows, so change the angle)':'')+(gs.obs?', ignoring the tower':'')+'. It comes from solving R = vₓ·t for v₀.';
});
var cvg=$('cg-canvas');
function cgAim(e){
  if(!gs.lv)return; var r=cvg.getBoundingClientRect(), px=e.clientX-r.left, py=e.clientY-r.top, G=cgGeom(cvg._w,cvg._h), L=gs.lv;
  var dx=px-G.sx(0), dy=G.sy(L.h0)-py, ang=Math.atan2(dy,Math.max(dx,0.001))/D2R, len=Math.hypot(dx,dy);
  gs.F.th.set(Math.round(clamp(ang,-10,80)*2)/2,true); gs.F.v.set(Math.round(clamp(len/(0.30*cvg._w)*L.vmax,1,L.vmax)*10)/10);
}
cvg.addEventListener('pointerdown',function(e){ if(gs.playing)return; audioInit(); gs.drag=true; try{cvg.setPointerCapture(e.pointerId);}catch(x){} cgAim(e); });
cvg.addEventListener('pointermove',function(e){ if(gs.drag&&!gs.playing)cgAim(e); });
['pointerup','pointercancel'].forEach(function(ev){ cvg.addEventListener(ev,function(){gs.drag=false;}); });

/* ================= BUMPER GAME ================= */
var CAR_L=1.8, CAR_W=1.2;
var BL=[
  {name:'Gentle Nudge',m1:200,m2:200,v2:0,e:1,mu:0.3,xA:3,xB:9,a2:0,gh:1.4,ref:{v:6,m:200,a:0},lock:{m:1,a:1},vmax:12,blurb:'Equal masses and a perfectly bouncy hit: car A stops dead and car B takes all of its speed. Floor friction then slows B to a stop.'},
  {name:'Heavy Pusher',m1:300,m2:120,v2:0,e:0.8,mu:0.35,xA:3,xB:9,a2:0,gh:1.3,ref:{v:5,m:300,a:0},lock:{m:1,a:1},vmax:12,blurb:'A heavy car hitting a light one hands over more than its own speed. Work out how fast B leaves the crash.'},
  {name:'Sticky Situation',m1:220,m2:160,v2:0,e:0,mu:0.3,xA:3,xB:10,a2:0,gh:1.2,ref:{v:9,m:220,a:0},lock:{m:1,a:1},vmax:12,blurb:'These cars stick together (e = 0), so they leave the hit as one lump. Momentum is shared out by mass.'},
  {name:'Pick Your Pony',m1:250,m2:150,v2:0,e:0.6,mu:0.3,xA:3,xB:10,a2:0,gh:1.1,ref:{v:6,m:250,a:0},lock:{a:1},vmax:12,mmin:80,mmax:400,blurb:'You can now choose car A\'s mass as well as its speed. Heavier cars push B harder at the same speed.'},
  {name:'Head-On Rush',m1:260,m2:140,v2:-3,e:0.7,mu:0.5,xA:2,xB:14,a2:0,gh:1.0,ref:{v:5,m:260,a:0},lock:{a:1},vmax:12,mmin:100,mmax:400,blurb:'Car B is already rolling toward you at 3 m/s. You have to stop it and send it back to the parking bay on the right.'},
  {name:'Spin Doctor',m1:240,m2:180,v2:0,e:0.7,mu:0.3,xA:3,xB:9,a2:-0.4,gh:0.9,ref:{v:6,m:240,a:0.3},lock:{m:1},vmax:12,amin:-0.5,amax:0.5,blurb:'The bumpers meet off centre, so some of the crash goes into spinning the cars. Moving the hit point changes how much speed B gets.'}
];
var bgs={i:0,lv:null,F:{},gx:15,p:null,o:null,A:null,B:null,t:0,hit:false,playing:false,launched:false,ended:false,raf:0,last:0,clock:0,endClock:-9,flashAt:-9,trail:[],sparks:[],attempts:0,hints:0,ts:1,drag:false,acc:0,wall:false,trailT:0};
bgs.F.v=makeField($('bg-fields'),{id:'bg-v',label:'Speed v<sub>A</sub> (right is +)',unit:'m/s',min:0.5,max:12,step:0.1,value:5},bgChanged);
bgs.F.m=makeField($('bg-fields'),{id:'bg-m',label:'Mass m<sub>A</sub>',unit:'kg',min:80,max:400,step:5,value:200},bgChanged);
bgs.F.a=makeField($('bg-fields'),{id:'bg-a',label:'Hit point from centre',unit:'m',min:-0.5,max:0.5,step:0.05,value:0},bgChanged);

function bOutcome(L,v1,m1,a1){
  var m2=L.m2,a2=L.a2,K=(CAR_L*CAR_L+CAR_W*CAR_W)/12,I1=m1*K,I2=m2*K,vc=v1-L.v2,dec=L.mu*9.81;
  var o={I1:I1,I2:I2,collide:vc>1e-9,dec:dec};
  function slide(x,v){ return x+(v>0?1:-1)*v*v/(2*dec); }
  if(!o.collide){ o.J=0;o.v1p=v1;o.v2p=L.v2;o.w1=0;o.w2=0;o.tc=Infinity;o.xBc=L.xB;o.xAc=L.xA;o.xAf=L.xA;o.xBf=L.xB;o.P0=m1*v1+m2*L.v2;o.P1=o.P0;o.den=0; return o; }
  var den=1/m1+1/m2+a1*a1/I1+a2*a2/I2, J=(1+L.e)*vc/den;
  o.J=J;o.den=den;o.v1p=v1-J/m1;o.v2p=L.v2+J/m2;o.w1=a1*J/I1;o.w2=-a2*J/I2;
  o.tc=((L.xB-L.xA)-CAR_L)/vc; o.xAc=L.xA+v1*o.tc; o.xBc=L.xB+L.v2*o.tc;
  o.xAf=slide(o.xAc,o.v1p); o.xBf=slide(o.xBc,o.v2p);
  o.P0=m1*v1+m2*L.v2; o.P1=m1*o.v1p+m2*o.v2p;
  return o;
}
function bgLoad(i){
  stopAll(); bgs.i=i; var L=BL[i]; bgs.lv=L;
  var ro=bOutcome(L,L.ref.v,L.ref.m,L.ref.a); bgs.gx=Math.round(ro.xBf*2)/2;
  bgs.attempts=0; bgs.hints=0; bgs.sparks=[]; bgs.trail=[]; bgs.launched=false; bgs.ended=false; bgs.res=null;
  bgs.F.v.range(0.5,L.vmax,0.1); bgs.F.v.set(5,true);
  bgs.F.m.range(L.mmin||L.m1,L.mmax||L.m1,5); bgs.F.m.set(L.m1,true); bgs.F.m.lock(!!(L.lock&&L.lock.m));
  bgs.F.a.range(L.amin||0,L.amax||0,0.05); bgs.F.a.set(0,true); bgs.F.a.lock(!!(L.lock&&L.lock.a));
  $('bg-hintbox').textContent=''; $('bg-go').textContent='Crash!'; $('bg-go').disabled=false;
  var facts='<span><b>Bay centre</b>'+fmt(bgs.gx,1)+' m</span><span><b>Bay half-width</b>±'+fmt(L.gh,1)+' m</span><span><b>Car B mass</b>'+fmt(L.m2,0)+' kg</span><span><b>Car B speed</b>'+sgn(L.v2,1)+' m/s</span><span><b>Bounciness e</b>'+fmt(L.e,2)+'</span><span><b>Floor friction μ</b>'+fmt(L.mu,2)+'</span>';
  $('bg-brief').innerHTML='<h3>Level '+(i+1)+' · '+L.name+'</h3><p>'+L.blurb+'</p><div class="facts">'+facts+'</div><p class="note">Park car B with its centre inside the bay for a star. Stop closer to the middle for three. Friction slows a car at μg = '+fmt(L.mu*9.81,2)+' m/s² once the motors cut out at the hit.</p>';
  $('bg-result').innerHTML='<p>Set car A\'s speed and press Crash. You can also drag sideways on the picture to set the speed.</p>';
  $('bgl-g').textContent=fmt(bgs.gx);
  renderLevels('bumper','bg-levels',i); bgInit(); bgDraw();
}
function bgInit(){
  var L=bgs.lv; if(!L)return;
  var p=bgs.p={v:bgs.F.v.get(),m:bgs.F.m.get(),a:bgs.F.a.get()}; bgs.o=bOutcome(L,p.v,p.m,p.a);
  var yA=5-(p.a-L.a2)/2, yB=yA+p.a-L.a2;
  bgs.A={x:L.xA,y:yA,v:p.v,w:0,ang:0,base:0}; bgs.B={x:L.xB,y:yB,v:L.v2,w:0,ang:0,base:Math.PI};
  bgs.t=0; bgs.hit=false; bgs.wall=false; bgs.trail=[]; bgs.acc=0; bgs.flashAt=-9;
  bgs.ts=bgs.o.collide?Math.max(1,bgs.o.tc/2.2):1;
}
function bgChanged(){ if(bgs.playing||!bgs.lv)return; bgs.launched=false; bgs.ended=false; bgInit(); bgDraw(); }
function bgStep(h){
  var L=bgs.lv,A=bgs.A,B=bgs.B,o=bgs.o;
  A.x+=A.v*h; B.x+=B.v*h; A.ang+=A.w*h; B.ang+=B.w*h; bgs.t+=h;
  if(!bgs.hit&&(B.x-CAR_L/2)-(A.x+CAR_L/2)<=0){
    bgs.hit=true; A.v=o.v1p; B.v=o.v2p; A.w=o.w1; B.w=o.w2; bgs.flashAt=bgs.clock; bgs.hitPt={x:(A.x+B.x)/2,y:(A.y+B.y)/2};
    sfx.crash(); if(Math.abs(o.w1)+Math.abs(o.w2)>0.3)sfx.zap(); fxBurst(FX.w*0.5,FX.h*0.45,24,280,1.2);
  }
  if(bgs.hit){
    [A,B].forEach(function(c){ var s=c.v>0?1:-1,nv=c.v-s*o.dec*h; c.v=(nv*s<0)?0:nv; c.w*=Math.exp(-1.3*h); });
  }
  [A,B].forEach(function(c){ if(c.x-CAR_L/2<0){c.x=CAR_L/2;if(Math.abs(c.v)>0.3)bgs.wall=true;c.v=0;} if(c.x+CAR_L/2>20){c.x=20-CAR_L/2;if(Math.abs(c.v)>0.3)bgs.wall=true;c.v=0;} });
  if(bgs.hit&&Math.abs(A.v)<0.01&&Math.abs(B.v)<0.01&&bgs.t>0.1){ A.v=0;B.v=0; bgFinish(); }
  else if(bgs.t>40){ bgFinish(); }
}
function bgLaunch(){
  if(bgs.playing||!bgs.lv)return; audioInit(); bgInit(); bgs.attempts++; bgs.launched=true; bgs.playing=true; bgs.ended=false; bgs.sparks=[];
  $('bg-go').textContent='Rolling…'; $('bg-result').innerHTML='<p>A is rolling in…</p>';
  bgs.last=performance.now(); cancelAnimationFrame(bgs.raf); bgs.raf=requestAnimationFrame(bgLoop);
}
function bgLoop(now){
  var real=Math.min((now-bgs.last)/1000,0.05); bgs.last=now; bgs.clock+=real;
  if(bgs.playing){
    var rem=real*(bgs.hit?1:bgs.ts); bgs.acc+=rem;
    while(bgs.acc>=1/120&&bgs.playing){ bgs.acc-=1/120; bgStep(1/120); }
    bgs.trailT+=real; if(bgs.hit&&bgs.trailT>0.04){ bgs.trailT=0; [bgs.A,bgs.B].forEach(function(c,ix){ if(Math.abs(c.v)>0.4)bgs.trail.push({x:c.x-Math.sign(c.v)*0.8,y:c.y+(Math.random()-0.5)*0.5,t0:bgs.clock,ci:ix}); }); }
  }
  bgDraw();
  if(bgs.playing||bgs.clock-bgs.endClock<1.4){ bgs.raf=requestAnimationFrame(bgLoop); } else bgs.raf=0;
}
function bgFinish(){
  bgs.playing=false; bgs.ended=true; bgs.endClock=bgs.clock; $('bg-go').textContent='Crash again';
  var L=bgs.lv,o=bgs.o,B=bgs.B,err=B.x-bgs.gx,ae=Math.abs(err),res={ok:ae<=L.gh,stars:0};
  res.stars=ae<=0.3*L.gh?3:(ae<=0.65*L.gh?2:(ae<=L.gh?1:0));
  bgs.sparks.push({x:B.x,y:B.y,t0:bgs.clock});
  var pts=0,msg;
  if(res.ok){
    pts=Math.max(10,res.stars*100-bgs.hints*20-(bgs.attempts-1)*10);
    var rec=prog.bumper[bgs.i]; if(!rec||res.stars>rec.s||(res.stars===rec.s&&pts>rec.p))prog.bumper[bgs.i]={s:res.stars,p:pts};
    saveProg(); renderTop(); renderLevels('bumper','bg-levels',bgs.i); sfx.win(); fxConfetti(); fxFireworks();
    msg='Car B stopped at '+fmt(B.x,1)+' m, only '+fmt(ae,1)+' m from the middle of the bay.';
  } else {
    sfx.lose();
    msg=bgs.wall&&B.x>18?'Car B slammed into the wall at '+fmt(B.x,1)+' m. Hit it softer.':('Car B stopped at '+fmt(B.x,1)+' m. The bay centre is at '+fmt(bgs.gx,1)+' m, so it '+(err<0?'stopped short':'rolled too far')+' by '+fmt(ae-L.gh,1)+' m beyond the bay edge.');
  }
  var h='<h3 class="'+(res.ok?'good':'bad')+'">'+(res.ok?'Perfect parking!':'Not in the bay')+(res.ok?starRow(res.stars,30):'')+'</h3><p>'+msg+'</p>';
  if(res.ok)h+='<p><b>'+pts+' points</b> ('+res.stars+' star'+(res.stars===1?'':'s')+(bgs.hints?', '+bgs.hints+' hint'+(bgs.hints>1?'s':''):'')+').</p>';
  if(o.collide)h+='<p class="mono">Impulse '+fmt(o.J,1)+' N·s · B left the hit at '+sgn(o.v2p)+' m/s · momentum before '+fmt(o.P0,1)+', after '+fmt(o.P1,1)+' kg·m/s</p>';
  h+='<div class="btnrow">';
  if(res.ok&&bgs.i<NL-1)h+='<button class="btn primary" type="button" data-act="next">Next level</button>';
  if(res.ok&&bgs.i===NL-1)h+='<button class="btn primary" type="button" data-go="menu">Back to the park map</button>';
  h+='<button class="btn" type="button" data-act="again">Adjust and try again</button><button class="btn" type="button" data-act="lab">Check it in the lab</button></div>';
  $('bg-result').innerHTML=h;
  if(!bgs.raf)bgs.raf=requestAnimationFrame(bgLoop);
}
function bgDraw(){
  var cv=$('bg-canvas'); if(!cv||$('s-bumper-play').hidden||!bgs.lv||!bgs.A)return;
  var b=fit(cv,0.5,220,430); if(!b)return;
  var ctx=b.ctx,w=b.w,h=b.h,P=pal(),s=Math.min(w/20,h/10),ox=(w-20*s)/2,oy=(h-10*s)/2,L=bgs.lv;
  function sx(x){return ox+x*s;} function sy(y){return oy+(10-y)*s;}
  ctx.save();
  var sh=Math.max(0,0.35-(bgs.clock-bgs.flashAt)); if(sh>0&&bgs.launched)ctx.translate((Math.random()-0.5)*sh*16,(Math.random()-0.5)*sh*16);
  drawArena(ctx,P,w,h,s,ox,oy);
  /* ruler */
  ctx.fillStyle=P.ink; ctx.strokeStyle=P.ink; ctx.lineWidth=1.2; ctx.font='10px "DM Mono",monospace'; ctx.textAlign='center';
  for(var m=0;m<=20;m+=2){ line(ctx,sx(m),oy+10*s-8,sx(m),oy+10*s-2); if(m%4===0)ctx.fillText(String(m),sx(m),oy+10*s-11); }
  /* bay */
  var yB=bgs.B.y, bx0=sx(bgs.gx-L.gh), bx1=sx(bgs.gx+L.gh), by0=sy(yB+1.5), by1=sy(yB-1.5);
  ctx.fillStyle=P.butter; ctx.globalAlpha=0.35; ctx.fillRect(bx0,by0,bx1-bx0,by1-by0); ctx.globalAlpha=1;
  ctx.strokeStyle=P.ink; ctx.lineWidth=2.5; ctx.setLineDash([8,6]); ctx.strokeRect(bx0,by0,bx1-bx0,by1-by0); ctx.setLineDash([]);
  ctx.fillStyle=P.pink; var sw=(bx1-bx0)/6; for(var k=0;k<6;k+=2){ ctx.fillRect(bx0+k*sw,by0,sw,5); ctx.fillRect(bx0+(k+1)*sw,by1-5,sw,5); }
  line(ctx,sx(bgs.gx),by0,sx(bgs.gx),by1);
  ctx.fillStyle=P.ink; ctx.font='700 11px "Nunito",sans-serif'; ctx.fillText('PARK B HERE',sx(bgs.gx),by0-6);
  /* trail */
  bgs.trail=bgs.trail.filter(function(t){return bgs.clock-t.t0<0.8;});
  bgs.trail.forEach(function(t){ var u=(bgs.clock-t.t0)/0.8; ctx.globalAlpha=1-u; ctx.fillStyle=t.ci?P.mint:P.pink; star4(ctx,sx(t.x),sy(t.y),5*(1-u)+2); }); ctx.globalAlpha=1;
  /* cars */
  var cars=[bgs.A,bgs.B], dims=[P.pink,P.mint], lab=['A','B'];
  cars.forEach(function(c,i){
    drawBumperCar(ctx,P,{px:sx(c.x),py:sy(c.y),ang:c.ang,base:c.base},CAR_L*s,CAR_W*s,dims[i],lab[i]);
    if(Math.abs(c.w)>0.05){ ctx.fillStyle=P.ink; ctx.font='600 11px "DM Mono",monospace'; ctx.textAlign='center'; ctx.fillText((c.w>0?'↺ ':'↻ ')+fmt(Math.abs(c.w),1)+' rad/s',sx(c.x),sy(c.y)+CAR_W*s*0.5+30); }
  });
  /* arrows */
  var tipY=sy(bgs.A.y)-CAR_W*s*0.5-14;
  if(!bgs.launched){
    var len=bgs.F.v.get()*0.8*s, x0=sx(bgs.A.x+CAR_L/2); arrow(ctx,x0,sy(bgs.A.y),x0+len,sy(bgs.A.y),P.accent,5);
    ctx.fillStyle=P.ink; ctx.font='600 12px "DM Mono",monospace'; ctx.textAlign='center'; ctx.fillText('v = '+fmt(bgs.F.v.get(),1)+' m/s',sx(bgs.A.x),sy(bgs.A.y)-CAR_W*s*0.5-12);
  } else {
    cars.forEach(function(c){ var k=clamp(Math.abs(c.v)*7,0,90),ty=sy(c.y)-CAR_W*s*0.5-14; if(Math.abs(c.v)>0.05){ arrow(ctx,sx(c.x),ty,sx(c.x)+Math.sign(c.v)*k,ty,P.ink,2.5); } });
  }
  /* flash + sparks */
  var fa=bgs.clock-bgs.flashAt; if(bgs.hitPt&&fa>=0&&fa<0.8){ var u2=fa/0.8; ctx.globalAlpha=1-u2; ctx.fillStyle=P.butter; star4(ctx,sx(bgs.hitPt.x),sy(bgs.hitPt.y),14+u2*30); ctx.fillStyle=P.pink; star4(ctx,sx(bgs.hitPt.x),sy(bgs.hitPt.y),8+u2*14); ctx.globalAlpha=1; }
  var cols=[P.pink,P.butter,P.mint,P.sky,P.lilac,P.pink,P.butter,P.mint];
  bgs.sparks=bgs.sparks.filter(function(sp){return bgs.clock-sp.t0<1.2;});
  bgs.sparks.forEach(function(sp){ var u=(bgs.clock-sp.t0)/1.2; ctx.globalAlpha=1-u; for(var q=0;q<8;q++){ var aa=TAU*q/8,rad=10+u*40; ctx.fillStyle=cols[q]; star4(ctx,sx(sp.x)+Math.cos(aa)*rad,sy(sp.y)+Math.sin(aa)*rad,5+4*(1-u)); } ctx.globalAlpha=1; });
  ctx.restore();
  $('bgl-t').textContent=fmt(bgs.launched?bgs.t:0); $('bgl-va').textContent=sgn(bgs.A.v); $('bgl-vb').textContent=sgn(bgs.B.v); $('bgl-x').textContent=fmt(bgs.B.x);
}
$('bg-go').addEventListener('click',bgLaunch);
$('bg-levels').addEventListener('click',function(e){ var b=e.target.closest('button[data-lv]'); if(!b||b.disabled)return; sfx.click(); bgLoad(+b.getAttribute('data-lv')); });
$('bg-result').addEventListener('click',function(e){
  var b=e.target.closest('[data-act]'); if(!b)return; var a=b.getAttribute('data-act'); sfx.click();
  if(a==='next')bgLoad(bgs.i+1); else if(a==='lab')bgToLab(); else if(a==='again'){ bgs.launched=false; bgs.ended=false; bgInit(); $('bg-go').textContent='Crash!'; $('bg-result').innerHTML='<p>Change the speed, then crash again.</p>'; bgDraw(); }
});
$('bg-lab').addEventListener('click',function(){ sfx.click(); bgToLab(); });
function bgToLab(){
  var L=bgs.lv,p={v:bgs.F.v.get(),m:bgs.F.m.get(),a:bgs.F.a.get()};
  bf.am.set(p.m,true); bf.av.set(p.v,true); bf.aL.set(CAR_L,true); bf.aW.set(CAR_W,true); bf.aa.set(p.a,true);
  bf.bm.set(L.m2,true); bf.bv.set(L.v2,true); bf.bL.set(CAR_L,true); bf.bW.set(CAR_W,true); bf.ba.set(L.a2,true); bf.e.set(L.e,true);
  bumperChanged(); go('bumper-lab');
}
$('bg-hint').addEventListener('click',function(){
  if(!bgs.lv||bgs.playing)return; sfx.click();
  var L=bgs.lv,m=bgs.F.m.get(),a=bgs.F.a.get(),prev=null,found=null,v;
  for(v=0.5;v<=L.vmax+1e-9;v+=0.05){ var f=bOutcome(L,v,m,a).xBf-bgs.gx; if(prev!==null&&prev.f*f<=0){ var lo=prev.v,hi=v; for(var i=0;i<40;i++){ var mid=(lo+hi)/2; if((bOutcome(L,lo,m,a).xBf-bgs.gx)*(bOutcome(L,mid,m,a).xBf-bgs.gx)<=0)hi=mid; else lo=mid; } found=(lo+hi)/2; break; } prev={v:v,f:f}; }
  if(found===null){ $('bg-hintbox').textContent='No speed works with these settings. Try a different mass or hit point.'; return; }
  bgs.hints++; $('bg-hintbox').textContent='With m = '+fmt(m,0)+' kg and the hit point at '+fmt(a,2)+' m, a speed of about '+fmt(found,1)+' m/s parks B in the middle of the bay. It comes from J, then v_B′ = v_B + J/m_B, then d = v²/(2μg).';
});
var cvb=$('bg-canvas');
function bgAim(e){
  if(!bgs.lv)return; var r=cvb.getBoundingClientRect(), px=e.clientX-r.left, s=Math.min(cvb._w/20,cvb._h/10), ox=(cvb._w-20*s)/2;
  var x0=ox+(bgs.A.x+CAR_L/2)*s; bgs.F.v.set(Math.round(clamp((px-x0)/(0.8*s),0.5,bgs.lv.vmax)*10)/10);
}
cvb.addEventListener('pointerdown',function(e){ if(bgs.playing)return; audioInit(); bgs.drag=true; try{cvb.setPointerCapture(e.pointerId);}catch(x){} bgAim(e); });
cvb.addEventListener('pointermove',function(e){ if(bgs.drag&&!bgs.playing)bgAim(e); });
['pointerup','pointercancel'].forEach(function(ev){ cvb.addEventListener(ev,function(){bgs.drag=false;}); });

/* ================= boot ================= */
function redrawAll(){ drawCoaster(); drawBumper(); cgDraw(); bgDraw(); }
coasterCompute(); coasterReport(); cs.t=-cs.tLead;
bumperCompute(); bumperReport(); bumperInit();
if('ResizeObserver' in window){ var ro=new ResizeObserver(function(){ redrawAll(); }); ['coaster-wrap','bumper-wrap','cg-wrap','bg-wrap'].forEach(function(id){ ro.observe($(id)); }); }
window.addEventListener('resize',function(){ fxResize(); redrawAll(); });
function themeChanged(){ fxPal(); if(FX.reduced)fxDraw(0); redrawAll(); }
try{ window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',themeChanged); }catch(e){}
try{ new MutationObserver(themeChanged).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']}); }catch(e){}
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(redrawAll);
fxResize();
if(!FX.reduced){ FX.last=performance.now(); FX.raf=requestAnimationFrame(fxLoop); }
go((location.hash||'').replace('#','')||'menu');
renderTop();
})();
