/* Visual-only M2 decorator. Reads rendered text; never modifies state, rules or handlers. */
(()=>{
"use strict";
const schools={"百兵":["#bfa9f0","#514b85"],"晦明":["#e6c38b","#605078"],"玄牝":["#9fcba8","#345d59"],"执枢":["#eab1a8","#663f55"],"阖辟":["#9dc9d8","#355a75"],"参同":["#e9b17c","#895242"],"乘物":["#add7d6","#416b78"],"观复":["#c5b8e6","#5b4d81"]};
const kinds={"攻":"✦","防":"◇","标":"◎","疗":"✿","辅":"◈","反":"❖","察":"◉"};
const guData=typeof GU!=="undefined"?GU:[];
const guByName=new Map(guData.map(g=>[g.name,g]));
const uri=s=>"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(s);
// Distinct silhouettes by actual Gu ID; illustrative vocabulary only, not new rules.
const motifs={
 B101:"blade",B102:"shield",B103:"blade",Y101:"moth",Y102:"mirror",Y103:"lantern",
 S101:"sprout",S102:"tree",S103:"drop",Z101:"eye",Z102:"chain",Z103:"knot",
 H101:"eye",H102:"target",H103:"gate",T101:"sand",T102:"furnace",T103:"flame",
 M101:"wave",M102:"wind",M103:"step",N201:"blade",N202:"fang",
 G101:"eye",G102:"shield",G103:"echo"
};
const motifShapes={
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
function portrait(){
 return uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 360"><defs><linearGradient id="coat"><stop stop-color="#aab3c0"/><stop offset=".48" stop-color="#52607b"/><stop offset="1" stop-color="#1c293e"/></linearGradient><radialGradient id="glow"><stop stop-color="#f2d7b2" stop-opacity=".46"/><stop offset="1" stop-color="#f2d7b2" stop-opacity="0"/></radialGradient></defs><circle cx="150" cy="170" r="140" fill="url(#glow)"/><path d="M73 349 Q64 252 119 209 L179 207 Q238 261 226 349Z" fill="url(#coat)" stroke="#c4b5a6" stroke-width="2"/><path d="M119 210 L151 294 L180 210 L166 350 H134Z" fill="#e5d1ba" opacity=".84"/><path d="M123 74 Q147 27 186 71 Q205 102 187 204 L213 267 Q156 289 89 262 L106 181Z" fill="#151d31" stroke="#918ca2" stroke-width="2"/><path d="M115 91 Q125 67 153 66 Q189 69 189 107 L181 173 Q165 200 146 189 Q120 174 116 145Z" fill="#ead4bf"/><path d="M114 112 Q150 102 179 74 Q171 43 140 49 Q103 62 104 126Z" fill="#252a40"/><path d="M124 126 l19 -3 M160 123 l20 1" stroke="#494253" stroke-width="3"/><path d="M144 156 Q154 160 163 154" stroke="#a26970" fill="none"/><path d="M183 85 Q210 122 202 206" stroke="#a19ba9" stroke-width="8" fill="none"/><path d="M69 348 Q44 283 94 248 M230 348 Q253 284 204 249" stroke="#c2b5a2" stroke-width="18" fill="none"/><path d="M93 250 Q111 232 122 215 M209 247 Q192 231 179 214" stroke="#e8d9ba" stroke-width="4" fill="none"/><circle cx="154" cy="240" r="7" fill="#e6ca8c"/></svg>`);
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
  icon.setAttribute("aria-hidden","true");icon.style.backgroundImage='url("'+art(g)+'")';
  if(el.classList.contains("battle-gu"))el.querySelector(".battle-gu-glyph")?.replaceWith(icon);
  else el.insertBefore(icon,el.firstChild);
 }
 const player=app.querySelector(".player-figure");if(player&&!player.dataset.portrait){
  player.dataset.portrait="true";player.style.setProperty("--cultivator-portrait",'url("'+portrait()+'")');
 }
 const stage=app.querySelector(".combat-stage");
 if(stage&&innerWidth<=790&&!stage.dataset.visualEntered){stage.dataset.visualEntered="1";window.scrollTo({top:0,behavior:"instant"});}
 if(stage){const event=app.querySelector(".focus-event strong")?.textContent||"";
  stage.dataset.impact=/反击|饮锋|记痕/.test(event)?"counter":/护盾|规避|吸收/.test(event)?"guard":/伤害|攻击|斩击|基础攻击|造成|灼烧/.test(event)?"strike":"idle";
 }
}
let lastCue="";
function sceneCue(app,stage){
 const message=(app.querySelector(".focus-event strong")?.textContent||"").trim();
 const stamp=(app.querySelector(".battle-clock")?.textContent||"").trim();
 const cue=stamp+"|"+message;
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
}
const app=document.getElementById("app");if(app){
 const observer=new MutationObserver(()=>{decorate();const stage=app.querySelector(".combat-stage");if(stage)sceneCue(app,stage)});
 observer.observe(app,{childList:true,subtree:false});decorate();
}
})();
