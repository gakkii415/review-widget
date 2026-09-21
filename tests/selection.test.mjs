import test from 'node:test';
import assert from 'node:assert/strict';
import {isEnglish,originalText,selectReviews} from '../src/selection.mjs';
const english='This was my first tattoo and I was nervous, but the artist explained the design in English and made me feel comfortable. The studio was clean and the result was wonderful.';
const french='Le studio est très propre et le tatoueur est très gentil. Nous avons passé un excellent moment et nous recommandons ce studio pour un beau tatouage.';
const review=(id,text=english,createTime='2026-09-15T00:00:00Z',rating=5)=>({id,text,createTime,rating,reviewerName:'Synthetic fixture'});
test('English originals only',()=>{
 assert.equal(isEnglish(english),true);assert.equal(isEnglish('Great tattoo!'),true);
 for(const text of [french,'とても丁寧で綺麗なスタジオでした。ありがとうございました。','','★★★★★','Super'])assert.equal(isEnglish(text),false);
 assert.equal(originalText(english+'\n(Original)\n'+french),french);
 assert.equal(isEnglish(english+'\n(Original)\n'+french),false);
});
test('Five stars, deduplicated, newest first; length and obsolete pins cannot reorder',()=>{
 const result=selectReviews([review('older'),review('new','Great tattoo!','2026-09-20T00:00:00Z'),review('older'),review('four',english,undefined,4),review('fr',french)],['older']);
 assert.deepEqual(result.map(r=>r.id),['new','older']);
});
test('Old but current valid reviews remain for View More; removed reviews do not',()=>{
 const first=selectReviews([review('still-here',english,'2020-01-01T00:00:00Z'),review('removed')]);
 const second=selectReviews([review('still-here',english,'2020-01-01T00:00:00Z'),review('new',english,'2026-09-20T00:00:00Z')]);
 assert.equal(first.length,2);assert.deepEqual(second.map(r=>r.id),['new','still-here']);
});
