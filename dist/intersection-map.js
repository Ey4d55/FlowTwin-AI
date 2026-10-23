(function(root){
 'use strict';
 const arrow={straight:'M-12 0H9L3-5M9 0L3 5',left:'M-12 0H0V-10L-5-5M0-10L5-5',right:'M-12 0H0V10L-5 5M0 10L5 5'};
 function signalPosition(lane){const a=TrafficEngine.lanes[lane].approach,m=lane%3;return [[266+m*27,366],[550+m*27,144],[264+m*27,128],[554+m*27,378]][a];}
 function svg(lang){
  const r=TrafficEngine.road,ar=lang==='ar',names=ar?['الغرب','الشرق','الشمال','الجنوب']:['WEST','EAST','NORTH','SOUTH'];
  let s=`<title id="map-title">${ar?'تقاطع بمسارات منفصلة وإشارات محمية لكل حركة':'Intersection with dedicated lanes and protected movement signals'}</title><desc id="map-desc">${ar?'ثلاثة مسارات دخول لكل اتجاه: يسار، مستقيم، يمين. الإشارات تعرض الإذن الفعلي للمحرك.':'Three inbound lanes per approach: left, through and right. Signals show actual engine permissions.'}</desc><rect width="900" height="530" fill="#14272c"/>`;
  for(const [x,y,w,h]of [[30,28,298,107],[568,28,300,80],[30,407,300,90],[657,399,210,98]])s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#1a3033" stroke="#35504d"/><path d="M${x+14} ${y+14}H${x+w-14}V${y+h-14}H${x+14}Z" fill="none" stroke="#2b4443"/>`;
  s+=`<path d="M0 ${r.top}H${r.left}V0H${r.right}V${r.top}H900V${r.bottom}H${r.right}V530H${r.left}V${r.bottom}H0Z" fill="#35474a"/><path d="M0 ${r.top-5}H${r.left-5}V0M${r.right+5} 0V${r.top-5}H900M900 ${r.bottom+5}H${r.right+5}V530M${r.left-5} 530V${r.bottom+5}H0" fill="none" stroke="#879385" stroke-width="3"/>`;
  // Lane separators stop at the crossing; no decorative lanes without a model lane.
  for(const x of [400,424,476,500])s+=`<path d="M${x} 0V166M${x} 374V530" stroke="#adb8a9" stroke-width="1" stroke-dasharray="10 10" opacity=".6"/>`;
  for(const y of [220,244,296,320])s+=`<path d="M0 ${y}H346M554 ${y}H900" stroke="#adb8a9" stroke-width="1" stroke-dasharray="10 10" opacity=".6"/>`;
  s+=`<path d="M448 0V168M452 0V168M448 372V530M452 372V530M0 268H348M0 272H348M552 268H900M552 272H900" stroke="#d4bb7d" stroke-width="1.3" fill="none"/>`;
  for(let i=0;i<6;i++)s+=`<rect x="${378+i*25}" y="177" width="15" height="8" fill="#d9dfcf" opacity=".75"/><rect x="${378+i*25}" y="355" width="15" height="8" fill="#d9dfcf" opacity=".75"/><rect x="355" y="${198+i*25}" width="8" height="15" fill="#d9dfcf" opacity=".75"/><rect x="537" y="${198+i*25}" width="8" height="15" fill="#d9dfcf" opacity=".75"/>`;
  s+=`<path d="M350 276V344M550 196V264M376 170H444M456 370H524" stroke="#f2ebd2" stroke-width="4" fill="none"/>`;
  for(const lane of TrafficEngine.lanes){const [x,y]=lane.xy(lane.stop-45);s+=`<path d="${arrow[lane.movement]}" transform="translate(${x} ${y}) rotate(${lane.angle})" stroke="#d8e0cd" stroke-width="2" fill="none" opacity=".85"/>`;}
  s+=`<text x="210" y="160" fill="#d5dfcc" font-size="11">${names[2]}</text><text x="659" y="172" fill="#d5dfcc" font-size="11">${names[1]}</text><text x="658" y="401" fill="#d5dfcc" font-size="11">${names[3]}</text><text x="190" y="390" fill="#d5dfcc" font-size="11">${names[0]}</text>`;
  return s;
 }
 root.junctionStageName=(i,lang)=>{const s=TrafficEngine.stages[i];return lang==='ar'?(s.group==='NS'?'شمال–جنوب':'شرق–غرب')+' · '+(s.left?'يسار محمي':'مستقيم ويمين'):(s.group==='NS'?'North–south':'East–west')+' · '+(s.left?'protected left':'through & right');};
 root.IntersectionMap={svg,signalPosition};
})(window);
