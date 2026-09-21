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
const dateValue=r=>Number.isFinite(Date.parse(r.createTime))?Date.parse(r.createTime):0;
export const newest=(a,b)=>dateValue(b)-dateValue(a)||a.id.localeCompare(b.id);
export function selectReviews(raw) {
 const ids=new Set();
 return (Array.isArray(raw)?raw:[]).filter(r=>{
   if(Number(r.rating)!==5 || !r.id || ids.has(String(r.id))) return false;
   ids.add(String(r.id));return isEnglish(r.text);
 }).map(r=>({...r,id:String(r.id),text:originalText(r.text)})).sort(newest);
}
