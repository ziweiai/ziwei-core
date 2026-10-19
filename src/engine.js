'use strict';
/* ============================================================
   ziwei-engine.js —— 自研排盘「完整引擎」（日期层 + 安星层）
   ------------------------------------------------------------
   暴露与 iztro **同签名**的 astro.bySolar / astro.byLunar / config
   → paipan-api.js 可零改动切换：engine=ziwei 时把 require('iztro') 换成本模块。

   分层：
     · 安星层 → ziwei-core.js（零依赖，已 64 年全空间对撞验收）
     · 日期层 → lunar-typescript（MIT，与 iztro 同源）—— P2 可替换为自建万年历表

   口径（与现网生产链路一致）：
     · 晚子时 timeIndex=12 → 归次日整盘（2026-10-14 裁决）
     · 闰月「日 > 15」作下月
     · 年干取农历年干支（非立春）
     · 亮度七档（BRIGHT7，与 iztro 显示一致）
   ============================================================ */
const CORE = require('./core.js');
let Solar, Lunar;
try {
  const lunar = require(process.env.LUNAR_PATH || 'lunar-typescript');
  Solar = lunar.Solar; Lunar = lunar.Lunar;
} catch (e) {
  /* 未安装 lunar-typescript 时仍可 require 本模块，仅 bySolar/byLunar 不可用 */
}
function assertDateLayer() {
  if (!Solar || !Lunar) {
    throw new Error(
      'ziwei-core/engine 需要日期层 lunar-typescript（公历↔农历换算）。\n' +
      '请执行：npm i lunar-typescript\n' +
      '若已安装仍报错，可设 LUNAR_PATH 指向自建万年历模块（需导出 { Solar, Lunar }）。\n' +
      '只做安星（不涉及公历日期）请改用零依赖的 require("ziwei-core")。'
    );
  }
}

const ZHI_STD = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SHICHEN = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];
const TI_HOUR = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
/* 月柱：五虎遁（按「闰月折算后」的农历月）—— 对齐 iztro 的 chineseDate。
   ⚠️ 斗数不取「节气月」：iztro 月柱 = 五虎遁(年干, 折算后农历月)。
   五虎遁：甲己→丙寅 / 乙庚→戊寅 / 丙辛→庚寅 / 丁壬→壬寅 / 戊癸→甲寅 */
const WUHU = { 甲: '丙', 己: '丙', 乙: '戊', 庚: '戊', 丙: '庚', 辛: '庚', 丁: '壬', 壬: '壬', 戊: '甲', 癸: '甲' };
const GAN10 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
function monthPillarOf(nianGan, yue) {
  const g = GAN10[(GAN10.indexOf(WUHU[nianGan]) + yue - 1) % 10];
  return g + ZHI_STD[(yue + 1) % 12];
}
/* 闰月折算：闰月「日 > 15」作下月（腊月闰 → 回正月） */
function effMonth(rawYue, leap, ri) { return (leap && ri > 15) ? (rawYue >= 12 ? 1 : rawYue + 1) : rawYue; }

function nextDayStr(s) {
  const p = String(s).split('-').map(Number);
  const d = new Date(Date.UTC(p[0], (p[1] || 1) - 1, p[2] || 1));
  d.setUTCDate(d.getUTCDate() + 1);
  return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate();
}
/* 农历要素 → 排盘参数（含闰月折算） */
function toArgs(e, ti, gender, extra) {
  const yue = effMonth(e.yue, e.leap, e.ri);
  return Object.assign({
    nianGan: e.nianGan, nianZhi: e.nianZhi, yue: yue, ri: e.ri, shiZhi: e.shiZhi,
    sex: (gender === 'female' ? '女' : '男'), gender: (gender === 'female' ? 'female' : 'male'),
    ti: ti, lunarText: e.lunarText, chineseDate: e.chineseDate, solarText: e.solarText
  }, extra || {});
}

/**
 * bySolar(solarDateStr, timeIndex, gender, opts) —— 与 iztro 同签名
 *   solarDateStr: '1990-6-15'（公历，允许不补零）
 *   timeIndex:    0=早子 … 11=亥，12=晚子时（→ 归次日整盘）
 *   gender:       'male' | 'female'
 *   opts:         { fixLeap?: bool(忽略，已内置), brightScheme?: 'wzt' }
 */
function bySolar(solarStr, timeIndex, gender, opts) {
  assertDateLayer();
  let s = String(solarStr);
  let ti = (timeIndex === undefined || timeIndex === null) ? 0 : Number(timeIndex);
  const o = (opts && typeof opts === 'object') ? opts : {};
  if (ti === 12) { s = nextDayStr(s); ti = 0; }             /* 晚子时归次日整盘 */
  const p = s.split('-').map(Number);
  const l = Solar.fromYmdHms(p[0], p[1], p[2], TI_HOUR[ti % 12], 0, 0).getLunar();
  const ygz = l.getYearInGanZhi();
  const rawYue = Math.abs(l.getMonth()), leap = l.getMonth() < 0, ri = l.getDay();
  const e = {
    nianGan: ygz[0], nianZhi: ygz[1],
    yue: rawYue, ri: ri, leap: leap,
    shiZhi: ZHI_STD[ti % 12],
    lunarText: l.toString(),
    chineseDate: ygz + ' ' + monthPillarOf(ygz[0], effMonth(rawYue, leap, ri)) + ' ' + l.getDayInGanZhi() + ' ' + l.getTimeInGanZhi(),
    solarText: s
  };
  const pan = CORE.byLunar(toArgs(e, ti, gender, { brightScheme: o.brightScheme }));
  return attachHoro(pan, { lunarYear: l.getYear(), month: rawYue, day: ri, leap: leap, hourZhi: ZHI_STD[ti % 12] });
}

