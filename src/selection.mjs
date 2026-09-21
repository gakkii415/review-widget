import {francAll} from 'franc-min';

export function originalText(value) {
  const text=String(value||'').trim();
  const marker=/\n\s*\(Original\)\s*\n/i.exec(text);
  return marker ? text.slice(marker.index+marker[0].length).trim() : text;
}
const enWords=new Set('the and was were with this very my your our their have had would could she his her they you from that which wonderful amazing excellent great tattoo experience professional friendly clean recommend'.split(' '));
const foreignWords=new Set('le les des une et est très pour avec nous vous los las muy para que fue pero und der die das ist sehr für mit ich wir gli molto che sono het een voor maar heel'.split(' '));
export function isEnglish(value) {
  const text=originalText(value);
  if(!text) return false;
  const letters=text.match(/\p{L}/gu)||[];
  const other=text.match(/[^\p{Script=Latin}\P{L}]/gu)||[];
  if(!letters.length || other.length/letters.length>0.03) return false;
  const words=text.toLowerCase().match(/[a-zà-öø-ÿ]+/g)||[];
  const en=words.filter(x=>enWords.has(x)).length;
  const foreign=words.filter(x=>foreignWords.has(x)).length;
  if(foreign>=2 && foreign>=en/2) return false;
  if(text.length<80) {
    // Shared single-word praise cannot establish the original language.
    if(words.length===1 && ['excellent','perfect','super','fantastic'].includes(words[0])) return false;
    if(/^(?:(?:absolutely |really |very )?(?:great|amazing|excellent|wonderful|perfect|beautiful|fantastic|lovely)(?: tattoos?| work| experience| service| artist| design| studio)?[.!\s]*)+$/i.test(text)) return true;
    if(en<2) return false;
  }
  const ranked=francAll(text,{minLength:20});
  return ranked[0]?.[0]==='eng' && (text.length>=80 || en>=2);
}
const groups=[
 ['design',/\b(design|custom|linework|shading|detail|drawing|result|colour|color)\w*\b/i],
 ['communication',/\b(english|communicat\w*|explain\w*|understand\w*|language|responsive)\b/i],
 ['care',/\b(comfortable|gentle|patient|nervous|pain|first tattoo|first time|relax\w*)\b/i],
 ['cleanliness',/\b(clean|hygien\w*|sterile|safe|private|professional)\b/i],
 ['travel',/\b(kyoto|japan|trip|travel\w*|vacation|station|location)\b/i],
 ['process',/\b(booking|appointment|aftercare|session|process|hour|time)\w*\b/i]
];
export const topics=text=>groups.filter(([,re])=>re.test(text)).map(([name])=>name);
const dateValue=r=>Number.isFinite(Date.parse(r.createTime))?Date.parse(r.createTime):0;
export const newest=(a,b)=>dateValue(b)-dateValue(a)||a.id.localeCompare(b.id);
export function score(review,now=Date.now()) {
 const n=review.text.length;
 const length=n>=120&&n<=520?24:n>=60&&n<=900?15:n>=35&&n<=1400?7:0;
 const age=(now-dateValue(review))/86400000;
 return Math.min(topics(review.text).length,5)*12+length+(age<=180?4:age<=365?2:0)+(/\b\d+\s*(hours?|minutes?)\b/i.test(review.text)?4:0);
}
function similarity(a,b) {
 const tokenize=t=>new Set((t.toLowerCase().match(/[a-z]{3,}/g)||[]).filter(w=>!['the','and','was','very','with','this','that'].includes(w)));
 const x=tokenize(a.text),y=tokenize(b.text);
 const common=[...x].filter(w=>y.has(w)).length;
 return common/Math.max(1,x.size+y.size-common);
}
export function selectReviews(raw,pinned=[],now=Date.now()) {
 const ids=new Set();
 const eligible=(Array.isArray(raw)?raw:[]).filter(r=>{
   if(Number(r.rating)!==5 || !r.id || ids.has(String(r.id))) return false;
   ids.add(String(r.id));return isEnglish(r.text);
 }).map(r=>({...r,id:String(r.id),text:originalText(r.text)}));
 const pinIndex=new Map(pinned.map((id,i)=>[String(id),i]));
 const selected=eligible.filter(r=>pinIndex.has(r.id)).sort((a,b)=>pinIndex.get(a.id)-pinIndex.get(b.id));
 const recent=eligible.filter(r=>now-dateValue(r)<=540*86400000);
 const candidates=(recent.length>=8?recent:eligible).filter(r=>!pinIndex.has(r.id));
 // Pick a diverse lead group; afterwards retain all eligible reviews, newest first.
 while(candidates.length && selected.length<5) {
   let best=0,bestValue=-Infinity;
   candidates.forEach((r,i)=>{
     const rt=topics(r.text);
     const penalty=selected.length?Math.max(...selected.map(s=>similarity(r,s)*25+rt.filter(t=>topics(s.text).includes(t)).length*5)):0;
     const value=score(r,now)-penalty;
     if(value>bestValue || (value===bestValue && newest(r,candidates[best])<0)){best=i;bestValue=value;}
   });
   selected.push(candidates.splice(best,1)[0]);
 }
 const lead=new Set(selected.map(r=>r.id));
 return selected.concat(eligible.filter(r=>!lead.has(r.id)).sort(newest));
}
