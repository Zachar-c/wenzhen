/* Wenzhen M1: self-contained offline mode. No dependency on legacy primeval-essence engine. */
"use strict";
// M3 is opt-in; M2's default six-fight mechanics and localStorage remain frozen.
const M3_MODE=typeof location!=="undefined"&&new URLSearchParams(location.search).get("m3")==="rank5";
const GU=[
["B101","引锋蛊","百兵","攻","造成4伤害；破绽下额外2",8,2],["B102","守柄蛊","百兵","防","敌方宣告时获得3护盾",10,0],["B103","试刃蛊","百兵","标","8 tick破绽+2；对野猪破甲6 tick",12,1],
["B201","折锋蛊","百兵","攻","兵锋先击4；若仍在交战，2 tick后折返追击3",12,1],
["Y101","藏晖蛊","晦明","攻","微光下造成3伤害；遮灯期间+1",8,2],["Y102","投影蛊","晦明","防","有光敌方宣告时规避最多4伤害",12,0],["Y103","遮灯蛊","晦明","辅","遮灯6 tick；藏晖+1、承伤-1",12,0],
["S101","含芽蛊","玄牝","攻","造成2伤害，后续+2/+4 tick各1根刺",8,2],["S102","守根蛊","玄牝","防","护盾低于2时获得3护盾，持续10",10,0],["S103","引露蛊","玄牝","疗","恢复3生命；满血时给予2护盾",12,0],
["Z101","识主蛊","执枢","标","标记10 tick；直接伤害+1",14,1],["Z102","系令蛊","执枢","攻","识主下伤害3；敌方下一击-2",10,2],["Z103","解扣蛊","执枢","防","命中前1 tick解除系令，减伤2并护盾2",12,0],
["H101","认隙蛊","阖辟","标","8 tick标记；下次定标额外2",12,1],["H102","定标蛊","阖辟","攻","造成3伤害，建立10 tick界标",8,2],["H103","掩扉蛊","阖辟","防","有界标，敌宣告时护盾3；冲撞再减1",10,0],
["T101","试砂蛊","参同","标","10 tick试砂；下次火筹额外2",12,1],["T102","护炉蛊","参同","防","护盾低于2时获得3（有试砂+1），持续10",10,0],["T103","火筹蛊","参同","攻","伤害3并灼烧，后续+2/+4各1",8,2],
["M101","试流蛊","乘物","标","有风时标记8 tick；下次听风+2",12,1],["M102","听风蛊","乘物","攻","有风时造成3伤害",8,2],["M103","踏脉蛊","乘物","防","敌宣告时护盾3；冲撞改规避4",10,0],
["N201","裂势蛊","百兵","攻","敌人蓄势时斩击5；专破蓄势窗口",10,0],["N202","饮锋蛊","玄牝","反","受到实际伤害后积攒血势，下一tick反击（最多6）",10,0],
["G101","辨兆蛊","观复","察","记录已公开攻击并减伤2",10,0],["G102","听息蛊","观复","防","准确观察时在命中前获得4护盾",10,0],["G103","记痕蛊","观复","反","听息有效吸收后下一tick反击3，重复招式+2",12,0],
["G112","知几蛊","观复","攻","敌方连续两次宣告同一招式后，趁真实起手刺击3；变招未明时不发动",12,0],
["G201","重息蛊","观复","防","连续两次确认相同起手后，在命中前凝成8点护盾；首招及变招不成立",10,0],
...(M3_MODE?[
["B202","骨节兵蛊","百兵","材","三转游节兵同转辅蛊，定向供给",99,0],
["B301","游节兵蛊","百兵","攻","首击确实命中，才沿完好关节折角续击",12,1],
["B302","回匣刀蛊","百兵","材","四转百节承锋同转辅蛊，定向供给",99,0],
["B401","百节承锋蛊","百兵","攻","实体刀胚变角，尚存关节能承受一次碎节",12,1],
["B402","归鞘轮兵蛊","百兵","材","五转万节藏锋同转辅蛊，定向供给",99,0],
["B501","万节藏锋蛊","百兵","攻","真实第一击命中与完好关节才可连击至多三段；缴械停机",12,1],
["G202","循痕蛊","观复","材","三转三息观机同转辅蛊，定向供给",99,0],
["G301","三息观机蛊","观复","察","两次真实敌招记录后，在相同起手预备反击",10,0],
["G302","回痕截式蛊","观复","材","四转观微见著同转辅蛊，定向供给",99,0],
["G401","观微见著蛊","观复","察","同招两次真实记录后抢出一次窗口；变招无效",10,0],
["G402","周而复始蛊","观复","材","五转万象观复同转辅蛊，定向供给",99,0],
["G501","万象观复蛊","观复","察","同敌同招两次真实记录，仅精准化解一次可证下一式；变招失效",10,0]
]:[])
].map(([id,name,school,kind,description,cd,first])=>({id,name,school,kind,description,cd,first}));
const GM=Object.fromEntries(GU.map(g=>[g.id,g]));
const SCHOOLS=["百兵","晦明","玄牝","执枢","阖辟","参同","乘物","观复"];
const EXTRA=["T103","B101","B101","T103","B103","B103","T103","B101"];
const FOES=[
{id:"rogue",name:"普通散修",hp:18,armor:0,first:6,period:[8],moves:[{name:"平砍",damage:3,windup:2,type:"normal"}]},
{id:"boar",name:"铁背野猪",hp:24,armor:1,first:5,period:[10],moves:[{name:"铁背冲撞",damage:5,windup:4,type:"charge"}]},
{id:"swordsman",name:"变招刀客",hp:32,armor:0,first:5,period:[9,10],moves:[{name:"直斩",damage:5,windup:3,type:"straight"},{name:"变招",damage:6,windup:4,type:"feint"}]},
{id:"bandit",name:"裂甲悍匪",hp:38,armor:1,first:4,period:[8],moves:[{name:"破盾猛击",damage:6,windup:3,type:"charge"}]},
{id:"shadow",name:"逐影刺客",hp:46,armor:0,first:4,period:[7,9],moves:[{name:"潜刃",damage:7,windup:2,type:"straight"},{name:"残影",damage:4,windup:4,type:"feint"}]},
{id:"warden",name:"镇关铁卫",hp:60,armor:2,first:3,period:[8,10],moves:[{name:"重锤",damage:8,windup:4,type:"charge"},{name:"横扫",damage:6,windup:3,type:"normal"}]},
{id:"rootling",name:"枯根傀儡",hp:54,armor:1,first:5,period:[9],moves:[{name:"腐根鞭打",damage:5,windup:3,type:"normal"}]},
...(M3_MODE?[
{id:"disarmer",name:"卸兵游侠",hp:34,armor:0,first:5,period:[11],moves:[{name:"夺柄",damage:4,windup:4,type:"disarm"}]},
{id:"watcher",name:"回招守卫",hp:42,armor:1,first:7,period:[11],moves:[{name:"守势反斩",damage:5,windup:4,type:"normal"}]},
{id:"jointbeast",name:"裂节铁兽",hp:46,armor:2,first:5,period:[9],moves:[{name:"碎节撞击",damage:5,windup:3,type:"fracture"}]},
{id:"phantom",name:"藏式影客",hp:42,armor:0,first:4,period:[8,9],moves:[{name:"斜刺",damage:5,windup:3,type:"straight"},{name:"假身换位",damage:7,windup:4,type:"feint"}]},
{id:"duelist",name:"双锋执刀者",hp:48,armor:1,first:5,period:[9,11],moves:[{name:"半月斩",damage:5,windup:3,type:"normal"},{name:"回身横斩",damage:6,windup:4,type:"straight"}]},
{id:"stonewall",name:"铁壁持盾将",hp:54,armor:3,first:6,period:[12],moves:[{name:"盾反",damage:5,windup:5,type:"normal"}]},
{id:"breaker",name:"碎锋石魈",hp:58,armor:1,first:5,period:[11,9],moves:[{name:"断鞘",damage:6,windup:4,type:"disarm"},{name:"蹬踏",damage:4,windup:2,type:"normal"}]},
{id:"pulse",name:"七息巡猎者",hp:54,armor:1,first:6,period:[8],moves:[{name:"七息短打",damage:5,windup:3,type:"normal"}]},
{id:"upsetter",name:"乱序换式傀",hp:57,armor:1,first:5,period:[8,9,10],moves:[{name:"右封",damage:5,windup:3,type:"normal"},{name:"藏锋",damage:5,windup:3,type:"feint"},{name:"碎胚",damage:5,windup:4,type:"fracture"}]},
{id:"gatekeeper",name:"守山断律者",hp:66,armor:2,first:5,period:[11,8,10],moves:[{name:"破兵令",damage:6,windup:4,type:"disarm"},{name:"重复镇击",damage:5,windup:4,type:"normal"},{name:"换律奇袭",damage:7,windup:3,type:"feint"}]}
]:[])
];
const STORE_KEY=M3_MODE?"wenzhen_m3_rank5_v1":"wenzhen_m2_v1", META_KEY=M3_MODE?"wenzhen_m3_rank5_meta":"wenzhen_m2_meta";
const TOTAL_ROUNDS=M3_MODE?16:6, CHAPTER_LENGTH=M3_MODE?4:3;

