/* Ink specimen and portrait fallbacks. Visual-only: reads GU/GM and rendered DOM. */
(()=>{
"use strict";
const guRows=typeof GU!=="undefined"?(Array.isArray(GU)?GU:Object.values(GU)):[];
const gmRows=typeof GM!=="undefined"?(Array.isArray(GM)?GM:Object.values(GM)):[];
const byId=new Map(guRows.filter(g=>g&&g.id).map(g=>[String(g.id),g]));
const byName=new Map(guRows.filter(g=>g&&g.name).map(g=>[String(g.name).trim(),g]));
const cache=new Map();
const paintedTiles={B101:[0,0],B102:[100,0],B103:[0,100],T103:[100,100]};
let specimenAtlasReady=false;
const specimenAtlas=new Image();
specimenAtlas.onload=()=>{specimenAtlasReady=specimenAtlas.naturalWidth===1254&&specimenAtlas.naturalHeight===1254;decorate()};
specimenAtlas.onerror=()=>{specimenAtlasReady=false;decorate()};
specimenAtlas.src='assets/visual/ink_gu_specimens_v1.png';
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
const uri=s=>"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(s);
const palette={"百兵":["#d6c4a2","#342d28"],"晦明":["#d5c6a1","#302d32"],"玄牝":["#b7c7a4","#27342b"],"执枢":["#cfb4a1","#34282c"],"阖辟":["#b4c4c2","#283238"],"参同":["#d2b08b","#392b24"],"乘物":["#afc7c3","#273335"],"观复":["#c4b9a0","#302d34"]};
const idMotif={B101:"blade-mantis",B102:"beetle",B103:"blade-mantis",B201:"blade-mantis",N201:"blade-mantis",N202:"beetle",Y101:"moth",Y102:"moth",Y103:"firefly",S101:"root-worm",S102:"root-worm",S103:"root-worm",G112:"firefly"};
function motifFor(g){
 const preset=idMotif[g.id];if(preset)return preset;
 const text=[g.name,g.kind,g.school,g.use,g.effect,g.description].filter(Boolean).join(" ");
 if(/螳螂|刃|锋|刀|剑|斩|刺/.test(text))return "blade-mantis";
 if(/蛾|蝶|月|光|影|镜/.test(text))return "moth";
 if(/萤|灯|火|烛|星/.test(text))return "firefly";
 if(/根|芽|藤|木|草|露/.test(text))return "root-worm";
 if(/虫|甲|壳|盾|皮|守|御|护/.test(text))return "beetle";
 const shapes=["beetle","blade-mantis","moth","firefly","root-worm"];
 let n=0;for(const c of String(g.id||g.name))n=(n*31+c.charCodeAt(0))>>>0;
 return shapes[n%shapes.length];
}
function specimenSvg(g){
 const [ink,paper]=palette[g.school]||["#c9b99d","#302b27"],kind=motifFor(g);
 let seed=0;for(const c of String(g.id||g.name))seed=(seed*33+c.charCodeAt(0))>>>0;
 const bodies={
  "blade-mantis":'<ellipse cx="100" cy="106" rx="15" ry="31"/><path d="M91 83 69 55 84 94 50 48 77 104 41 80 79 119 M109 83 131 55 116 94 150 48 123 104 159 80 121 119 M89 132 65 157 84 136 67 177 M111 132 135 157 116 136 133 177 M96 77 80 34 M104 77 120 34"/>',
  beetle:'<path d="M100 58 Q140 58 145 104 Q146 144 100 158 Q54 144 55 104 Q60 58 100 58Z"/><path d="M100 61V155 M62 91 35 78 M58 108 29 109 M64 128 40 146 M138 91 165 78 M142 108 171 109 M136 128 160 146 M88 58Q84 38 68 30 M112 58Q116 38 132 30"/>',
  moth:'<path d="M94 94 Q59 40 29 48 Q23 91 76 111 Q31 120 40 163 Q75 164 96 124 M106 94 Q141 40 171 48 Q177 91 124 111 Q169 120 160 163 Q125 164 104 124 M100 77V145 M94 79Q84 57 77 45 M106 79Q116 57 123 45 M87 117 65 139 M113 117 135 139"/>',
  firefly:'<ellipse cx="100" cy="111" rx="24" ry="38"/><path d="M79 94 50 74 M78 111 39 111 M81 130 51 151 M121 94 150 74 M122 111 161 111 M119 130 149 151 M91 74 76 53 M109 74 124 53"/><path d="M88 127 Q100 115 112 127 Q111 145 100 150 Q89 145 88 127Z" fill="'+ink+'" stroke="none" opacity=".72"/>',
  "root-worm":'<path d="M62 146 Q45 124 67 109 Q89 94 67 78 Q50 64 65 48 Q83 33 101 50 Q121 68 102 87 Q82 107 108 119 Q133 132 119 153 Q107 171 90 159 Q76 149 83 133 M66 52 48 31 M72 48 69 25 M116 153 137 170 M120 146 148 151 M91 103 45 103 M107 119 154 103"/>'
 };
 const marks=Array.from({length:2+seed%4},(_,i)=>{const x=56+((seed>>>(i%4)*4)+i*29)%88,y=45+((seed>>>(i%5)*3)+i*23)%105;return `<path d="M${x} ${y}l${5+(seed+i)%8} ${((seed>>i)&1)?-4:4}"/>`}).join("");
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><g fill="${paper}" fill-opacity=".88" stroke="${ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${bodies[kind]}${marks}</g><g fill="${ink}"><circle cx="94" cy="72" r="3"/><circle cx="106" cy="72" r="3"/></g></svg>`;
 return uri(svg);
}
function guArt(id){const g=byId.get(String(id));if(!g)return null;const key=String(g.id)+"|"+String(g.kind||"");if(!cache.has(key))cache.set(key,specimenSvg(g));return cache.get(key)}
// Use the same art renderer in cards, tooltips and pinned recipes. Atlas tiles remain CSS crops.
function guMarkup(id){
 const tile=paintedTiles[id];
 if(specimenAtlasReady&&tile)return `<span class="specimen-art" data-art="painted" aria-hidden="true"><span class="painted-specimen" style="background-position:${tile[0]}% ${tile[1]}%"></span></span>`;
 const src=guArt(id);return src?`<span class="specimen-art" data-art="silhouette" aria-hidden="true" style="background-image:url(&quot;${esc(src)}&quot;)"></span>`:'';
}
function foeArt(id){return id==='boar'?'assets/enemies/enemy_iron_hide_boar.png':id==='rogue'?'assets/enemies/enemy_sanxiu.png':portraitSvg(id,false)}
function portraitSvg(id,isPlayer){
 const animal=/boar|豕|兽|狼|虎|熊/i.test(String(id));
 if(animal)return uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><g fill="#292722" stroke="#c6b99f" stroke-width="5" stroke-linejoin="round"><path d="M35 174 20 103 79 132 Q118 88 177 119 L242 99 226 156 Q270 183 261 257 L237 293 249 370H53L66 295Q29 259 35 174Z"/><path d="M201 191Q245 175 263 205L235 228 214 219Z" fill="#d3c2a4"/><path d="M60 370 56 327 101 327 109 370 M187 370 195 327 239 327 244 370Z"/></g><circle cx="212" cy="180" r="5" fill="#d9bb7d"/></svg>`);
 const face=isPlayer?'<path d="M127 101Q147 75 174 101L180 130 191 141 180 148 178 157Q165 178 145 168L126 145Z"/>':'<path d="M125 101Q151 72 180 100L182 130 194 141 182 148 180 157Q162 177 139 162L124 142Z"/>';
 const body=isPlayer?'<path d="M72 389Q73 245 119 190L178 185Q231 242 229 389Z"/>':'<path d="M65 389Q77 242 119 188L181 184Q232 242 236 389Z"/>';
 const transform=isPlayer?"":" transform=\"translate(300 0) scale(-1 1)\"";
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><g${transform}><g fill="#292722" stroke="#c7b89e" stroke-width="4" stroke-linejoin="round"><path d="M119 104Q116 46 155 39Q197 43 191 106L176 134 126 131Z"/>${face}${body}<path d="M120 196 150 279 180 192 M150 280V388" fill="none" stroke-width="3"/></g><path d="M142 132h6" stroke="#e0c58d" stroke-width="3"/></g></svg>`;
 return uri(svg);
}
function resolveGu(el){
 let id=el.getAttribute("data-gu-id");if(id&&byId.has(id))return byId.get(id);
 const nameEl=el.querySelector(".name,.battle-gu-copy strong,b,strong");
 const name=nameEl?.textContent?.trim()?.split(" · ")[0];return name?byName.get(name):null;
}
function decorateGu(el){
 const g=resolveGu(el);if(!g)return;
 if(el.getAttribute("data-gu-id")!==String(g.id))el.setAttribute("data-gu-id",g.id);
 let art=el.querySelector(":scope > .specimen-art");
 if(!art){art=document.createElement("span");art.className="specimen-art";art.setAttribute("aria-hidden","true");el.insertBefore(art,el.firstChild)}
 art.style.background=`center / contain no-repeat url("${guArt(g.id)}")`;
 const tile=paintedTiles[g.id];let painted=art.querySelector('.painted-specimen');
 if(specimenAtlasReady&&tile){if(!painted){painted=document.createElement('span');painted.className='painted-specimen';art.appendChild(painted)}painted.style.backgroundPosition=tile.map(n=>n+'%').join(' ');art.dataset.art='painted';art.style.backgroundImage='none';}
 else{painted?.remove();art.dataset.art='silhouette';}

}
function decoratePortraits(root){
 root.querySelectorAll("img.player-portrait,.player-figure").forEach(el=>{
  if(el.classList.contains("player-figure")&&el.querySelector("img.player-portrait"))return;
  if(el.dataset.inkPortrait)return;el.dataset.inkPortrait="true";
  const src=portraitSvg("player",true);
  if(el.tagName==="IMG"){if(!el.getAttribute("src")){el.src=src;el.alt=el.alt||"墨线蛊师剪影"}}else el.style.backgroundImage=`url("${src}")`;
 });
 root.querySelectorAll("img.foe-portrait,.foe-portrait:not(img)").forEach(el=>{
  if(el.dataset.inkPortrait)return;
  const foeId=el.dataset.foeId||el.closest("[data-foe-id]")?.dataset.foeId||el.closest(".combat-stage")?.className.match(/enemy-([\w-]+)/)?.[1];
  if(!foeId)return;
  el.dataset.foeId=foeId;el.dataset.inkPortrait="true";
  const foeName=root.querySelector(".combatant.foe .combatant-name")?.textContent?.trim()||foeId;
  if(el.tagName==="IMG"){if(!el.getAttribute("src"))el.src=portraitSvg(foeId,false);if(!el.alt)el.alt=foeName+"剪影"}else{el.style.background=`center / contain no-repeat url("${portraitSvg(foeId,false)}")`;el.setAttribute("role","img");if(!el.getAttribute("aria-label"))el.setAttribute("aria-label",foeName+"剪影")}
 });
}
function decorateLinks(root){
 const stage=root.querySelector(".combat-stage"),shell=root.querySelector(".combat-shell");if(!stage||!shell)return;
 let svg=shell.querySelector(":scope > svg.causal-link");if(!svg){svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.classList.add("causal-link");svg.setAttribute("aria-hidden","true");svg.style.cssText="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible";if(getComputedStyle(shell).position==="static")shell.style.position="relative";shell.appendChild(svg)}
 svg.replaceChildren();const event=root.querySelector(".event-strip[data-source-gu]");if(!event)return;
 const source=stage.querySelector(`.battle-gu[data-gu-id="${CSS.escape(event.dataset.sourceGu)}"]`);if(!source)return;
 const a=source.getBoundingClientRect(),b=event.getBoundingClientRect(),c=shell.getBoundingClientRect();
 const reduce=document.body?.dataset.motion==="reduce"||matchMedia("(prefers-reduced-motion: reduce)").matches;
 const path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("d",`M ${a.left-c.left+a.width/2} ${a.top-c.top+a.height/2} C ${a.right-c.left+18} ${a.top-c.top}, ${b.left-c.left-18} ${b.top-c.top+b.height/2}, ${b.left-c.left} ${b.top-c.top+b.height/2}`);path.setAttribute("fill","none");path.setAttribute("stroke","#c7b89e");path.setAttribute("stroke-width",reduce?"3":"1.5");path.setAttribute("opacity",".82");svg.appendChild(path);
}
function decorate(){
 const app=document.getElementById("app");if(!app)return;
 app.querySelectorAll("[data-gu-id],.shopitem:not(.placeholder),.gu-card,.loadout-slot,.battle-gu").forEach(decorateGu);
 decoratePortraits(app);decorateLinks(app);
}
window.InkSpecimenArt={gu:guArt,markup:guMarkup,foe:foeArt,portrait:(id,isPlayer)=>portraitSvg(id,!!isPlayer),decorate};
const app=document.getElementById("app");
if(app){decorate();new MutationObserver(()=>decorate()).observe(app,{childList:true,subtree:false})}
})();
