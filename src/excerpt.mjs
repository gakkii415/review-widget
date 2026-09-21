/** Preserve a useful, verbatim opening; never shorten it to fit an iframe. */
export function reviewExcerpt(value) {
  const text=String(value||'').trim();
  if(text.length<=600)return {text,truncated:false};
  const ends=[...text.matchAll(/[.!?]["”’')\]]*(?=\s|$)/g)].map(m=>m.index+m[0].length);
  // Prefer the first complete sentence ending after a substantial opening.
  let end=ends.find(n=>n>=380&&n<=700);
  if(end===undefined){
    end=text.lastIndexOf(' ',520);
    if(end<300)end=text.indexOf(' ',520);
    if(end<0)end=text.length; // Do not split an unbroken word or identifier.
  }
  const truncated=end<text.length;
  return {text:text.slice(0,end).trimEnd()+(truncated?' …':''),truncated};
}