const ENEMY_SPOILS=[
 {foe:"rogue",gu:"B101",clue:"散修袖口露出金铁锋符"},
 {foe:"boar",gu:"S102",clue:"野猪皮下有守根蛊寄生的痕迹"},
 {foe:"swordsman",gu:"Y102",clue:"刀客身后有无法对齐的投影"},
 {foe:"bandit",gu:"T103",clue:"悍匪腰间藏有灼热火筹"},
 {foe:"shadow",gu:"N201",clue:"刺客背囊传出听风之鸣"},
 {foe:"warden",gu:"N202",clue:"铁卫以辨兆蛊洞察来敌"},
{foe:"rootling",gu:"G112",clue:"傀儡核心刻有重复出手的旧式印痕"},
...(M3_MODE?[
{foe:"disarmer",gu:"B103",clue:"缴械令由敌人的真命中触发"},
{foe:"watcher",gu:"G103",clue:"守卫的招式记录可作记痕佐证"},
{foe:"jointbeast",gu:"B202",clue:"破损兽骨留下二转骨节兵"},
{foe:"phantom",gu:"G202",clue:"影客遗留循痕观察记录"},
{foe:"duelist",gu:"B302",clue:"连斩的刀匣可作三转辅材"},
{foe:"stonewall",gu:"G302",clue:"盾上刻录完整的三息招式"},
{foe:"breaker",gu:"B103",clue:"断鞘之术留下试刃蛊"},
{foe:"pulse",gu:"G103",clue:"巡猎者携带记痕蛊"},
{foe:"upsetter",gu:"B402",clue:"乱序傀儡里藏归鞘轮兵"},
{foe:"gatekeeper",gu:"G402",clue:"守山人身藏周而复始四转辅蛊"}
]:[])
];
const HUNTS=M3_MODE?Array.from({length:16},(_,i)=>[i,i+1]):[[0,1],[1,2],[2,1],[3,4],[4,5],[5,6]];
function availableHunts(){return (HUNTS[state.round-1]||[]).filter(i=>!M3_MODE||!(state.pastTargets||[]).includes(i))}
function targetIndex(){const candidates=availableHunts();return Number.isInteger(state.targetIndex)&&candidates.includes(state.targetIndex)?state.targetIndex:(candidates[0]??state.round-1)}
function targetFoe(){return FOES[targetIndex()]}
function chooseTarget(index){
 if(!state||battle||state.inBattle||state.completed||state.pendingSpoils||!availableHunts().includes(index))return false;
 state.targetIndex=index;save();render();return true;
}
function huntBoard(){
 return `<section class="hunt-board"><h3>本轮追猎</h3><div class="hunt-options">${availableHunts().map(i=>{const f=FOES[i],d=ENEMY_SPOILS[i],selected=targetIndex()===i;return `<div class="hunt-card ${selected?'selected':''}"><div class="hunt-copy"><strong>${esc(f.name)}</strong><small>生命 ${f.hp} · 甲 ${f.armor} · 首招 tick ${f.first}</small><p>可追夺的蛊 <b>${esc(GM[d.gu].name)}</b></p>${selected?`<small>${esc(d.clue)}</small>`:`<details class="hunt-clue"><summary>携蛊线索</summary><small>${esc(d.clue)}</small></details>`}</div><button ${selected?'disabled':''} onclick="chooseTarget(${i})">${selected?'已追猎':'追猎此敌'}</button></div>`}).join('')}</div></section>`;
}
function upcomingSpoils(){return ENEMY_SPOILS[M3_MODE&&state.lastTargetIndex!=null?state.lastTargetIndex:targetIndex()]}
function lootPreview(){const d=upcomingSpoils();return '<section class="panel"><h3>可追夺的蛊</h3><b class="gold">'+esc(GM[d.gu].name)+'</b><p>'+esc(d.clue)+'</p><p>战胜敌人才可夺得；夺蛊与变卖均由玩家决定。</p></section>'}
function endRun(){state.completed=true;const meta=JSON.parse(localStorage.getItem(META_KEY)||'{"runs":0,"wins":0}');if(state.lastResult?.won&&state.losses<3)meta.wins++;localStorage.setItem(META_KEY,JSON.stringify(meta))}
function resolveSpoils(choice,replaceId,swapEquipId){
 if(!state||!state.pendingSpoils||battle||state.inBattle||state.completed)return false;
 const d=state.pendingSpoils;
 if(choice==="claim"){
  const full=state.gu.length>=12;
  if(full&&(!replaceId||!state.gu.some(x=>x.id===replaceId)))return false;
  if(swapEquipId&&(!state.equip.includes(swapEquipId)||(full&&replaceId===swapEquipId)))return false;
  if(full){
   state.equip=state.equip.filter(id=>id!==replaceId);
   state.gu=state.gu.filter(x=>x.id!==replaceId);
  }
  const acquired=owned(d.gu);
  state.gu.push(acquired);
  if(swapEquipId){
   state.equip=state.equip.map(id=>id===swapEquipId?acquired.id:id);
  }else if(state.equip.length<5){
   // Explicitly equipped only when requested; claiming is never auto-equip.
  }
 }else if(choice==="sell")state.gold+=2;
 else return false;
 state.pendingSpoils=null;
 if(state.losses>=3||state.round>=TOTAL_ROUNDS)endRun();else beginRound();
 save();render();return true;
}
function renderSpoils(){
 const d=state.pendingSpoils,g=GM[d.gu],full=state.gu.length>=12;
 const replacement=full?'<label>蛊仓已满，夺取时舍弃一只旧蛊：<select id="spoil-replace">'+state.gu.map(x=>'<option value="'+x.id+'">'+esc(GM[x.gu].name)+' · '+x.id+'</option>').join('')+'</select></label>':'';
 const claim=full?"resolveSpoils('claim',q('spoil-replace').value)":"resolveSpoils('claim')";
 const swapButtons=state.equip.map(id=>{const old=state.gu.find(x=>x.id===id),replace=full?"q('spoil-replace').value":"null";return '<button onclick="resolveSpoils(\'claim\','+replace+',\''+id+'\')">夺蛊并替换 '+esc(GM[old.gu].name)+'</button>'}).join('');
 q("app").innerHTML='<section class="panel spoils-panel"><span class="combat-overline">胜者缴获 · '+esc(d.foe)+'</span><h2>夺得 '+esc(g.name)+'</h2><p>'+esc(d.clue)+'</p><div class="slot">'+esc(g.description)+'</div><p>当前蛊仓 '+state.gu.length+'/12；收入后可在下轮自由换装。</p>'+replacement+'<div class="actions"><button class="primary" onclick="'+claim+'">收入蛊仓'+(full?'（舍弃所选旧蛊）':'')+'</button>'+swapButtons+'<button onclick="resolveSpoils('+"'sell'"+')">变卖 +2 金币</button></div></section>';
}