/**
 * byLunar(lunarDateStr, timeIndex, gender, isLeap, opts) —— 与 iztro 同签名
 *   lunarDateStr: '1990-5-23'（农历年-月-日）
 */
function byLunar(lunarStr, timeIndex, gender, isLeap, opts) {
  assertDateLayer();
  const p = String(lunarStr).split('-').map(Number);
  const ti = (timeIndex === undefined || timeIndex === null) ? 0 : Number(timeIndex);
  const l = Lunar.fromYmdHms(p[0], (isLeap ? -Math.abs(p[1]) : p[1]), p[2], TI_HOUR[ti % 12], 0, 0);
  const ygz = l.getYearInGanZhi();
  const sol = l.getSolar();
  const rawYue = Math.abs(l.getMonth()), leap = l.getMonth() < 0, ri = l.getDay();
  const e = {
    nianGan: ygz[0], nianZhi: ygz[1],
    yue: rawYue, ri: ri, leap: leap,
    shiZhi: ZHI_STD[ti % 12],
    lunarText: l.toString(),
    chineseDate: ygz + ' ' + monthPillarOf(ygz[0], effMonth(rawYue, leap, ri)) + ' ' + l.getDayInGanZhi() + ' ' + l.getTimeInGanZhi(),
    solarText: sol.getYear() + '-' + sol.getMonth() + '-' + sol.getDay()
  };
  const pan = CORE.byLunar(toArgs(e, ti, gender, opts));
  return attachHoro(pan, { lunarYear: l.getYear(), month: rawYue, day: ri, leap: leap, hourZhi: ZHI_STD[ti % 12] });
}

/* ══════════════════════════════════════════════════════════════
   运限层包装 —— 与 iztro 同签名：astrolabe.horoscope(targetDate, timeIndex)
   ──────────────────────────────────────────────────────────────
   生产调用形态（paipan-api.js）：
     const hs = result.horoscope(new Date(Date.UTC(ly, lm-1, lday)), luckTi)
   本函数按「北京时间日期」取目标农历（生产传的即为 UTC 当日 00:00 → 日期一致）。
   ============================================================== */
function attachHoro(pan, birth) {
  pan.horoscope = function (targetDate, timeIndex) {
    const t = (targetDate instanceof Date) ? targetDate : new Date(targetDate);
    const ty = t.getUTCFullYear(), tm = t.getUTCMonth() + 1, td = t.getUTCDate();
    const ti = (timeIndex === undefined || timeIndex === null || timeIndex === '')
      ? 0 : Math.max(0, Math.min(12, parseInt(timeIndex, 10) || 0));
    /* ⚠️ 两个 lunar 对象不可混用（严格对齐 iztro）：
       ① tld —— 纯日期（0 时）取「农历年/月/日」，用于流月/流日 index 与虚岁
          （iztro 用 solar2lunar，不吃时辰；否则 23:xx 会被算成次日，整体错一天）
       ② tl  —— 带时辰（lunar-lite 同款 hour = max(ti*2-1,0), 分 = 30）取四柱
          （日柱/时柱必须走 Exact 口径 = 晚子时换日） */
    const tiHour = Math.max(ti * 2 - 1, 0);
    const tld = Solar.fromYmd(ty, tm, td).getLunar();
    const tl = Solar.fromYmdHms(ty, tm, td, tiHour, 30, 0).getLunar();
    const tGz = tl.getYearInGanZhi();
    const tRawYue = Math.abs(tld.getMonth()), tLeap = tld.getMonth() < 0, tRi = tld.getDay();
    const mYue = Math.abs(tl.getMonth()), mLeap = tl.getMonth() < 0, mRi = tl.getDay();
    const mp = monthPillarOf(tGz[0], effMonth(mYue, mLeap, mRi));
    const dp = tl.getDayGanExact() + tl.getDayZhiExact();
    const hp = tl.getTimeGan() + tl.getTimeZhi();
    const ctx = {
      nominalAge: tld.getYear() - birth.lunarYear + 1,     /* 虚岁（自然年为界）*/
      birthMonth: birth.month, birthDay: birth.day, birthLeap: birth.leap, birthHourZhi: birth.hourZhi,
      targetMonth: tRawYue, targetDay: tRi, targetLeap: tLeap,
      yearly: [tGz[0], tGz[1]],
      monthly: [mp[0], mp[1]],
      daily: [dp[0], dp[1]],
      hourly: [hp[0], hp[1]]
    };
    return CORE.horoscopeOf(pan, ctx);
  };
  return pan;
}

/* 与 iztro 用法保持一致的导出形态 */
const astro = { bySolar, byLunar };
function config() { return { _engine: 'ziwei-engine/1.0' }; }   /* iztro 兼容占位 */

module.exports = { astro, bySolar, byLunar, config, core: CORE, hasCalendar: () => Boolean(Solar) };

if (require.main === module) {
  const a = bySolar('1990-6-15', 6, 'male');
  console.log('ziwei-engine 自检：', a.solarDate, a.lunarDate, a.chineseDate, a.fiveElementsClass,
    '命宫' + a.earthlyBranchOfSoulPalace, '紫微@' + (() => { let z = ''; a.palaces.forEach(p => p.majorStars.forEach(s => { if (s.name === '紫微') z = p.earthlyBranch; })); return z; })());
}
