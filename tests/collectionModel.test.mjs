import test from 'node:test';
import assert from 'node:assert/strict';
import { photoCount, offerCount, keepCount, applyTrade, anniversaryInfo, daysToAnniversary, supportingDays } from '../js/collectionModel.js';

test('legacy records remain readable; duplicates are not automatically offered', () => {
  assert.equal(photoCount({status:'所持'}), 1);
  assert.equal(photoCount({status:'未所持'}), 0);
  assert.equal(offerCount({count:3}), 0);
});
test('an unequal exchange updates owned, offered, wanted without mutating the originals', () => {
  const original = [{id:'a', count:4, offer:2, want:0}, {id:'b', count:0, offer:0, want:3}];
  const result = applyTrade(original, [{id:'a', give:2, receive:0}, {id:'b', give:0, receive:1}]);
  assert.deepEqual(result.map(({count,offer,want}) => [count,offer,want]), [[2,0,0],[1,0,2]]);
  assert.equal(original[0].count,4);
  assert.equal(keepCount(result[0]),keepCount(original[0]));
  assert.equal(keepCount(result[1]),1);
});
test('overcommitted, fractional, negative and one-sided trades are rejected', () => {
  const photos = [{id:'a',count:3,offer:1},{id:'b',count:0}];
  for (const give of [2,0.5,-1,NaN]) assert.throws(() => applyTrade(photos,[{id:'a',give,receive:1}]));
  assert.throws(() => applyTrade(photos,[{id:'a',give:1,receive:0}]));
  assert.throws(() => applyTrade(photos,[]));
  assert.equal(photos[0].count,3);
});
test('anniversaries use calendar days and include today / upcoming anniversaries', () => {
  assert.equal(anniversaryInfo('2025-11-01',new Date(2026,9,30)), '363日目 · 1周年まであと2日');
  assert.equal(anniversaryInfo('2025-10-30',new Date(2026,9,30)), '365日目 · 1周年まであと0日');
  assert.equal(anniversaryInfo('2026-11-01',new Date(2026,9,30)), 'あと2日');
  assert.equal(daysToAnniversary('2025-11-01',new Date(2026,9,30)),2);
  assert.equal(daysToAnniversary('2027-11-01',new Date(2026,9,30)),Infinity);
});

test('favorite day count starts at day one and rejects invalid or future dates', () => {
  assert.equal(supportingDays('2026-10-30', new Date(2026,9,30)),1);
  assert.equal(supportingDays('2026-10-29', new Date(2026,9,30)),2);
  assert.equal(supportingDays('2025-10-30', new Date(2026,9,30)),366);
  assert.equal(supportingDays('2026-10-31', new Date(2026,9,30)),null);
  assert.equal(supportingDays('2026-02-30', new Date(2026,9,30)),null);
  assert.equal(supportingDays(undefined),null);
});
