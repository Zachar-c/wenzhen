/* Wenzhen M1: self-contained offline mode. No dependency on legacy primeval-essence engine. */
"use strict";
const GU=[
["B101","引锋蛊","百兵","攻","造成4伤害；破绽下额外2",8,2],["B102","守柄蛊","百兵","防","敌方宣告时获得3护盾",10,0],["B103","试刃蛊","百兵","标","8 tick破绽+2；对野猪破甲6 tick",12,1],
["Y101","藏晖蛊","晦明","攻","微光下造成3伤害；遮灯期间+1",8,2],["Y102","投影蛊","晦明","防","有光敌方宣告时规避最多4伤害",12,0],["Y103","遮灯蛊","晦明","辅","遮灯6 tick；藏晖+1、承伤-1",12,0],
["S101","含芽蛊","玄牝","攻","造成2伤害，后续+2/+4 tick各1根刺",8,2],["S102","守根蛊","玄牝","防","护盾低于2时获得3护盾，持续10",10,0],["S103","引露蛊","玄牝","疗","恢复3生命；满血时给予2护盾",12,0],
["Z101","识主蛊","执枢","标","标记10 tick；直接伤害+1",14,1],["Z102","系令蛊","执枢","攻","识主下伤害3；敌方下一击-2",10,2],["Z103","解扣蛊","执枢","防","命中前1 tick解除系令，减伤2并护盾2",12,0],
["H101","认隙蛊","阖辟","标","8 tick标记；下次定标额外2",12,1],["H102","定标蛊","阖辟","攻","造成3伤害，建立10 tick界标",8,2],["H103","掩扉蛊","阖辟","防","有界标，敌宣告时护盾3；冲撞再减1",10,0],
["T101","试砂蛊","参同","标","10 tick试砂；下次火筹额外2",12,1],["T102","护炉蛊","参同","防","护盾低于2时获得3（有试砂+1），持续10",10,0],["T103","火筹蛊","参同","攻","伤害3并灼烧，后续+2/+4各1",8,2],
["M101","试流蛊","乘物","标","有风时标记8 tick；下次听风+2",12,1],["M102","听风蛊","乘物","攻","有风时造成3伤害",8,2],["M103","踏脉蛊","乘物","防","敌宣告时护盾3；冲撞改规避4",10,0],
["G101","辨兆蛊","观复","察","记录已公开攻击并减伤2",10,0],["G102","听息蛊","观复","防","准确观察时在命中前获得4护盾",10,0],["G103","记痕蛊","观复","反","听息有效吸收后下一tick反击3，重复招式+2",12,0]
].map(([id,name,school,kind,description,cd,first])=>({id,name,school,kind,description,cd,first}));
const GM=Object.fromEntries(GU.map(g=>[g.id,g]));
const SCHOOLS=["百兵","晦明","玄牝","执枢","阖辟","参同","乘物","观复"];
const EXTRA=["T103","B101","B101","T103","B103","B103","T103","B101"];
const FOES=[
{id:"rogue",name:"普通散修",hp:18,armor:0,first:6,period:[8],moves:[{name:"平砍",damage:3,windup:2,type:"normal"}]},
{id:"boar",name:"铁背野猪",hp:24,armor:1,first:5,period:[10],moves:[{name:"铁背冲撞",damage:5,windup:4,type:"charge"}]},
{id:"swordsman",name:"变招刀客",hp:32,armor:0,first:5,period:[9,10],moves:[{name:"直斩",damage:5,windup:3,type:"straight"},{name:"变招",damage:6,windup:4,type:"feint"}]}
];
const STORE_KEY="wenzhen_m1_v1", META_KEY="wenzhen_m1_meta";
const clone=x=>JSON.parse(JSON.stringify(x));
const q=id=>document.getElementById(id);
let state=null,battle=null,timer=null,log=[];
function hash(x){x|=0;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0}
function rand(){state.rng=hash(state.rng||0x6d2b79f5);return state.rng/4294967296}
function makeId(){return "i"+(state.nextId++)}
function owned(id){return {id:makeId(),gu:id}}
function starters(school){return GU.filter(g=>g.school===school).slice(0,3).map(g=>owned(g.id))}
function save(){if(state)localStorage.setItem(STORE_KEY,JSON.stringify(state))}
function init(school){const index=SCHOOLS.indexOf(school),meta=JSON.parse(localStorage.getItem(META_KEY)||'{"runs":0,"wins":0}');state={school,round:0,gold:8,losses:0,seed:((Date.now()^Math.floor(Math.random()*999999))>>>0),rng:1,nextId:1,gu:[],equip:[],shelf:[],free:true,rerolls:0,completed:false,runNo:meta.runs+1};state.rng=state.seed||1;state.gu=starters(school);state.equip=state.gu.map(x=>x.id);meta.runs++;localStorage.setItem(META_KEY,JSON.stringify(meta));beginRound();render()}
function beginRound(){state.round++;state.gold+=5;state.free=true;state.rerolls=0;state.shelf=Array.from({length:4},(_,i)=>state.shelf?.[i]?.lock?state.shelf[i]:offer());if(state.runNo===1&&state.round===1){const x=GU.filter(g=>g.school===state.school);state.shelf=x.map(g=>({id:makeId(),gu:g.id,lock:false}));state.shelf.push({id:makeId(),gu:EXTRA[SCHOOLS.indexOf(state.school)],lock:false})}save()}
function offer(){return {id:makeId(),gu:GU[Math.floor(rand()*GU.length)].id,lock:false}}
function buy(i){let x=state.shelf[i];if(!x||state.gold<4||state.gu.length>=12)return;state.gold-=4;state.gu.push(owned(x.gu));state.shelf[i]=null;save();render()}
function sell(id){const x=state.gu.find(z=>z.id===id);if(!x)return;state.equip=state.equip.filter(z=>z!==id);state.gu=state.gu.filter(z=>z.id!==id);state.gold+=2;save();render()}
function equip(id){if(state.equip.includes(id))state.equip=state.equip.filter(z=>z!==id);else if(state.equip.length<5)state.equip.push(id);save();render()}
function lock(i){const x=state.shelf[i];if(!x)return;if(!x.lock&&state.shelf.filter(z=>z&&z.lock).length>=2)return;x.lock=!x.lock;save();render()}
function reroll(){let cost=state.free?0:Math.min(4,state.rerolls+2);if(state.gold<cost)return;state.gold-=cost;if(state.free)state.free=false;else state.rerolls++;state.shelf=state.shelf.map(x=>x&&x.lock?x:offer());save();render()}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function guCard(inst){const g=GM[inst.gu];return '<div class="slot"><b>'+esc(g.name)+'</b> <span class="chip">'+g.kind+'</span><div class="meta">'+esc(g.description)+' · 冷却'+g.cd+' tick</div><button onclick="equip(\''+inst.id+'\')">'+(state.equip.includes(inst.id)?"卸下":"装备")+'</button><button onclick="sell(\''+inst.id+'\')">出售 +2</button></div>'}
function render(){if(!state){const data=localStorage.getItem(STORE_KEY);if(data){try{state=JSON.parse(data)}catch{localStorage.removeItem(STORE_KEY)}}}
q("status").innerHTML=state?'<span class="chip">第'+state.round+'/3轮</span> <span class="chip gold">'+state.gold+' 金币</span> <span class="chip">败北 '+state.losses+'/3</span>':'<span class="chip">独立 M1 存档</span>';
if(!state){q("app").innerHTML='<h2>择一道途，踏入三场试炼</h2><p>每道三只起始蛊；自行购买、换装，再观察蛊组自动交战。</p><div class="grid">'+SCHOOLS.map(s=>'<div class="card"><h2>'+s+'</h2><div class="meta">'+GU.filter(g=>g.school===s).map(g=>g.name).join(' · ')+'</div><button class="primary" onclick="init(\''+s+'\')">选择道途</button></div>').join('')+'</div>';return}
if(state.completed){q("app").innerHTML='<section class="panel"><h2>M1 阶段结算</h2><p>完成 '+state.round+' 场试炼，失败 '+state.losses+' 次。此处为第一阶段结算，并非全15轮通关。</p><button class="primary" onclick="restart()">新的一局</button></section>';return}
if(battle){renderBattle();return}if(state.inBattle){startBattle();return}
let cost=state.free?0:Math.min(4,state.rerolls+2);
q("app").innerHTML='<h2>第'+state.round+'轮 · 整备与交易</h2><p>下一战：'+FOES[state.round-1].name+' · 首阶段生命30 · 已出战负载 '+state.equip.length+'/5 · 蛊仓 '+state.gu.length+'/12</p><div class="shell"><div><section class="panel"><h3>四槽货架</h3><div class="grid">'+state.shelf.map((x,i)=>!x?'<div class="card shopitem placeholder">已售出</div>':'<div class="card shopitem"><div class="name">'+GM[x.gu].name+'</div><div class="meta">'+GM[x.gu].description+'</div><div class="gold">价格 4</div><div class="actions"><button onclick="buy('+i+')" '+(state.gold<4||state.gu.length>=12?'disabled':'')+'>购买</button><button onclick="lock('+i+')">'+(x.lock?'已锁定 · 解锁':'锁定')+'</button></div></div>').join('')+'</div><div class="actions"><button onclick="reroll()" '+(state.gold<cost?'disabled':'')+'>刷新货架 · '+(cost?'金币 '+cost:'免费')+'</button><span class="chip">跨轮最多锁定2件</span></div></section><section class="panel"><h3>蛊仓与出战</h3>'+state.gu.map(guCard).join('')+'</section></div><div><section class="panel"><h3>当前蛊组</h3>'+state.equip.map(id=>'<div class="slot">'+esc(GM[state.gu.find(g=>g.id===id).gu].name)+'</div>').join('')+'<p>技能按实际条件自动触发；同名蛊独立冷却。</p><button class="primary" onclick="startBattle()">迎战 '+FOES[state.round-1].name+'</button></section><section class="panel"><h3>经营规则</h3><p>一转售价4，出售返2；每轮收入5；免费首刷，付费2/3/4/4…；最多12实例，负载5。</p><button onclick="restart()">放弃并重开</button></section></div></div>'}
function restart(){if(!confirm('放弃现有 M1 进度并重新开局？'))return;clearInterval(timer);timer=null;battle=null;state=null;localStorage.removeItem(STORE_KEY);render()}
function has(type,source){return battle.states.some(s=>s.type===type&&(!source||s.source===source)&&s.until>battle.tick)}
function get(type,source){return battle.states.find(s=>s.type===type&&(!source||s.source===source)&&s.until>battle.tick)}
function mark(type,source,duration,value=0,extra={}){battle.states=battle.states.filter(s=>!(s.type===type&&s.source===source));battle.states.push({type,source,at:battle.tick,until:battle.tick+duration,value,...extra});push("状态 "+type+" ("+duration+" tick)")}
function shield(source,value,until){const available=12-battle.shields.reduce((a,s)=>a+s.value,0);const v=Math.max(0,Math.min(value,available));if(v){battle.shields.push({source,value:v,until,seq:battle.seq++});push("护盾 +"+v+" ["+GM[source.split(':')[0]]?.name||source+"]")}return v}
function push(s){log.push('['+battle.tick+'] '+s);if(log.length>400)log.shift()}
function fresh(){return battle.instances.filter(x=>x.ready<=battle.tick&&x.first<=battle.tick).sort((a,b)=>a.slot-b.slot)}
function cast(x){x.ready=battle.tick+x.cd;push(GM[x.gu].name+" 触发")}
function environmentWind(){return battle.foe.id!=="swordsman"||battle.tick%18<12}
function direct(value,source,opts={}){if(battle.foe.hp<=0)return;let dmg=value;const target=has("weak")&&opts.consumeWeak!==false?get("weak"):null;if(target){dmg+=2;battle.states=battle.states.filter(s=>s!==target)}if(has("owner")&&!opts.periodic)dmg++;if(opts.bonus)dmg+=opts.bonus;let armor=has("broken")?0:battle.foe.armor;dmg=Math.max(1,dmg-armor);battle.foe.hp=Math.max(0,battle.foe.hp-dmg);push(source+" → "+battle.foe.name+" -"+dmg+" (剩余"+battle.foe.hp+")")}
function hitQueued(e){let value=Math.max(0,e.damage),sources={};if(e.type==="charge"&&has("gate"))value=Math.max(0,value-1);if(has("bind")){value=Math.max(0,value-2);battle.states=battle.states.filter(s=>s.type!=="bind")};if(e.reduction)value=Math.max(0,value-e.reduction);if(e.evade)value=Math.max(0,value-e.evade);const shade=get("shade");if(shade&&!shade.used){value=Math.max(0,value-1);shade.used=true}
battle.shields.sort((a,b)=>a.seq-b.seq);for(const s of battle.shields){const absorb=Math.min(value,s.value);value-=absorb;s.value-=absorb;sources[s.source]=(sources[s.source]||0)+absorb}
battle.shields=battle.shields.filter(s=>s.value>0);battle.hp=Math.max(0,battle.hp-value);push("敌方 "+e.name+" 命中，生命 -"+value+"；剩余 "+battle.hp);
const gs=battle.instances.find(x=>x.gu==="G103"&&x.ready<=battle.tick),heard=Object.entries(sources).filter(([k,v])=>v>0&&k.startsWith("G102:")).length>0;
if(gs&&heard&&e.observed){cast(gs);const bonus=battle.lastConfirmed===e.type?2:0;battle.pending.push({tick:battle.tick+1,type:"counter",damage:3+bonus,source:gs.id})}
if(e.observed)battle.lastConfirmed=e.type;
battle.current=null}
function startBattle(){if(battle||state.equip.length===0)return;state.inBattle=true;save();const foe=clone(FOES[state.round-1]);battle={tick:0,hp:30,foe,instances:state.equip.map((id,slot)=>{let g=GM[state.gu.find(x=>x.id===id).gu];return {...g,instance:id,slot,ready:g.first}}),states:[],shields:[],pending:[],current:null,nextDeclare:foe.first,moveIndex:0,lastConfirmed:null,seq:0};log=[];renderBattle();timer=setInterval(()=>{step();renderBattle()},200)}
function observation(e){return e.type!=="feint"||battle.tick>=e.impact-2}
function step(){if(!battle)return;const b=battle,t=b.tick;
b.states=b.states.filter(s=>s.until>t);b.shields=b.shields.filter(s=>s.until>t&&s.value>0);
if(b.current&&b.current.type==="feint"&&t===b.current.impact-2){b.current.revealed=true;push("变招轨迹公开")}
if(!b.current&&t>=b.nextDeclare){let move=b.foe.moves[b.moveIndex%b.foe.moves.length];b.current={...move,impact:t+move.windup,id:"attack"+b.seq++,observed:false,evade:0,reduction:0,revealed:move.type!=="feint"};push("敌方宣告："+move.name+"，"+move.windup+" tick后命中");b.moveIndex++;b.nextDeclare=t+b.foe.period[(b.moveIndex-1)%b.foe.period.length]}
const enemy=b.current;
for(const x of fresh().filter(x=>["B103","Z101","H101","T101","M101","G101"].includes(x.gu))){switch(x.gu){
case"B103":if(!has("weak",x.instance)){cast(x);mark("weak",x.instance,8);if(b.foe.id==="boar")mark("broken",x.instance,6)}break;
case"Z101":if(!has("owner",x.instance)){cast(x);mark("owner",x.instance,10)}break;
case"H101":if(!has("gap",x.instance)){cast(x);mark("gap",x.instance,8)}break;
case"T101":if(!has("sand",x.instance)){cast(x);mark("sand",x.instance,10)}break;
case"M101":if(environmentWind()&&!has("flow",x.instance)){cast(x);mark("flow",x.instance,8)}break;
case"G101":if(enemy&&observation(enemy)&&!enemy.observed){cast(x);enemy.observed=true;enemy.reduction=(enemy.reduction||0)+2;push("辨兆确认："+enemy.name)}break;
}}
for(const x of fresh().filter(x=>["Y103","S102","T102","S103","B102","Y102","H103","M103","Z103","G102"].includes(x.gu))){
switch(x.gu){
case"Y103":if(!has("shade",x.instance)){cast(x);mark("shade",x.instance,6,0,{attackUsed:false,used:false})}break;
case"S102":if(b.shields.reduce((a,s)=>a+s.value,0)<2){cast(x);shield(x.gu+":"+x.instance,3,t+10)}break;
case"T102":if(b.shields.reduce((a,s)=>a+s.value,0)<2){cast(x);shield(x.gu+":"+x.instance,3+(has("sand")?1:0),t+10)}break;
case"S103":if(b.hp<30){cast(x);b.pending.push({tick:t,type:"heal",value:3})}else if(b.shields.reduce((a,s)=>a+s.value,0)<2){cast(x);shield(x.gu+":"+x.instance,2,t+8)}break;
case"B102":if(enemy&&enemy.impact>t&&enemy.impact-enemy.windup===t){cast(x);shield(x.gu+":"+x.instance,3,enemy.impact+1)}break;
case"Y102":if(enemy&&enemy.impact-enemy.windup===t){cast(x);enemy.evade+=4;push("投影预备规避4")}break;
case"H103":if(enemy&&enemy.impact-enemy.windup===t&&has("beacon")){cast(x);shield(x.gu+":"+x.instance,3,enemy.impact+1);if(enemy.type==="charge")mark("gate",x.instance,enemy.windup+1)}break;
case"M103":if(enemy&&enemy.impact-enemy.windup===t){cast(x);if(enemy.type==="charge")enemy.evade+=4;else shield(x.gu+":"+x.instance,3,enemy.impact+1)}break;
case"Z103":if(enemy&&enemy.impact===t+1&&has("bind")){cast(x);b.states=b.states.filter(s=>s.type!=="bind");enemy.reduction+=2;shield(x.gu+":"+x.instance,2,enemy.impact+1)}break;
case"G102":if(enemy&&enemy.impact===t&&enemy.observed){cast(x);shield(x.gu+":"+x.instance,4,t+1)}break;
}}
for(const x of fresh().filter(x=>["B101","Y101","S101","Z102","H102","T103","M102"].includes(x.gu))){let bonus=0;
if(x.gu==="Z102"&&!has("owner"))continue;if(x.gu==="M102"&&!environmentWind())continue;if(x.gu==="Y101"){const shade=get("shade");if(shade&&!shade.attackUsed){bonus=1;shade.attackUsed=true}}
if(x.gu==="H102"){const gap=get("gap");if(gap){bonus=2;b.states=b.states.filter(s=>s!==gap)}}
if(x.gu==="T103"){const sand=get("sand");if(sand){bonus=2;b.states=b.states.filter(s=>s!==sand)}}
if(x.gu==="M102"){const flow=get("flow");if(flow){bonus=2;b.states=b.states.filter(s=>s!==flow)}}
cast(x);direct(({B101:4,Y101:3,S101:2,Z102:3,H102:3,T103:3,M102:3})[x.gu],GM[x.gu].name,{bonus});
if(x.gu==="S101"||x.gu==="T103")mark("dot",x.instance,5,1,{kind:x.gu,next:[t+2,t+4]});
if(x.gu==="Z102")mark("bind",x.instance,8);
if(x.gu==="H102")mark("beacon",x.instance,10);
}
if(t>=2&&(t-2)%6===0)direct(2,"基础攻击");
for(const e of b.pending.filter(x=>x.tick===t&&x.type==="counter"))direct(e.damage,"记痕反击",{consumeWeak:false});
b.pending=b.pending.filter(x=>!(x.tick===t&&x.type==="counter"));
for(const s of [...b.states].filter(x=>x.type==="dot"&&x.next.includes(t))){direct(s.value,s.kind==="S101"?"根刺":"灼烧",{consumeWeak:false,periodic:true});s.next=s.next.filter(n=>n!==t)}
if(b.foe.hp<=0){finish(true);return}
if(enemy&&enemy.impact===t){hitQueued(enemy);if(b.hp<=0){finish(false);return}}
for(const e of b.pending.filter(x=>x.tick===t&&x.type==="heal")){const before=b.hp;b.hp=Math.min(30,b.hp+e.value);push("引露治疗 +"+(b.hp-before))}b.pending=b.pending.filter(x=>!(x.tick===t&&x.type==="heal"));
if(t>=120){finish(false);return}b.tick++}
function finish(won){clearInterval(timer);timer=null;let result={won,tick:battle.tick,hp:battle.hp,foe:battle.foe.name,log:log.slice()};battle=null;state.lastResult=result;state.inBattle=false;state.losses+=won?0:1;if(state.losses>=3||state.round>=3){state.completed=true;const meta=JSON.parse(localStorage.getItem(META_KEY)||'{"runs":0,"wins":0}');if(won&&state.losses<3)meta.wins++;localStorage.setItem(META_KEY,JSON.stringify(meta))}else beginRound();save();render();q("app").insertAdjacentHTML("afterbegin",'<section class="panel"><h3>'+(won?'战斗胜利':'战斗失利')+' · '+esc(result.foe)+'</h3><p>结束 tick '+result.tick+' · 剩余生命 '+result.hp+'</p><details><summary>展开事件日志</summary><pre class="log">'+esc(result.log.join("\n"))+'</pre></details></section>')}
function renderBattle(){const b=battle;if(!b)return;q("app").innerHTML='<h2>第'+state.round+'战 · 自动交锋</h2><div class="shell"><section class="battlefield"><div class="enemy">'+esc(b.foe.name)+'</div><div class="bar"><i style="width:'+Math.max(0,100*b.foe.hp/FOES[state.round-1].hp)+'%"></i></div><p>敌方生命 '+b.foe.hp+'/'+FOES[state.round-1].hp+' · 护甲 '+b.foe.armor+'</p><p class="intent">'+(b.current?esc(b.current.name)+' · 命中倒计时 '+(b.current.impact-b.tick):'观察敌方起手')+'</p><h2>蛊师气血 '+b.hp+'/30</h2><div class="bar"><i style="width:'+100*b.hp/30+'%"></i></div><p>战斗 tick '+b.tick+' / 120</p><div class="grid">'+b.instances.map(x=>'<div class="chip">'+esc(x.name)+' · '+(x.ready<=b.tick?'就绪':x.ready-b.tick+' tick')+'</div>').join('')+'</div><p class="small">每 tick = 0.5秒；战斗采用确定性结算</p></section><section class="panel"><h3>战斗事件</h3><pre class="log" id="log">'+esc(log.slice(-38).join("\n"))+'</pre><div class="actions"><button onclick="quick()">立即结算</button></div></section></div>';let el=q("log");if(el)el.scrollTop=el.scrollHeight}
function quick(){clearInterval(timer);timer=null;let guard=130;while(battle&&guard--)step();if(battle)renderBattle()}
render();