import test from 'node:test';
import assert from 'node:assert/strict';
import {isEnglish} from '../src/selection.mjs';
test('Shared single-word praise is too ambiguous to label English',()=>{
 for(const text of ['Excellent!','Perfect!','Super!','Fantastic!']) assert.equal(isEnglish(text),false,text);
 assert.equal(isEnglish('Excellent work!'),true);
 assert.equal(isEnglish('Great tattoo!'),true);
});
