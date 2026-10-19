'use strict';
/* ziwei-core 安星层单元测试
   基准例：公历 1976-11-14 寅时 男 → 农历丙辰年九月廿三寅时
   期望值由 iztro 2.5.8（MIT，独立实现）排出后固化，不与本引擎共享代码。 */
const test = require('node:test');
const assert = require('node:assert');
const CORE = require('../src/core.js');

const BASE = { nianGan: '丙', nianZhi: '辰', yue: 9, ri: 23, shiZhi: '寅', sex: '男', ti: 2 };

test('安星层：五行局 / 命主 / 身主', () => {
  const c = CORE.byLunar(BASE);
  assert.equal(c.fiveElementsClass, '火六局');
  assert.equal(c.soul, '廉贞');
  assert.equal(c.body, '文昌');
});

test('安星层：十二宫齐全且地支不重复', () => {
  const c = CORE.byLunar(BASE);
  assert.equal(c.palaces.length, 12);
  assert.equal(new Set(c.palaces.map((p) => p.earthlyBranch)).size, 12);
  const names = c.palaces.map((p) => p.name);
  for (const n of ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母']) {
    assert.ok(names.includes(n), `缺宫：${n}`);
  }
});

test('安星层：命宫与身宫落支', () => {
  const c = CORE.byLunar(BASE);
  assert.equal(c.earthlyBranchOfSoulPalace, '申');
  assert.equal(c.earthlyBranchOfBodyPalace, '子');
});

test('安星层：阳年男顺行、阳年女逆行（大限方向相反）', () => {
  const m = CORE.byLunar({ ...BASE, sex: '男' });
  const f = CORE.byLunar({ ...BASE, sex: '女' });
  const at = (c, b) => c.palaces.find((p) => p.earthlyBranch === b).decadal.range;
  assert.deepEqual(at(m, '酉'), [16, 25]);
  assert.deepEqual(at(m, '未'), [116, 125]);
  assert.deepEqual(at(f, '酉'), [116, 125]);
  assert.deepEqual(at(f, '未'), [16, 25]);
});

test('安星层：四化按生年干落星（丙干 天同禄/天机权/文昌科/廉贞忌）', () => {
  const c = CORE.byLunar(BASE);
  const hua = {};
  c.palaces.forEach((p) => {
    [...p.majorStars, ...p.minorStars].forEach((s) => {
      if (s.mutagen) hua[s.mutagen] = s.name;
    });
  });
  assert.deepEqual(hua, { 禄: '天同', 权: '天机', 科: '文昌', 忌: '廉贞' });
});

test('安星层：不依赖任何第三方包', () => {
  const src = require('node:fs').readFileSync(require.resolve('../src/core.js'), 'utf8');
  assert.equal(/require\s*\(/.test(src), false, 'core.js 不应出现 require()');
});
