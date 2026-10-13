/* Visual-only M2 decorator. Reads rendered text; never modifies state, rules or handlers. */
(()=>{
"use strict";
const schools={"百兵":["#bfa9f0","#514b85"],"晦明":["#e6c38b","#605078"],"玄牝":["#9fcba8","#345d59"],"执枢":["#eab1a8","#663f55"],"阖辟":["#9dc9d8","#355a75"],"参同":["#e9b17c","#895242"],"乘物":["#add7d6","#416b78"],"观复":["#c5b8e6","#5b4d81"]};
const kinds={"攻":"✦","防":"◇","标":"◎","疗":"✿","辅":"◈","反":"❖","察":"◉"};
const guData=typeof GU!=="undefined"?GU:[];
const guByName=new Map(guData.map(g=>[g.name,g]));
const uri=s=>"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(s);
function art(g){
 const [a,b]=schools[g.school]||["#ddc8a5","#5e5260"],k=kinds[g.kind]||"◈";
 const seed=Array.from(g.id).reduce((n,ch)=>n+ch.charCodeAt(0),0);
 const petals=Array.from({length:8},(_,i)=>`<ellipse cx="100" cy="48" rx="${10+seed%9}" ry="30" transform="rotate(${i*45} 100 100)" fill="${a}" opacity=".13"/>`).join("");
 const veins=Array.from({length:6},(_,i)=>`<path d="M100 100 Q${30+i*26} ${25+(seed%17)} ${23+i*31} 14" stroke="${a}" stroke-opacity=".32" stroke-width="1" fill="none" transform="rotate(${i*60} 100 100)"/>`).join("");
 return uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="b"><stop stop-color="${b}"/><stop offset="1" stop-color="#131b29"/></radialGradient><radialGradient id="c"><stop stop-color="${a}" stop-opacity=".55"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient></defs><rect width="200" height="200" fill="url(#b)"/><circle cx="100" cy="100" r="84" fill="none" stroke="${a}" stroke-opacity=".38"/><circle cx="100" cy="100" r="65" fill="url(#c)"/>${petals}${veins}<path d="M100 42 C70 74 70 132 100 158 C130 132 130 74 100 42Z" fill="#111e2d" stroke="${a}" stroke-width="2.4"/><path d="M100 50 V151 M100 73 Q76 63 65 46 M100 73 Q124 63 135 46 M100 112 Q69 107 56 128 M100 112 Q131 107 144 128" stroke="${a}" stroke-width="2" fill="none"/><circle cx="100" cy="98" r="15" fill="${a}" opacity=".88"/><text x="100" y="108" text-anchor="middle" font-size="21" fill="#192430">${k}</text><path d="M15 45 V15 H45 M155 15 H185 V45 M15 155 V185 H45 M155 185 H185 V155" stroke="${a}" stroke-width="2" fill="none"/></svg>`);
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