const clone=x=>JSON.parse(JSON.stringify(x));
const q=id=>document.getElementById(id);
let state=null,battle=null,timer=null,log=[];
let inkCombatView=null;
function hash(x){x|=0;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0}
function rand(){state.rng=hash(state.rng||0x6d2b79f5);return state.rng/4294967296}
function makeId(){return "i"+(state.nextId++)}
function owned(id){return {id:makeId(),gu:id}}
function starters(school){return GU.filter(g=>g.school===school).slice(0,3).map(g=>owned(g.id))}
function save(){if(state)localStorage.setItem(STORE_KEY,JSON.stringify(state))}
function init(school){if(!SCHOOLS.includes(school)||(M3_MODE&&!["百兵","观复"].includes(school)))return;const index=SCHOOLS.indexOf(school),meta=JSON.parse(localStorage.getItem(META_KEY)||'{"runs":0,"wins":0}');state={school,round:0,gold:8,losses:0,pastTargets:[],m3StockUsed:false,seed:((Date.now()^Math.floor(Math.random()*999999))>>>0),rng:1,nextId:1,gu:[],equip:[],shelf:[],free:true,rerolls:0,completed:false,runNo:meta.runs+1};state.rng=state.seed||1;state.gu=starters(school);state.equip=state.gu.map(x=>x.id);meta.runs++;localStorage.setItem(META_KEY,JSON.stringify(meta));beginRound();render()}
function beginRound(){state.round++;state.lastTargetIndex=null;state.targetIndex=availableHunts()[0]??state.round-1;state.m3StockUsed=false;state.gold+=5;state.free=true;state.rerolls=0;state.seekUsed=false;if(state.runNo===1&&state.round===1){const x=GU.filter(g=>g.school===state.school).slice(0,3);state.shelf=x.map(g=>({id:makeId(),gu:g.id,lock:false}));state.shelf.push({id:makeId(),gu:EXTRA[SCHOOLS.indexOf(state.school)],lock:false})}else{state.shelf=Array.from({length:4},(_,i)=>state.shelf?.[i]?.lock?state.shelf[i]:offer())}save()}
const M3_RECIPES=[
{id:"B201",inputs:["B101","B102"],label:"引锋蛊＋守柄蛊 → 折锋蛊",note:"两段追击；失去守柄防护"},
{id:"G201",inputs:["G101","G102"],label:"辨兆蛊＋听息蛊 → 重息蛊",note:"重复招式才防护；首招失守"},
...(M3_MODE?[
{id:"B301",inputs:["B201","B202"],label:"折锋＋骨节兵 → 游节兵",note:"首击真命中才折角；缴械停机"},
{id:"B401",inputs:["B301","B302"],label:"游节兵＋回匣刀 → 百节承锋",note:"折角续击能承受一次破节"},
{id:"B501",inputs:["B401","B402"],label:"百节承锋＋归鞘轮兵 → 万节藏锋",note:"最多三段续击；缴械和全断节停机"},
{id:"G301",inputs:["G201","G202"],label:"重息＋循痕 → 三息观机",note:"记录连续两次真实同招后反制"},
{id:"G401",inputs:["G301","G302"],label:"三息观机＋回痕截式 → 观微见著",note:"真实规律换一次反击窗口"},
{id:"G501",inputs:["G401","G402"],label:"观微见著＋周而复始 → 万象观复",note:"同敌同招两次真证，化解一次可见旧式"}
]:[])];
const M3_STOCK=[
{round:4,rank:2,price:4,ids:["B202","G202"]},
{round:8,rank:3,price:6,ids:["B302","G302"]},
{round:12,rank:4,price:8,ids:["B402","G402"]}
];
const M3_ONLY=new Set(["B202","B301","B302","B401","B402","B501","G202","G301","G302","G401","G402","G501"]);
function acquireM3Ingredient(id){
 if(!M3_MODE||!state||battle||state.inBattle||state.completed||state.pendingSpoils||state.m3StockUsed||state.gu.length>=12)return false;
 const contract=M3_STOCK.find(x=>x.ids.includes(id));if(!contract||state.round<contract.round||state.gold<contract.price)return false;
 state.gold-=contract.price;state.gu.push(owned(id));state.m3StockUsed=true;save();render();return true;
}
function m3SupplyPanel(){
 if(!M3_MODE)return "";
 return '<div class="slot m3-supply"><h3>五转逆推 · 定向供给</h3><p>仅验证百兵和观复。第4/8/12轮解锁二/三/四转辅蛊，每轮仅一次定向采购；可以保留旧蛊、改道或逐阶合炼。发行金币绝不沿用Library档案元石价。</p>'+
 M3_STOCK.map(s=>'<div class="slot">第'+s.round+'轮起 · '+s.rank+'转辅蛊 · '+s.price+'金币 '+s.ids.map(id=>'<button onclick="acquireM3Ingredient(\''+id+'\')" '+(state.round<s.round||state.m3StockUsed||state.gold<s.price||state.gu.length>=12?'disabled':'')+'>'+GM[id].name+'</button>').join('')+'</div>').join('')+'</div>';
}

function availableRecipes(){return M3_RECIPES.filter(r=>r.inputs.every(id=>state.gu.some(g=>g.gu===id)))}
function refineGu(recipeId){
 if(!state||battle||state.inBattle||state.pendingSpoils||state.completed)return false;
 const recipe=M3_RECIPES.find(r=>r.id===recipeId);
 if(!recipe||!recipe.inputs.every(id=>state.gu.some(g=>g.gu===id)))return false;
 const used=[];
 for(const id of recipe.inputs){const inst=state.gu.find(g=>g.gu===id&&!used.includes(g.id));if(!inst)return false;used.push(inst.id)}
 state.gu=state.gu.filter(g=>!used.includes(g.id));state.equip=state.equip.filter(id=>!used.includes(id));
 const result=owned(recipe.id);state.gu.push(result);
 if(state.equip.length<5)state.equip.push(result.id);
 save();render();return true;
}
function offer(){const pool=GU.filter(g=>!M3_RECIPES.some(r=>r.id===g.id)&&!M3_ONLY.has(g.id));return {id:makeId(),gu:pool[Math.floor(rand()*pool.length)].id,lock:false}}
/* Merchant sourcing: one named Gu, two coins for the lead, four more for purchase. */
function seekGu(guId){
 if(!state||battle||state.inBattle||state.completed||state.pendingSpoils||state.seekUsed||state.gold<6||state.gu.length>=12||(!Object.prototype.hasOwnProperty.call(GM,guId)||M3_RECIPES.some(r=>r.id===guId)||M3_ONLY.has(guId)))return false;
 const slot=state.shelf.findIndex(x=>x&&!x.lock&&!x.seek);
 if(slot<0)return false;
 state.gold-=2;state.seekUsed=true;
 state.shelf[slot]={id:makeId(),gu:guId,lock:false,seek:true};
 save();render();return true;
}
function buy(i){let x=state.shelf[i];if(!x||state.gold<4||state.gu.length>=12)return;state.gold-=4;state.gu.push(owned(x.gu));state.shelf[i]=null;save();render()}
function sell(id){const x=state.gu.find(z=>z.id===id);if(!x)return;state.equip=state.equip.filter(z=>z!==id);state.gu=state.gu.filter(z=>z.id!==id);state.gold+=2;save();render()}
function equip(id){if(state.equip.includes(id))state.equip=state.equip.filter(z=>z!==id);else if(state.equip.length<5)state.equip.push(id);save();render()}
function lock(i){const x=state.shelf[i];if(!x)return;if(!x.lock&&state.shelf.filter(z=>z&&z.lock).length>=2)return;x.lock=!x.lock;save();render()}
function reroll(){let cost=state.free?0:Math.min(4,state.rerolls+2);if(state.gold<cost)return;state.gold-=cost;if(state.free)state.free=false;else state.rerolls++;state.shelf=state.shelf.map(x=>x&&(x.lock||x.seek)?x:offer());save();render()}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}

