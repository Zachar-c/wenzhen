/* Visual-only M2 decorator. Reads rendered text; never modifies state, rules or handlers. */
(()=>{
"use strict";
const schools={"百兵":["#bfa9f0","#514b85"],"晦明":["#e6c38b","#605078"],"玄牝":["#9fcba8","#345d59"],"执枢":["#eab1a8","#663f55"],"阖辟":["#9dc9d8","#355a75"],"参同":["#e9b17c","#895242"],"乘物":["#add7d6","#416b78"],"观复":["#c5b8e6","#5b4d81"]};
const kinds={"攻":"✦","防":"◇","标":"◎","疗":"✿","辅":"◈","反":"❖","察":"◉"};
const guData=typeof GU!=="undefined"?GU:[];
const guByName=new Map(guData.map(g=>[g.name,g]));
const paintedGuTile={B101:0,T103:1,Y101:2,M102:3,Y102:4,S101:5,G101:6};
const guAtlasPath="data:image/webp;base64,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";
const uri=s=>"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(s);
const atlasPath="assets/visual/m2_r8_character_atlas.webp";
let atlasReady=false;
let mobileStageWasPresent=false;
const atlasProbe=new Image();
atlasProbe.onload=()=>{atlasReady=atlasProbe.naturalWidth>=512&&atlasProbe.naturalHeight>=160;decorate();};
atlasProbe.onerror=()=>{atlasReady=false;};
atlasProbe.src=atlasPath;
// Distinct silhouettes by actual Gu ID; illustrative vocabulary only, not new rules.
const motifs={
 B101:"blade",B102:"shield",B103:"blade",B201:"returnblade",Y101:"moth",Y102:"mirror",Y103:"lantern",
 S101:"sprout",S102:"tree",S103:"drop",Z101:"eye",Z102:"chain",Z103:"knot",
 H101:"eye",H102:"target",H103:"gate",T101:"sand",T102:"furnace",T103:"flame",
 M101:"wave",M102:"wind",M103:"step",N201:"blade",N202:"fang",
 G101:"eye",G102:"shield",G103:"echo",G112:"hourglass",G201:"aegis"
};
const motifShapes={
 returnblade:'<path d="M61 157 L122 39 L146 53 L107 133 L152 118 L140 144 L79 177Z"/><path d="M55 95 Q43 47 102 43 M77 32 L102 43 L85 65"/>',
 hourglass:'<path d="M54 41 H146 M54 167 H146 M63 45 Q64 82 100 100 Q136 82 137 45 M63 163 Q65 126 100 108 Q135 126 137 163"/><circle cx="100" cy="100" r="13"/><path d="M100 84 V66 M100 116 V135"/>',
 aegis:'<path d="M100 25 Q150 47 161 72 Q164 132 100 174 Q36 132 39 72 Q50 47 100 25Z"/><path d="M100 47 Q132 62 138 86 Q140 126 100 151 Q60 126 62 86 Q68 62 100 47Z"/><path d="M78 99 H122 M100 77 V123"/>',

 blade:'<path d="M76 149 L121 51 L143 38 L147 67 L98 159 L81 168Z"/><path d="M91 137 L126 65 M68 144 L112 166"/>',
 shield:'<path d="M100 39 L155 62 L147 122 Q130 155 100 171 Q70 155 53 122 L45 62Z"/><path d="M100 51 L100 154 M58 87 L143 87"/>',
 moth:'<path d="M100 90 Q35 13 31 91 Q42 129 89 116 Q40 175 81 171 L100 128 Q119 171 160 171 Q166 132 111 116 Q158 129 169 91 Q165 13 100 90Z"/><path d="M100 70 L100 153"/>',
 mirror:'<ellipse cx="100" cy="95" rx="45" ry="60"/><path d="M83 156 L117 156 L110 181 L90 181Z M76 81 Q100 45 126 75"/>',
 lantern:'<path d="M65 75 Q100 39 135 75 L129 143 Q100 164 71 143Z M88 53 L112 53 M100 143 L100 174"/><path d="M76 98 H124"/>',
 sprout:'<path d="M100 170 Q87 113 105 81 M99 125 Q41 119 48 73 Q83 71 100 108 M103 96 Q119 53 159 62 Q154 107 104 116"/>',
 tree:'<path d="M100 175 V84 M100 120 L64 92 M100 107 L137 73"/><path d="M101 45 Q58 35 49 87 Q31 122 77 143 Q113 157 141 134 Q179 115 151 83 Q150 40 101 45Z"/>',
 drop:'<path d="M100 28 Q145 89 145 119 A45 45 0 1 1 55 119 Q55 89 100 28Z"/><path d="M75 127 Q76 151 98 154"/>',
 eye:'<path d="M31 102 Q100 31 169 102 Q100 173 31 102Z"/><circle cx="100" cy="102" r="24"/><circle cx="100" cy="102" r="8"/>',
 chain:'<path d="M53 72 Q30 95 53 116 L76 136 Q99 146 115 124 M85 76 Q101 54 124 64 L147 84 Q170 106 147 128"/><path d="M70 121 L130 79"/>',
 knot:'<path d="M61 68 C145 30 173 122 103 149 C44 170 29 96 81 70 C138 38 153 146 91 172"/>',
 target:'<circle cx="100" cy="100" r="58"/><circle cx="100" cy="100" r="35"/><circle cx="100" cy="100" r="11"/><path d="M100 23 V66 M100 134 V177 M23 100 H66 M134 100 H177"/>',
 gate:'<path d="M48 171 V55 L100 30 L152 55 V171 M71 171 V88 L100 71 L129 88 V171 M100 86 V171"/>',
 sand:'<path d="M54 40 H146 M54 170 H146 M61 44 Q61 83 100 99 Q139 83 139 44 M61 166 Q61 128 100 105 Q139 128 139 166"/><path d="M100 100 L100 129"/>',
 furnace:'<path d="M62 164 L52 91 L71 67 H129 L148 91 L138 164Z M81 67 V46 H119 V67 M74 112 H126 M83 154 Q68 134 98 112 Q127 137 111 154"/>',
 flame:'<path d="M105 24 Q151 80 127 111 Q152 101 151 137 Q147 176 100 178 Q50 171 51 133 Q51 98 82 76 Q78 117 99 112 Q115 85 105 24Z"/><path d="M101 116 Q123 139 109 160 Q85 170 83 151Z"/>',
 wave:'<path d="M28 93 Q52 61 77 93 T127 93 T177 93 M28 126 Q52 94 77 126 T127 126 T177 126 M49 153 Q100 125 151 153"/>',
 wind:'<path d="M29 80 H130 Q161 80 150 56 Q139 39 119 54 M29 110 H153 Q179 110 169 132 Q160 147 144 133 M52 142 H111 Q134 142 120 164"/>',
 step:'<path d="M51 164 L59 107 L90 110 L102 74 L131 82 L121 121 L151 136 L140 160 L106 150 L81 179Z"/><path d="M74 58 L126 35"/>',
 fang:'<path d="M54 41 Q72 122 99 168 Q125 121 146 41 Q126 61 108 53 L100 81 L90 53 Q72 61 54 41Z"/>',
 echo:'<circle cx="100" cy="100" r="12"/><path d="M76 78 Q54 100 76 122 M124 78 Q146 100 124 122 M57 59 Q20 100 57 141 M143 59 Q180 100 143 141"/>'
};
function art(g){
 const [a,b]=schools[g.school]||["#ddc8a5","#5e5260"],k=kinds[g.kind]||"◈";
 const seed=Array.from(g.id).reduce((n,ch)=>n+ch.charCodeAt(0),0);
 const petals=Array.from({length:8},(_,i)=>`<ellipse cx="100" cy="48" rx="${10+seed%9}" ry="30" transform="rotate(${i*45} 100 100)" fill="${a}" opacity=".13"/>`).join("");
 const veins=Array.from({length:6},(_,i)=>`<path d="M100 100 Q${30+i*26} ${25+(seed%17)} ${23+i*31} 14" stroke="${a}" stroke-opacity=".32" stroke-width="1" fill="none" transform="rotate(${i*60} 100 100)"/>`).join("");
 return uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="b"><stop stop-color="${b}"/><stop offset="1" stop-color="#131b29"/></radialGradient><radialGradient id="c"><stop stop-color="${a}" stop-opacity=".55"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient></defs><rect width="200" height="200" fill="url(#b)"/><circle cx="100" cy="100" r="84" fill="none" stroke="${a}" stroke-opacity=".38"/><circle cx="100" cy="100" r="65" fill="url(#c)"/>${petals}${veins}<g fill="${a}" fill-opacity=".16" stroke="${a}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${motifShapes[motifs[g.id]]||motifShapes.echo}</g><circle cx="100" cy="100" r="7" fill="${a}" opacity=".85"/><path d="M15 45 V15 H45 M155 15 H185 V45 M15 155 V185 H45 M155 185 H185 V155" stroke="${a}" stroke-width="2" fill="none"/></svg>`);
}
const guArtCache=new Map();
function cachedArt(g){
 let result=guArtCache.get(g.id);
 if(!result){result=art(g);guArtCache.set(g.id,result)}
 return result;
}
function portrait(){
 return uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 360"><defs><linearGradient id="coat"><stop stop-color="#aab3c0"/><stop offset=".48" stop-color="#52607b"/><stop offset="1" stop-color="#1c293e"/></linearGradient><radialGradient id="glow"><stop stop-color="#f2d7b2" stop-opacity=".46"/><stop offset="1" stop-color="#f2d7b2" stop-opacity="0"/></radialGradient></defs><circle cx="150" cy="170" r="140" fill="url(#glow)"/><path d="M73 349 Q64 252 119 209 L179 207 Q238 261 226 349Z" fill="url(#coat)" stroke="#c4b5a6" stroke-width="2"/><path d="M119 210 L151 294 L180 210 L166 350 H134Z" fill="#e5d1ba" opacity=".84"/><path d="M123 74 Q147 27 186 71 Q205 102 187 204 L213 267 Q156 289 89 262 L106 181Z" fill="#151d31" stroke="#918ca2" stroke-width="2"/><path d="M115 91 Q125 67 153 66 Q189 69 189 107 L181 173 Q165 200 146 189 Q120 174 116 145Z" fill="#ead4bf"/><path d="M114 112 Q150 102 179 74 Q171 43 140 49 Q103 62 104 126Z" fill="#252a40"/><path d="M124 126 l19 -3 M160 123 l20 1" stroke="#494253" stroke-width="3"/><path d="M144 156 Q154 160 163 154" stroke="#a26970" fill="none"/><path d="M183 85 Q210 122 202 206" stroke="#a19ba9" stroke-width="8" fill="none"/><path d="M69 348 Q44 283 94 248 M230 348 Q253 284 204 249" stroke="#c2b5a2" stroke-width="18" fill="none"/><path d="M93 250 Q111 232 122 215 M209 247 Q192 231 179 214" stroke="#e8d9ba" stroke-width="4" fill="none"/><circle cx="154" cy="240" r="7" fill="#e6ca8c"/></svg>`);
}

/* Portrait fallback only for foes whose M2 template currently uses a text crest.
   Draws distinct costume/weapon silhouettes. Existing photographic PNGs remain untouched. */
function foePortrait(id){
 const profile={
  swordsman:{coat:"#61788d",edge:"#d7cfbd",weapon:"sword",hat:"topknot"},
  shadow:{coat:"#473958",edge:"#c2adce",weapon:"dagger",hat:"hood"},
  warden:{coat:"#786b59",edge:"#e4ba83",weapon:"hammer",hat:"helmet"}
 }[id];
 if(!profile)return null;
 const {coat,edge,weapon,hat}=profile;
 const head=hat==="helmet"?'<path d="M92 62 Q150 13 208 62 L213 119 L87 119Z" fill="#48505b" stroke="'+edge+'" stroke-width="4"/><path d="M120 87 H180" stroke="'+edge+'" stroke-width="5"/>':hat==="hood"?'<path d="M80 139 Q62 24 150 23 Q239 29 220 139 L194 177 L107 177Z" fill="#25283c" stroke="'+edge+'" stroke-width="3"/>':'<path d="M109 74 Q100 34 145 37 Q160 15 176 38 Q213 42 196 80 L175 107 L118 103Z" fill="#212b38" stroke="'+edge+'" stroke-width="3"/><path d="M154 37 L169 15 L182 46" stroke="'+edge+'" stroke-width="5" fill="none"/>';
 const arm=weapon==="hammer"?'<path d="M230 117 L243 305" stroke="#d5bb91" stroke-width="13"/><rect x="202" y="78" width="68" height="55" rx="8" fill="#4c5662" stroke="'+edge+'" stroke-width="5"/>':weapon==="dagger"?'<path d="M220 194 L264 123 L247 199Z" fill="#cfdbdf" stroke="'+edge+'" stroke-width="3"/>':'<path d="M220 295 L256 30 L267 12 L264 67 L233 300Z" fill="#cadce2" stroke="'+edge+'" stroke-width="3"/><path d="M206 247 L256 257" stroke="'+edge+'" stroke-width="8"/>';
 return uri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 360"><defs><radialGradient id="mist"><stop stop-color="'+edge+'" stop-opacity=".36"/><stop offset="1" stop-color="'+edge+'" stop-opacity="0"/></radialGradient></defs><circle cx="150" cy="150" r="145" fill="url(#mist)"/><path d="M76 360 Q60 233 113 203 L187 203 Q245 235 224 360Z" fill="'+coat+'" stroke="'+edge+'" stroke-width="3"/><path d="M105 213 L150 288 L194 211 M150 290 V360" stroke="'+edge+'" stroke-width="4" opacity=".75" fill="none"/><path d="M118 90 Q144 74 180 90 L190 155 Q162 205 136 186 Q107 168 111 129Z" fill="#d6bdab" stroke="#8b858a" stroke-width="2"/>'+head+'<path d="M123 132 L144 130 M161 130 L183 128" stroke="#404052" stroke-width="4"/><path d="M147 162 Q155 165 166 160" stroke="#725766" stroke-width="2" fill="none"/>'+arm+'<path d="M72 348 Q58 274 105 246 M228 348 Q237 275 194 247" stroke="'+coat+'" stroke-width="26" fill="none"/><path d="M72 346 Q58 274 105 246 M228 346 Q237 275 194 247" stroke="'+edge+'" stroke-width="2" fill="none" opacity=".7"/></svg>');
}

function decorate(){
 const app=document.getElementById("app");if(!app)return;
 for(const el of app.querySelectorAll(".shopitem:not(.placeholder),.slot,.battle-gu")){
  if(el.dataset.guPainted)return;
  const nameEl=el.querySelector(".name,.battle-gu-copy strong")||el.querySelector("b");
  const name=nameEl?.textContent?.trim()?.split(" · ")[0];
  const g=guByName.get(name);if(!g)continue;
  el.dataset.guPainted=g.id;el.dataset.guKind=g.kind;el.dataset.guSchool=g.school;
  const icon=document.createElement("span");icon.className="m2-gu-illustration";
  icon.setAttribute("aria-hidden","true");
  const tile=paintedGuTile[g.id];
  if(Number.isInteger(tile)){
    icon.classList.add("m2-r8-gu-painted");
    icon.dataset.tile=String(tile);
    icon.style.backgroundImage='url("'+guAtlasPath+'"), url("'+cachedArt(g)+'")';
  }else icon.style.backgroundImage='url("'+cachedArt(g)+'")';
  if(el.classList.contains("battle-gu"))el.querySelector(".battle-gu-glyph")?.replaceWith(icon);
  else el.insertBefore(icon,el.firstChild);
 }
 const player=app.querySelector(".player-figure");if(player&&!player.dataset.portrait){
  player.dataset.portrait="true";player.style.setProperty("--cultivator-portrait",'url("'+portrait()+'")');
 }
 if(player&&atlasReady)player.dataset.art="r8";
 const stage=app.querySelector(".combat-stage");
 const crest=stage?.querySelector(".foe-crest");
 if(crest){
   const foeId=(stage.className.match(/enemy-([a-z]+)/)||[])[1];
   const source=foePortrait(foeId);
   if(atlasReady&&["swordsman","shadow","warden"].includes(foeId)){
     const panel=document.createElement("div");
     panel.className="foe-portrait m2-r8-foe-portrait";
     panel.dataset.foe=foeId;
     panel.setAttribute("role","img");
     panel.setAttribute("aria-label",(stage.querySelector(".foe .combatant-name")?.textContent||foeId)+"人物半身插画");
     crest.replaceWith(panel);
   }else if(source){
     const img=document.createElement("img");
     img.className="foe-portrait m2-foe-fallback";
     img.alt=(stage.querySelector(".foe .combatant-name")?.textContent||foeId)+"人物剪影";
     img.src=source;
     crest.replaceWith(img);
   }
 }
 if(stage&&innerWidth<=790&&!mobileStageWasPresent)window.scrollTo({top:0,behavior:"instant"});
 mobileStageWasPresent=!!stage;
 if(stage){const event=app.querySelector(".focus-event strong")?.textContent||"";
  stage.dataset.impact=/反击|饮锋|记痕/.test(event)?"counter":/护盾|规避|吸收/.test(event)?"guard":/伤害|攻击|斩击|基础攻击|造成|灼烧/.test(event)?"strike":"idle";
 }
}
let lastCue="";
let lastBattleRef=null;
function sceneCue(app,stage){
 const message=(app.querySelector(".focus-event strong")?.textContent||"").trim();
 const currentBattle=typeof battle!=="undefined"?battle:null;
 if(currentBattle!==lastBattleRef){lastBattleRef=currentBattle;lastCue="";}
 const latestEntry=typeof log!=="undefined"&&Array.isArray(log)?log.at(-1):null;
 const cue=latestEntry||message;
 if(!message||cue===lastCue)return;
 lastCue=cue;
 const tone=/反击|饮锋|记痕/.test(message)?"counter":/护盾|规避|吸收|减伤/.test(message)?"guard":/治疗|恢复/.test(message)?"heal":/伤害|攻击|斩击|基础攻击|造成|灼烧|根刺|命中/.test(message)?"strike":"";
 if(!tone)return;
 const fx=document.createElement("div");
 fx.className="m2-scene-cue m2-cue-"+tone;
 fx.setAttribute("aria-hidden","true");
 const orb=document.createElement("i"),trace=document.createElement("b");
 fx.append(orb,trace);
 stage.appendChild(fx);
 fx.addEventListener("animationend",()=>fx.remove(),{once:true});
 if(matchMedia("(prefers-reduced-motion: reduce)").matches)fx.remove();
}
const app=document.getElementById("app");if(app){
 const observer=new MutationObserver(()=>{decorate();const stage=app.querySelector(".combat-stage");if(stage)sceneCue(app,stage)});
 observer.observe(app,{childList:true,subtree:false});decorate();
}
})();
