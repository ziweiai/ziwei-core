'use strict';
/* ziwei-core/engine 端到端测试
   20 例夹具的真值由 iztro 2.5.8 独立排出（MIT），与本引擎无代码共享。
   比对维度：农历、五行局、命主、身主、命身宫支、十二宫名/宫干/宫支、
             主星（名+亮度+四化）、辅星、杂曜（含数组顺序）、大限区间。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { bySolar, hasCalendar } = require('../src/engine.js');
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/charts.json'), 'utf8')).charts;

const slim = (s) => {
  const o = { n: s.name };
  if (s.brightness) o.b = s.brightness;
  if (s.mutagen) o.m = s.mutagen;
  return o;
};

function normalize(chart) {
  return {
    lunar: chart.lunarDate,
    fiveElementsClass: chart.fiveElementsClass,
    soul: chart.soul,
    body: chart.body,
    soulPalaceBranch: chart.earthlyBranchOfSoulPalace,
    bodyPalaceBranch: chart.earthlyBranchOfBodyPalace,
    palaces: chart.palaces.map((p) => ({
      name: p.name,
      stem: p.heavenlyStem,
      branch: p.earthlyBranch,
      major: (p.majorStars || []).map(slim),
      minor: (p.minorStars || []).map(slim),
      adj: (p.adjectiveStars || []).map((s) => s.name),
      decadal: p.decadal && p.decadal.range ? p.decadal.range : null,
    })),
  };
}

test('日期层可用（lunar-typescript 已安装）', () => {
  assert.equal(hasCalendar(), true, '请先 npm i lunar-typescript');
});

for (const c of fixtures) {
  test(`${c.id} ${c.solar} 时辰${c.timeIndex} ${c.gender}`, () => {
    const got = normalize(bySolar(c.solar, c.timeIndex, c.gender));
    assert.deepEqual(got, c.expect);
  });
}