const SYNERGY=[
 [["B103","B101"],"试刃→引锋：破绽爆发"],
 [["Y103","Y101"],"遮灯→藏晖：进攻增幅"],
 [["Z101","Z102"],"识主→系令：解锁攻击"],
 [["Z102","Z103"],"系令→解扣：追加防护"],
 [["H101","H102"],"认隙→定标：直接增伤"],
 [["H102","H103"],"定标→掩扉：界标防御"],
 [["T101","T103"],"试砂→火筹：直接增伤"],
 [["M101","M102"],"试流→听风：有风联动"],
 [["G101","G102","G103"],"辨兆→听息→记痕：有效吸收后反击"],
 [["G201","G103"],"重息→记痕：重复招式格挡成功后反击"],
 [["S101","T103"],"含芽+火筹：两路持续伤害"]
];
const FOE_HINTS={rogue:"散修：2 tick 蓄势；伤害3",boar:"野猪：护甲1；冲撞5，破甲和规避各有用途",swordsman:"刀客：变招在命中前2 tick才公开轨迹",bandit:"悍匪：护甲1、猛击频繁",shadow:"刺客：高频直斩与变招",warden:"铁卫：护甲2、高生命，考验持续输出",rootling:"枯根傀儡：每10 tick 回复3生命；火筹灼烧期间再生被抑制"};
const RUNE_GLYPHS={攻:"刃",防:"盾",标:"印",辅:"隐",疗:"生",察:"观",反:"返"};
function equippedGu(){return state.equip.map(id=>state.gu.find(g=>g.id===id)?.gu).filter(Boolean)}
function synergyFor(ids){const set=new Set(ids);return SYNERGY.filter(([required])=>required.every(x=>set.has(x))).map(x=>x[1])}
function buildGuide(){const ids=equippedGu(),active=synergyFor(ids);
return '<div class="build-compact"><strong>攻击 '+ids.filter(x=>GM[x].kind==="攻").length+'</strong><strong>防护/观察 '+ids.filter(x=>["防","疗","察"].includes(GM[x].kind)).length+'</strong><strong>联动 '+active.length+'</strong></div><div class="guide-lines">'+(active.length?active.map(x=>'<p>◆ '+esc(x)+'</p>').join(''):'<p>尚未形成已识别的联动，可在货架补齐。</p>')+'</div><p class="opponent-note">'+esc(FOE_HINTS[targetFoe().id])+'</p>'}
function offerHint(gu){const before=new Set(synergyFor(equippedGu())),next=synergyFor([...equippedGu(),gu]).filter(x=>!before.has(x));const partners=SYNERGY.filter(([ids])=>ids.includes(gu)).flatMap(([ids])=>ids.filter(id=>id!==gu));return '<div class="offer-hint">'+(next.length?'新增联动：'+esc(next[0]):'不新增联动 · 可替换或叠放')+'</div>'+(partners.length?'<small class="requirement">需：'+[...new Set(partners)].map(id=>esc(GM[id].name)).join(' / ')+'</small>':'')}

function battleReport(stats){if(!stats)return '';const best=Object.entries(stats.damageBySource||{}).sort((a,b)=>b[1]-a[1]);return '<div class="battle-report"><div><small>造成伤害</small><strong>'+stats.damageDealt+'</strong></div><div><small>护盾吸收</small><strong>'+stats.shieldAbsorbed+'</strong></div><div><small>实际失血</small><strong>'+stats.damageTaken+'</strong></div><div><small>实际治疗</small><strong>'+stats.healing+'</strong></div></div><p class="report-sources">主要来源：'+(best.slice(0,3).map(([k,v])=>esc(k)+' '+v).join(' / ')||'无')+'</p>'}
// Ink presentation: all resource and combat mutations continue through the existing actions.
const KIND_ICONS={攻:'↗',防:'◇',标:'◎',辅:'◈',疗:'✚',察:'◉',反:'↶'};
function kindLabel(g){return `<span class="type-label"><span aria-hidden="true">${KIND_ICONS[g.kind]||'·'}</span> ${esc(g.kind)}</span>`}
function loadoutPanel(){return `<section class="loadout-panel"><div class="section-heading"><h3>出战阵</h3><small>${state.equip.length} / 5 · 蛊仓 ${state.gu.length} / 12</small></div><div class="loadout-grid">${Array.from({length:5},(_,i)=>{const inst=state.gu.find(x=>x.id===state.equip[i]);return inst?`<div class="loadout-slot" data-gu-id="${inst.gu}"><b class="name">${esc(GM[inst.gu].name)}</b></div>`:'<div class="loadout-slot empty-slot"><span>空位</span></div>'}).join('')}</div><div class="compact-refinement"><button class="text-button" onclick="setPrepTab('inventory')">${availableRecipes().length?'可合炼 '+availableRecipes().map(r=>GM[r.id].name).join('、'):'查看蛊仓与合炼'}</button></div></section>`}
function refinementPanel(){return `<section class="refinement-panel"><h3>合炼台</h3><p class="meta">固定蛊方 · 原蛊将被消耗</p>${M3_RECIPES.map(r=>`<div class="recipe ${availableRecipes().includes(r)?'available':''}"><div class="recipe-flow">${r.inputs.map(id=>`<span class="recipe-input" data-gu-id="${id}"><b>${esc(GM[id].name)}</b><small>${state.gu.some(g=>g.gu===id)?'将消耗':'缺少原料'}</small></span>`).join('<span aria-hidden="true">＋</span>')}<span aria-hidden="true">→</span><span class="recipe-output" data-gu-id="${r.id}"><b>${esc(GM[r.id].name)}</b></span></div><p class="meta">${esc(r.note)}</p><button onclick="presentRefinement('${r.id}')" ${!availableRecipes().includes(r)?'disabled':''}>合炼（牺牲原蛊）</button></div>`).join('')}</section>`}
function presentRefinement(id){const made=refineGu(id);if(made&&document.body){document.body.dataset.forged=id;const result=document.querySelector?.('.recipe-output[data-gu-id="'+id+'"]');result?.classList.add('just-forged');result?.setAttribute('role','status');result?.setAttribute('aria-label',GM[id].name+'合炼成功，原蛊已消耗');}return made}
function guCard(inst){const g=GM[inst.gu],equipped=state.equip.includes(inst.id);return `<article class="slot gu-card ${equipped?'equipped':''}" data-gu-id="${g.id}">${kindLabel(g)}${equipped?'<span class="formation-stamp">阵</span>':''}<b class="name">${esc(g.name)}</b><div class="meta">${esc(g.description)}</div><details class="gu-inspect"><summary>完整效果</summary><p>${esc(g.description)}</p></details><small class="cooldown">冷却 ${g.cd} tick</small><div class="actions"><button onclick="equip('${inst.id}')" ${!equipped&&state.equip.length>=5?'disabled':''}>${equipped?'卸下':'装备'}</button><button class="text-button" onclick="sell('${inst.id}')">出售 +2</button></div></article>`}
function setPrepTab(tab){if(!['shop','inventory'].includes(tab))return;if(document.body)document.body.dataset.prepTab=tab;document.querySelectorAll?.('.prep-tab').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1});}
function setInkMotion(value){const mode=value==='reduce'?'reduce':'system';if(document.body)document.body.dataset.motion=mode;try{localStorage.setItem('wenzhen_ink_motion',mode)}catch{}if(typeof window!=='undefined')window.InkSpecimenArt?.decorate()}
function inkStatus(){q('status').innerHTML=state?`<span class="edition-badge">${M3_MODE?'M3 五转实验':'M2 先行'}</span><span>轮 <b>${state.round}/${TOTAL_ROUNDS}</b></span><span class="gold">金币 <b>${state.gold}</b></span><span>败北 <b>${state.losses}/3</b></span>`:`<span class="edition-badge">${M3_MODE?'M3 五转实验':'M2 先行'}</span><span>离线单局</span>`}
function inkFocusControls(){return Array.from(document.querySelectorAll?.('button[onclick]')||[]).filter(el=>!el.disabled&&el.getClientRects().length&&(!el.closest('details:not([open])')||el.closest('summary')))}
function render(){const focusAction=document.activeElement?.getAttribute?.('onclick');const focusPosition=inkFocusControls().indexOf(document.activeElement);if(!state){const data=localStorage.getItem(STORE_KEY);if(data){try{state=JSON.parse(data)}catch{localStorage.removeItem(STORE_KEY)}}}
inkStatus();
if(!state){q('app').innerHTML=`<div class="onboarding"><span class="combat-overline">墨蛊标本 · 玄同纪</span><h1>${M3_MODE?'百兵与观复，逆推五转':'择一道途，观蛊成阵'}</h1><p>在灯下辨认每只蛊的用途，选出你的五格蛊阵。${M3_MODE?'两道 · 十六轮实验':'八道 · 双幕六战'}。</p><div class="school-grid">${(M3_MODE?['百兵','观复']:SCHOOLS).map(s=>`<section class="card school-card"><h2>${s}</h2><p class="meta">${GU.filter(g=>g.school===s).slice(0,3).map(g=>g.name).join(' · ')}</p><button onclick="init('${s}')">选择道途</button></section>`).join('')}</div></div>`;return}
if(state.pendingSpoils){renderSpoils();return}
if(state.completed){q('app').innerHTML=`<section class="panel result-panel"><h2>${M3_MODE?'M3 逆推长局试验结算':'M2 双幕结算'}</h2><p>完成 ${state.round} 场试炼，失败 ${state.losses} 次。${M3_MODE?'16轮验证入口；尚非全部八道成品。':'此处为双幕六场结算，完整15战尚未实现。'}</p>${battleReport(state.lastResult?.stats)}<button onclick="restart()">新的一局</button></section>`;return}
if(battle){renderBattle();return}if(state.inBattle){startBattle();return}
const cost=state.free?0:Math.min(4,state.rerolls+2),tab=document.body?.dataset.prepTab||'shop';
q('app').innerHTML=`<nav class="prep-tabs" role="tablist" aria-label="整备功能"><button class="prep-tab" data-tab="shop" role="tab" onclick="setPrepTab('shop')">交易 · 商店</button><button class="prep-tab" data-tab="inventory" role="tab" onclick="setPrepTab('inventory')">构筑 · 蛊仓</button></nav><div class="prep-heading"><h2>第${state.round}轮 · ${state.round<=CHAPTER_LENGTH?'第一幕':'第二幕'}整备与交易</h2><small>每场生命30 · 技能自动触发</small></div><div class="prep-layout inventory-layout"><section class="shop-panel"><div class="section-heading"><h3>四槽货架</h3><button onclick="reroll()" ${state.gold<cost?'disabled':''}>刷新货架 · ${cost?'金币 '+cost:'免费'}</button></div><div class="grid">${state.shelf.map((x,i)=>{if(!x)return '<div class="card shopitem placeholder"><span>已售出</span><small>刷新补充货架</small></div>';const g=GM[x.gu];return `<article class="card shopitem ${x.lock?'locked':''}" data-gu-id="${g.id}">${kindLabel(g)}${x.lock?'<span class="lock-stamp">锁</span>':''}<div class="name">${esc(g.name)}</div><div class="meta">${esc(g.description)}</div><details class="gu-inspect"><summary>完整效果</summary><p>${esc(g.description)}</p></details><small class="cooldown">冷却 ${g.cd} tick</small>${offerHint(x.gu)}<div class="card-bottom"><span class="gold ${state.gold<4?'insufficient':''}">◉ 4</span><div class="actions"><button onclick="lock(${i})">${x.lock?'已锁定 · 解锁':'锁定'}</button><button onclick="buy(${i})" ${state.gold<4||state.gu.length>=12?'disabled':''}>${state.gold<4?'金币不足':state.gu.length>=12?'蛊仓已满':'购买'}</button></div></div></article>`}).join('')}</div><details class="merchant-details"><summary>商人寻蛊 · 定向委托 <span>跨轮最多锁定2件</span></summary><div class="merchant-controls"><label>选择蛊 <select id="seek-gu">${GU.map(g=>`<option value="${g.id}">${esc(g.school)} · ${esc(g.name)}</option>`).join('')}</select></label><button onclick="seekGu(q('seek-gu').value)" ${state.seekUsed||state.gold<6||state.gu.length>=12||!state.shelf.some(x=>x&&!x.lock&&!x.seek)?'disabled':''}>${state.seekUsed?'本轮已委托':'定向寻蛊 · 2 金币'}</button><p class="meta">委托费2，寻得后仍须花4购买；每轮一次。</p>${m3SupplyPanel()}</div></details></section><section class="inventory-main"><div class="section-heading"><h3>蛊仓与出战</h3><small>${state.gu.length} / 12</small></div><div class="inventory-grid">${state.gu.map(guCard).join('')}${Array.from({length:Math.max(0,12-state.gu.length)},()=>'<div class="empty-slot"><span>空位</span></div>').join('')}</div></section><aside class="prep-aside">${huntBoard()}${loadoutPanel()}${refinementPanel()}<section class="challenge-panel"><button class="primary" onclick="startBattle()" ${state.equip.length===0?'disabled':''}>迎战 ${esc(targetFoe().name)}</button><small>对手：${esc(targetFoe().name)} · 战斗自动进行</small></section><section class="build-guide"><h3>战前判断</h3>${buildGuide()}</section></aside></div><details class="economy-rules"><summary>经营规则与重开</summary><p>一转售价4，出售返2；每轮收入5；免费首刷，付费2/3/4/4…；最多12实例，负载5。</p><button onclick="restart()">放弃并重开</button></details>`;
setPrepTab(tab);if(typeof window!=='undefined')window.InkSpecimenArt?.decorate();if(focusAction){const controls=inkFocusControls();const control=controls.find(el=>el.getAttribute('onclick')===focusAction)||controls[Math.min(Math.max(0,focusPosition),controls.length-1)]||document.querySelector?.('.prep-tab.active');control?.focus({preventScroll:true});if(control&&typeof window!=='undefined'){const bounds=control.getBoundingClientRect();if(bounds.top<0||bounds.bottom>window.innerHeight||bounds.left<0||bounds.right>window.innerWidth)control.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}}
}
function restart(){if(!confirm('放弃当前进度并重新开局？'))return;clearInterval(timer);timer=null;battle=null;state=null;localStorage.removeItem(STORE_KEY);render()}
function has(type,source){return battle.states.some(s=>s.type===type&&(!source||s.source===source)&&s.until>battle.tick)}
function get(type,source){return battle.states.find(s=>s.type===type&&(!source||s.source===source)&&s.until>battle.tick)}
function mark(type,source,duration,value=0,extra={}){battle.states=battle.states.filter(s=>!(s.type===type&&s.source===source));battle.states.push({type,source,at:battle.tick,until:battle.tick+duration,value,...extra});push("状态 "+type+" ("+duration+" tick)")}
function shield(source,value,until){const available=12-battle.shields.reduce((a,s)=>a+s.value,0);const v=Math.max(0,Math.min(value,available));if(v){battle.shields.push({source,value:v,until,seq:battle.seq++});push("护盾 +"+v+" ["+(GM[source.split(':')[0]]?.name||source)+"]")}return v}
function push(s){log.push('['+battle.tick+'] '+s);if(log.length>400)log.shift()}
function fresh(){return battle.instances.filter(x=>x.ready<=battle.tick&&x.first<=battle.tick).sort((a,b)=>a.slot-b.slot)}
function cast(x){x.ready=battle.tick+x.cd;push(GM[x.gu].name+" 触发")}
function environmentWind(){return battle.foe.id!=="swordsman"||battle.tick%18<12}
function direct(value,source,opts={}){if(battle.foe.hp<=0)return;let dmg=value;const target=has("weak")&&opts.consumeWeak!==false?get("weak"):null;if(target){dmg+=2;battle.states=battle.states.filter(s=>s!==target)}if(has("owner")&&!opts.periodic)dmg++;if(opts.bonus)dmg+=opts.bonus;let armor=has("broken")?0:battle.foe.armor;if(opts.angle)armor=Math.max(0,armor-1);dmg=Math.max(1,dmg-armor);const applied=Math.min(dmg,battle.foe.hp);battle.foe.hp=Math.max(0,battle.foe.hp-dmg);if(battle.totals){battle.totals.damageDealt+=applied;battle.totals.damageBySource[source]=(battle.totals.damageBySource[source]||0)+applied}push(source+" → "+battle.foe.name+" -"+dmg+" (剩余"+battle.foe.hp+")");return applied}
function hitQueued(e){let value=Math.max(0,e.damage),sources={};if(e.evade)value=Math.max(0,value-e.evade);if(e.type==="charge"&&has("gate"))value=Math.max(0,value-1);if(has("bind")){value=Math.max(0,value-2);battle.states=battle.states.filter(s=>s.type!=="bind")};if(e.reduction)value=Math.max(0,value-e.reduction);const shade=get("shade");if(shade&&!shade.used&&value>0){value=Math.max(0,value-1);shade.used=true}
battle.shields.sort((a,b)=>a.seq-b.seq);for(const s of battle.shields){const absorb=Math.min(value,s.value);value-=absorb;s.value-=absorb;sources[s.source]=(sources[s.source]||0)+absorb}
if(battle.totals){battle.totals.shieldAbsorbed+=Object.values(sources).reduce((sum,n)=>sum+n,0);for(const [src,n] of Object.entries(sources))battle.totals.absorbedByInstance[src]=(battle.totals.absorbedByInstance[src]||0)+n;battle.totals.damageTaken+=Math.min(value,battle.hp)}battle.shields=battle.shields.filter(s=>s.value>0);battle.hp=Math.max(0,battle.hp-value);push("敌方 "+e.name+" 命中，生命 -"+value+"；剩余 "+battle.hp);
if(value>0){
 const drink=battle.instances.find(x=>x.gu==="N202"&&x.ready<=battle.tick);
 if(drink){cast(drink);battle.pending.push({tick:battle.tick+1,type:"blood",damage:Math.min(6,value),source:drink.instance});push("饮锋蓄血势 "+Math.min(6,value))}
}
const gs=battle.instances.find(x=>x.gu==="G103"&&x.ready<=battle.tick),heard=Object.entries(sources).filter(([k,v])=>v>0&&(k.startsWith("G102:")||k.startsWith("G201:"))).length>0;
if(gs&&heard&&e.observed){cast(gs);const bonus=battle.lastConfirmed===e.type?2:0;battle.pending.push({tick:battle.tick+1,type:"counter",damage:3+bonus,source:gs.id})}
if(e.observed)battle.lastConfirmed=e.type;
if(M3_MODE){
 if(e.type==="disarm"&&value>0){battle.weaponBroken=true;push("硬反制：真命中后缴械，实体兵胚失去，全部变节终止")}
 if(e.type==="fracture"&&value>0){
  const strong=battle.instances.some(x=>["B401","B501"].includes(x.gu));
  if(strong){battle.jointIntegrity=Math.max(0,battle.jointIntegrity-1);push("关节被击断，剩余"+battle.jointIntegrity);if(!battle.jointIntegrity)battle.weaponBroken=true}
  else if(battle.instances.some(x=>x.gu==="B301")){battle.weaponBroken=true;push("游节兵的脆弱关节被全断")}
 }
 const verified=e.revealed&&e.type!=="feint"&&e.type!=="hidden";
 battle.observedStreak=verified?(battle.lastResolvedMove===e.name?battle.observedStreak+1:1):0;
 battle.lastResolvedMove=verified?e.name:null;
 if(!verified)push("观复证据归零：变招或隐匿节律不可继承");
}
battle.current=null}
function startBattle(){if(battle||state.pendingSpoils||state.completed||state.equip.length===0)return;state.inBattle=true;save();const foe=clone(targetFoe());foe.maxHp=foe.hp;battle={tick:0,hp:30,foe,targetIndex:targetIndex(),observedStreak:0,lastResolvedMove:null,forecastUsed:false,weaponBroken:false,jointIntegrity:3,totals:{damageDealt:0,damageTaken:0,healing:0,shieldAbsorbed:0,damageBySource:{},absorbedByInstance:{}},instances:state.equip.map((id,slot)=>{let g=GM[state.gu.find(x=>x.id===id).gu];return {...g,gu:g.id,instance:id,slot,ready:g.first}}),states:[],shields:[],pending:[],current:null,nextDeclare:foe.first,moveIndex:0,lastConfirmed:null,seq:0};log=[];renderBattle();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'});timer=setInterval(()=>{step();renderBattle()},500)}
// Synthetic-only M1 interrupt hook; no starting Gu invokes it.
function interrupt(source="synthetic"){
 if(!battle||!battle.current||battle.current.impact<=battle.tick||battle.tick<(battle.interruptImmuneUntil||0))return false;
 const old=battle.current, declared=old.impact-old.windup;
 // Guard-shields survive a cancelled hit only through six ticks after declaration.
 for(const s of battle.shields)if(s.source.startsWith("B102:"))s.until=declared+6;
 battle.current=null;
 battle.nextDeclare=battle.tick+6;
 battle.interruptImmuneUntil=battle.tick+12;
 push(source+" 打断 "+old.name+"；重新宣告于 tick "+battle.nextDeclare);
 return true;
}
function observation(e){return e.type!=="feint"||battle.tick>=e.impact-2}
function step(){if(!battle)return;const b=battle,t=b.tick;
b.states=b.states.filter(s=>s.until>t);b.shields=b.shields.filter(s=>s.until>t&&s.value>0);
if(b.current&&b.current.type==="feint"&&t===b.current.impact-2){b.current.revealed=true;push("变招轨迹公开")}
if(!b.current&&t>=b.nextDeclare){let move=b.foe.moves[b.moveIndex%b.foe.moves.length];b.repeatMoveCount=b.lastDeclaredMove===move.name?(b.repeatMoveCount||0)+1:1;b.lastDeclaredMove=move.name;b.current={...move,impact:t+move.windup,id:"attack"+b.seq++,observed:false,evade:0,reduction:0,revealed:move.type!=="feint"};push("敌方宣告："+move.name+"，"+move.windup+" tick后命中");b.moveIndex++;b.nextDeclare=t+b.foe.period[(b.moveIndex-1)%b.foe.period.length]}
const enemy=b.current;
for(const x of fresh().filter(x=>["B103","Z101","H101","T101","M101","G101"].includes(x.gu))){switch(x.gu){
case"B103":if(!has("weak",x.instance)){cast(x);mark("weak",x.instance,8);if(b.foe.id==="boar")mark("broken",x.instance,6)}break;
case"Z101":if(!has("owner",x.instance)){cast(x);mark("owner",x.instance,10)}break;
case"H101":if(!has("gap",x.instance)){cast(x);mark("gap",x.instance,8)}break;
case"T101":if(!has("sand",x.instance)){cast(x);mark("sand",x.instance,10)}break;
case"M101":if(environmentWind()&&!has("flow",x.instance)){cast(x);mark("flow",x.instance,8)}break;
case"G101":if(enemy&&observation(enemy)&&!enemy.observed){cast(x);enemy.observed=true;enemy.reduction=(enemy.reduction||0)+2;push("辨兆确认："+enemy.name)}break;
}}
for(const x of fresh().filter(x=>["Y103","S102","T102","S103","B102","Y102","H103","M103","Z103","G102","G201","G301","G401","G501"].includes(x.gu))){
switch(x.gu){
case"Y103":if(!has("shade",x.instance)){cast(x);mark("shade",x.instance,6,0,{attackUsed:false,used:false})}break;
case"S102":if(b.shields.reduce((a,s)=>a+s.value,0)<2){cast(x);shield(x.gu+":"+x.instance,3,t+10)}break;
case"T102":if(b.shields.reduce((a,s)=>a+s.value,0)<2){cast(x);shield(x.gu+":"+x.instance,3+(has("sand")?1:0),t+10)}break;
case"S103":if(b.hp<30){cast(x);b.pending.push({tick:t,type:"heal",value:3})}else if(b.shields.reduce((a,s)=>a+s.value,0)<2){cast(x);shield(x.gu+":"+x.instance,2,t+8)}break;
case"B102":if(enemy&&enemy.impact>t&&enemy.impact-enemy.windup===t){cast(x);shield(x.gu+":"+x.instance,3,enemy.impact+1)}break;
case"Y102":if(enemy&&enemy.impact-enemy.windup===t){cast(x);enemy.evade+=4;push("投影预备规避4")}break;
case"H103":if(enemy&&enemy.impact-enemy.windup===t&&has("beacon")){cast(x);shield(x.gu+":"+x.instance,3,enemy.impact+1);if(enemy.type==="charge")mark("gate",x.instance,enemy.windup+1)}break;
case"M103":if(enemy&&enemy.impact-enemy.windup===t){cast(x);if(enemy.type==="charge")enemy.evade+=4;else shield(x.gu+":"+x.instance,3,enemy.impact+1)}break;
case"Z103":if(enemy&&enemy.impact===t+1&&has("bind")){cast(x);b.states=b.states.filter(s=>s.type!=="bind");enemy.reduction+=4;shield(x.gu+":"+x.instance,2,enemy.impact+1)}break;
case"G102":if(enemy&&enemy.impact===t&&enemy.observed){cast(x);shield(x.gu+":"+x.instance,4,t+1)}break;
case"G201":if(enemy&&enemy.impact===t&&enemy.revealed&&b.repeatMoveCount>=2){cast(x);enemy.observed=true;shield(x.gu+":"+x.instance,8,t+1);push("重息辨认旧式："+enemy.name)}break;
case"G301":case"G401":case"G501":
 if(enemy&&enemy.impact===t+1&&enemy.revealed&&enemy.type!=="feint"&&b.observedStreak>=2&&b.lastResolvedMove===enemy.name&&!b.forecastUsed){
  cast(x);b.forecastUsed=true;enemy.observed=true;
  if(x.gu==="G301"){enemy.reduction+=2;b.pending.push({tick:t,type:"counter",damage:3,source:x.instance});push("三息验循：先手截招，反击窗口成立")}
  else if(x.gu==="G401"){enemy.reduction+=3;b.pending.push({tick:t,type:"counter",damage:5,source:x.instance});push("观微见著：已验证旧式，抢占一次前摇")}
  else{enemy.reduction+=enemy.damage;push("万象观复：两次真实同招已验，精准化解下一次可见旧式")}
 }
 break;
}}
for(const x of fresh().filter(x=>["B101","B201","B301","B401","B501","Y101","S101","Z102","H102","T103","M102","N201","G112"].includes(x.gu))){let bonus=0;
if(x.gu==="N201"&&(!enemy||enemy.impact<=t))continue;if(x.gu==="G112"&&(!enemy||!enemy.revealed||b.repeatMoveCount<2||enemy.impact<=t))continue;if(x.gu==="Z102"&&!has("owner"))continue;if(x.gu==="M102"&&!environmentWind())continue;if(x.gu==="Y101"){const shade=get("shade");if(shade&&!shade.attackUsed){bonus=1;shade.attackUsed=true}}
if(x.gu==="H102"){const gap=get("gap");if(gap){bonus=2;b.states=b.states.filter(s=>s!==gap)}}
if(x.gu==="T103"){const sand=get("sand");if(sand){bonus=2;b.states=b.states.filter(s=>s!==sand)}}
if(x.gu==="M102"){const flow=get("flow");if(flow){bonus=2;b.states=b.states.filter(s=>s!==flow)}}
if(["B301","B401","B501"].includes(x.gu)&&b.weaponBroken)continue;
cast(x);const landed=direct(({B101:4,Y101:3,S101:2,Z102:3,H102:3,T103:3,M102:3,N201:5,G112:3,B201:4,B301:4,B401:4,B501:4})[x.gu],GM[x.gu].name,{bonus});
if(["B301","B401","B501"].includes(x.gu)&&landed>0&&b.foe.hp>0&&b.jointIntegrity>0&&!b.weaponBroken){
 b.pending.push({tick:t+2,type:"jointStrike",gu:x.gu,remaining:x.gu==="B501"?2:1,segment:2,damage:3});
 push("实击确认：实体兵胚与完好关节俱在，预备折角续击");
}
if(x.gu==="B201"&&b.foe.hp>0)b.pending.push({tick:t+2,type:"returnBlade",damage:3});
if((x.gu==="S101"||x.gu==="T103")&&b.foe.hp>0)mark("dot",x.instance,5,1,{kind:x.gu,next:[t+2,t+4]});
if(x.gu==="Z102"&&b.foe.hp>0)mark("bind",x.instance,8);
if(x.gu==="H102"&&b.foe.hp>0)mark("beacon",x.instance,10);
}
if(t>=2&&(t-2)%6===0)direct(2,"基础攻击");
for(const e of b.pending.filter(x=>x.tick===t&&x.type==="counter"))direct(e.damage,"记痕反击",{consumeWeak:false});
for(const e of b.pending.filter(x=>x.tick===t&&x.type==="blood"))direct(e.damage,"饮锋反击",{consumeWeak:false});
for(const e of b.pending.filter(x=>x.tick===t&&x.type==="returnBlade"))direct(e.damage,"折锋回刺",{consumeWeak:false});
for(const e of b.pending.filter(x=>x.tick===t&&x.type==="jointStrike")){
 if(b.weaponBroken||b.jointIntegrity<e.segment-1||b.foe.hp<=0){push("变节续击被硬反制阻断：缴械、关节不足或目标已倒");continue}
 const landed=direct(e.damage,"变节折角·"+GM[e.gu].name,{consumeWeak:false,angle:true});
 if(e.remaining>1&&landed>0&&b.foe.hp>0&&b.jointIntegrity>0&&!b.weaponBroken){
  b.pending.push({tick:t+2,type:"jointStrike",gu:e.gu,remaining:e.remaining-1,segment:e.segment+1,damage:e.damage});
  push("第二段真命中且下一关节完好，允许第三段");
 }
}
b.pending=b.pending.filter(x=>!(x.tick===t&&["counter","blood","returnBlade","jointStrike"].includes(x.type)));
for(const s of [...b.states].filter(x=>x.type==="dot"&&x.next.includes(t))){direct(s.value,s.kind==="S101"?"根刺":"灼烧",{consumeWeak:false,periodic:true});s.next=s.next.filter(n=>n!==t)}
if(b.foe.id==="rootling"&&t>0&&t%10===0&&b.foe.hp>0){const burning=b.states.some(s=>s.type==="dot"&&s.kind==="T103");if(!burning){const heal=Math.min(3,b.foe.maxHp-b.foe.hp);b.foe.hp+=heal;if(heal>0)push("枯根傀儡再生 +"+heal)}else push("火筹灼烧阻断枯根再生")}
if(b.foe.hp<=0){finish(true);return}
if(enemy&&enemy.impact===t){hitQueued(enemy);if(b.hp<=0){finish(false);return}}
for(const e of b.pending.filter(x=>x.tick===t&&x.type==="heal")){const before=b.hp;b.hp=Math.min(30,b.hp+e.value);if(b.totals)b.totals.healing+=b.hp-before;push("引露治疗 +"+(b.hp-before))}b.pending=b.pending.filter(x=>!(x.tick===t&&x.type==="heal"));
if(t>=120){finish(false);return}b.tick++}
function finish(won){clearInterval(timer);timer=null;let result={won,tick:battle.tick,hp:battle.hp,foe:battle.foe.name,log:log.slice(),stats:clone(battle.totals)};if(M3_MODE){state.lastTargetIndex=battle.targetIndex;state.pastTargets??=[];if(!state.pastTargets.includes(battle.targetIndex))state.pastTargets.push(battle.targetIndex)}battle=null;state.lastResult=result;state.inBattle=false;state.losses+=won?0:1;if(won){const d=upcomingSpoils();state.pendingSpoils={foe:d.foe,gu:d.gu,clue:d.clue}}else if(state.losses>=3||state.round>=TOTAL_ROUNDS)endRun();else beginRound();save();render();q("app").insertAdjacentHTML("afterbegin",'<section class="panel"><h3>'+(won?'战斗胜利':'战斗失利')+' · '+esc(result.foe)+'</h3><p>结束 tick '+result.tick+' · 剩余生命 '+result.hp+'</p>'+battleReport(result.stats)+'<details><summary>展开事件日志</summary><pre class="log">'+esc(result.log.join("\n"))+'</pre></details></section>')}
function renderBattle(){
 const b=battle;if(!b)return;
 const foe=targetFoe(),remain=b.current?b.current.impact-b.tick:null,shieldValue=b.shields.reduce((n,s)=>n+s.value,0);
 const hidden=b.current?.type==='feint'&&!b.current.revealed;
 const enemyAct=b.current?(hidden?'轨迹未明 · 变招蓄势':b.current.name):'尚未宣告';
 const progress=b.current?Math.max(0,Math.min(100,100*(1-remain/b.current.windup))):0;
 const field=b.foe.id==='boar'?'潮湿岩地':b.foe.id==='swordsman'?'流风断续':'干地微光';
 const flash=log.at(-1)||'[0] 战斗准备';
 const recent=log.slice(-3).reverse().map(line=>{
  const tone=line.includes('命中')?'tone-danger':line.includes('护盾')||line.includes('规避')?'tone-guard':line.includes('→')?'tone-damage':'tone-neutral';
  const matched=b.instances.filter(x=>line.includes(x.name));const source=matched.length===1?matched[0]:null;
  return `<div class="event-strip ${tone}" ${source?`data-source-gu="${source.gu}"`:''}>${esc(line)}</div>`;
 }).join('');
 const instances=Array.from({length:5},(_,i)=>{const x=b.instances[i];if(!x)return '<div class="battle-gu empty"><span>空位</span></div>';const remaining=Math.max(0,x.ready-b.tick),ready=remaining===0;return `<div class="battle-gu ${ready?'ready':'cooling'}" data-gu-id="${x.gu}"><div class="cooldown-ring" style="--progress:${Math.max(0,Math.min(100,100*(1-remaining/x.cd)))}%"><span>${ready?'●':remaining}</span></div><div class="battle-gu-copy"><strong>${esc(x.name)}</strong><small>${ready?'就绪':remaining+' tick'}</small></div><div class="ready-pip"></div></div>`}).join('');
 const previous=inkCombatView?.battle===b?inkCombatView:null;
 const playerHit=previous&&b.hp<previous.hp,foeHit=previous&&b.foe.hp<previous.foeHp;
 inkCombatView={battle:b,hp:b.hp,foeHp:b.foe.hp};
 const oldLog=document.querySelector?.('#log');const logScroll=oldLog?.scrollTop||0;const logHadFocus=document.activeElement?.closest?.('.battle-log-details');const openLog=document.querySelector?.('.battle-log-details')?.open;
 const quickFocused=document.activeElement?.dataset?.action==='quick';
 q('app').innerHTML=`<div class="combat-title"><div><span class="combat-overline">${M3_MODE?'M3 五转实验':'M2 双幕'} · 第 ${state.round} 战 · 道途 ${esc(state.school)}</span><h2>自动交锋</h2></div><span class="battle-clock">TICK ${String(b.tick).padStart(3,'0')} <small>/ 120 · 每0.5秒</small></span><button data-action="quick" onclick="quick()">立即结算</button></div><div class="combat-shell"><section class="combat-stage enemy-${esc(b.foe.id)}"><div class="stage-top"><span>道途 · ${esc(state.school)}</span><span>${field}</span></div><div class="arena"><div class="combatant player ${playerHit?'took-hit':''}"><div class="figure-portrait player-figure"><img class="player-portrait" alt="${esc(state.school)}蛊师墨色剪影"></div><div class="combatant-name"><span class="side-label">我方</span> ${esc(state.school)}蛊师</div><div class="hp-numbers"><strong>${b.hp}</strong><small>/ 30 气血</small><span class="shield-value">◇ 盾 ${shieldValue}</span></div><div class="hp-track player-track">${playerHit?`<i class="hp-trail" style="width:${100*previous.hp/30}%;--hp-now:${Math.max(0,100*b.hp/30)}%"></i>`:''}<i style="width:${Math.max(0,100*b.hp/30)}%"></i></div></div><div class="intent-bar ${remain!==null&&remain<=1?'imminent':''}"><small>▲ 敌方意图</small><div class="intent-copy"><strong>${esc(enemyAct)}</strong><span>${b.current&&!hidden?'将造成 '+b.current.damage+' 伤害':'观察敌方出手'}</span></div><div class="intent-track"><i style="width:${progress}%"></i></div><b>${remain!==null?(remain<=1?'即将 · ':'')+remain+' tick':'等待宣告'}</b></div><div class="combatant foe ${foeHit?'took-hit':''}"><div class="figure-portrait"><img class="foe-portrait" data-foe-id="${esc(b.foe.id)}" alt="${esc(foe.name)}墨色剪影"></div><div class="combatant-name"><span class="side-label">敌方</span> ${esc(foe.name)}</div><div class="hp-numbers"><strong>${b.foe.hp}</strong><small>/ ${foe.hp} 气血</small><span class="armor-value">▣ 甲 ${foe.armor}</span></div><div class="hp-track">${foeHit?`<i class="hp-trail" style="width:${100*previous.foeHp/foe.hp}%;--hp-now:${Math.max(0,100*b.foe.hp/foe.hp)}%"></i>`:''}<i style="width:${Math.max(0,100*b.foe.hp/foe.hp)}%"></i></div></div></div><div class="focus-event"><small>战场焦点</small><strong>${esc(flash.replace(/^\[\d+\]\s*/,''))}</strong></div><section class="gu-field"><div class="gu-panel-header"><h3>我方蛊阵</h3><small>出战 ${b.instances.length} / 5</small></div><div class="battle-gu-list">${instances}</div></section></section><aside class="combat-side"><div class="battle-progress"><div><small>我方已造成</small><strong>${b.totals.damageDealt}</strong></div><div><small>护盾已吸收</small><strong>${b.totals.shieldAbsorbed}</strong></div></div><section class="event-panel"><h3>最近事件</h3><div class="recent-events" aria-live="polite">${recent||'<p class="meta">战斗准备</p>'}</div><details class="battle-log-details" ${openLog?'open':''}><summary>查看完整事件日志 · ${log.length} 条</summary><pre class="log" id="log">${esc(log.join('\n'))}</pre></details></section></aside></div>`;
 if(openLog&&oldLog){const nextLog=q('log');if(nextLog)nextLog.scrollTop=logScroll;}if(logHadFocus)document.querySelector?.('.battle-log-details summary')?.focus({preventScroll:true});
 if(quickFocused)document.querySelector?.('[data-action="quick"]')?.focus({preventScroll:true});
}
function quick(){clearInterval(timer);timer=null;let guard=130;while(battle&&guard--)step();if(battle)renderBattle()}
render();
if(document.addEventListener)document.addEventListener('keydown',event=>{if(event.target?.matches?.('.prep-tab')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=['ArrowRight','End'].includes(event.key)?'inventory':'shop';setPrepTab(next);document.querySelector('.prep-tab[data-tab="'+next+'"]')?.focus();}});
if(document.body){try{const mode=localStorage.getItem('wenzhen_ink_motion');document.body.dataset.motion=mode==='reduce'?'reduce':'system';q('motion-setting').value=document.body.dataset.motion}catch{}}
