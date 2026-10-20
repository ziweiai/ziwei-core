'use strict';
/* ============================================================
   ziwei-core.js —— 自研紫微斗数排盘引擎 · 安星层 v1.0
   ------------------------------------------------------------
   依据：表驱动安星数据表（十二宫 / 十四主星 / 辅星杂曜 / 四化 /
         五行局 / 大限），逐表校对后以零依赖代码固化。
   定位：可独立使用的排盘内核；iztro 2.5.8 作为验证器（逐字段对撞）。
   输出：与 iztro Astrolabe **同构** —— 可直接替换其返回结构。

   ── 相对蓝本的口径修正（3 处）──
     ① 癸干化科 = 太阴
        （蓝本 $sihua[2][9] 写「太阳」＝笔误；标准为太阴，本站 iztro 正确）
     ② 截路空亡 拆两颗：截路＝首支 / 空亡＝次支（与 iztro 对齐）
        （蓝本「截空」只放一颗、随干在"甲乙对"中的先后取首/次）
     ③ 星曜分组按 iztro 三分（major / minor / adjective），
        蓝本独有的「月马、龙德、大耗、劫煞」归入 _extraStars（不参与契约）

   ── 已知口径（保留）──
     · 闰月安星：闰月「日 > 15」视作下月
       （蓝本 `if($ri_k>15) $yue_k+=1` ＝ iztro fixLeap 默认，两者一致）
     · 晚子时（timeIndex = 12）：归次日整盘
       （本项目口径：晚子时不前移、整盘归次日，与紫微斗数主流通书一致）
     · 年干取「农历年干支」（非立春），与 iztro yearDivide='normal' 一致

   ── 索引约定 ──
     地支 DIZHI：0=寅 … 10=子 11=丑（寅起，与蓝本表一致）
     天干 TIANGAN：0=甲 … 9=癸
     宫位 index：0=寅 …（与 iztro palace.index 一致）
   ============================================================ */

/* ============================ 基础常量 ============================ */
const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DIZHI = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];  /* 寅起 */
const ZHI_STD = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']; /* 标准序（时支名） */
const GANZHILI = ('甲子,乙丑,丙寅,丁卯,戊辰,己巳,庚午,辛未,壬申,癸酉,甲戌,乙亥,丙子,丁丑,戊寅,己卯,庚辰,辛巳,壬午,癸未,甲申,乙酉,丙戌,丁亥,戊子,己丑,庚寅,辛卯,壬辰,癸巳,甲午,乙未,丙申,丁酉,戊戌,己亥,庚子,辛丑,壬寅,癸卯,甲辰,乙巳,丙午,丁未,戊申,己酉,庚戌,辛亥,壬子,癸丑,甲寅,乙卯,丙辰,丁巳,戊午,己未,庚申,辛酉,壬戌,癸亥').split(',');
const SHICHEN = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];

/* 时支（标准序索引）= timeIndex(0..11) ；timeIndex=12 晚子时另处理 */
const TI_TO_SHICHEN = (ti) => SHICHEN[ti % 12];
const TI_TO_ZHI = (ti) => ZHI_STD[ti % 12];               /* 标准序地支名 */
const TI_TO_SK = (ti) => DIZHI.indexOf(ZHI_STD[ti % 12]); /* 寅起索引：子→10 丑→11 寅→0 … */
/* timeIndex → 用于算时柱的钟点（仅取时柱，斗数只看时辰） */
const TI_TO_HOUR = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 0];

const zhiIdx = (b) => DIZHI.indexOf(b);
const ganIdx = (g) => TIANGAN.indexOf(g);

/* ============================ 安星数据表（照搬紫微堂） ============================ */
/* 星曜索引（70 颗；索引即贯穿全表的星 ID） */
const XINGYAO = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
  '左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存', '擎羊', '陀罗', '火星', '铃星', '地空', '地劫', '天马',
  '三台', '八座', '恩光', '天贵', '龙池', '凤阁', '台辅', '封诰', '天官', '天福', '天才', '天寿', '天厨', '天德', '月德', '龙德',
  '红鸾', '天喜', '解神', '天巫', '华盖', '天姚', '咸池', '大耗', '天刑', '孤辰', '寡宿', '天哭', '天虚', '天伤', '天使', '天月',
  '阴煞', '劫煞', '蜚廉', '破碎', '截空', '旬空', '天空', '年解', '年马'];

/* 十二宫天干：GANZHI[年干][宫位(0=寅)] → 天干索引 */
const GANZHI = {
  甲: [2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3], 乙: [4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5],
  丙: [6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7], 丁: [8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  戊: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1], 己: [2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3],
  庚: [4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5], 辛: [6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7],
  壬: [8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 癸: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1]
};
/* 五行局：WUXING[年干][命宫] → 局数 */
const WUXING = {
  甲: [6, 6, 3, 3, 5, 5, 4, 4, 6, 6, 2, 2], 乙: [5, 5, 4, 4, 3, 3, 2, 2, 5, 5, 6, 6],
  丙: [3, 3, 2, 2, 4, 4, 6, 6, 3, 3, 5, 5], 丁: [4, 4, 6, 6, 2, 2, 5, 5, 4, 4, 3, 3],
  戊: [2, 2, 5, 5, 6, 6, 3, 3, 2, 2, 4, 4], 己: [6, 6, 3, 3, 5, 5, 4, 4, 6, 6, 2, 2],
  庚: [5, 5, 4, 4, 3, 3, 2, 2, 5, 5, 6, 6], 辛: [3, 3, 2, 2, 4, 4, 6, 6, 3, 3, 5, 5],
  壬: [4, 4, 6, 6, 2, 2, 5, 5, 4, 4, 3, 3], 癸: [2, 2, 5, 5, 6, 6, 3, 3, 2, 2, 4, 4]
};
const WXJ = { 2: '水二局', 3: '木三局', 4: '金四局', 5: '土五局', 6: '火六局' };

/* 命宫/身宫：MING[月][时支索引(寅起)] */
const MING = {
  1: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 11], 2: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  3: [0, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 4: [1, 0, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  5: [2, 1, 0, 11, 10, 9, 8, 7, 6, 5, 4, 3], 6: [3, 2, 1, 0, 11, 10, 9, 8, 7, 6, 5, 4],
  7: [4, 3, 2, 1, 0, 11, 10, 9, 8, 7, 6, 5], 8: [5, 4, 3, 2, 1, 0, 11, 10, 9, 8, 7, 6],
  9: [6, 5, 4, 3, 2, 1, 0, 11, 10, 9, 8, 7], 10: [7, 6, 5, 4, 3, 2, 1, 0, 11, 10, 9, 8],
  11: [8, 7, 6, 5, 4, 3, 2, 1, 0, 11, 10, 9], 12: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 11, 10]
};
const SHEN = {
  1: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1], 2: [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2],
  3: [4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3], 4: [5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4],
  5: [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5], 6: [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6],
  7: [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7], 8: [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8],
  9: [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 10: [11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  11: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 12: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0]
};
/* 十二宫名：自命宫起、沿地支递增方向顺排「父福田官友迁疾财子夫兄」
   （＝标准序「命兄妻子财疾迁友官田福父」沿地支递减）
   三方印证：紫微堂渲染盘 / 文墨天机截图 / iztro PALACES 常量 —— 三者一字不差 */
const SG_BASE = ['命宫', '父母宫', '福德宫', '田宅宫', '官禄宫', '交友宫', '迁移宫', '疾厄宫', '财帛宫', '子女宫', '夫妻宫', '兄弟宫'];
const SHIER = [];
for (let mg = 0; mg < 12; mg++) { const r = []; for (let i = 0; i < 12; i++) r.push(SG_BASE[(i - mg + 12) % 12]); SHIER.push(r); }
/* 输出宫名（对齐 iztro 生产契约）：仅「命宫」带「宫」，其余不带；「交友」→「仆役」
   ⚠️ 与蓝本 SG_BASE（全带「宫」）不同 —— 内部逻辑仍用 SG_BASE（如天才按宫名匹配），仅输出转此名。 */
const OUT_NAME = ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟'];

/* 紫微星：ZIWEI[局数][农历日-1] → 宫位 */
const ZIWEI = {
  2: [11, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 0, 0, 1, 1, 2],
  3: [2, 11, 0, 3, 0, 1, 4, 1, 2, 5, 2, 3, 6, 3, 4, 7, 4, 5, 8, 5, 6, 9, 6, 7, 10, 7, 8, 11, 8, 9],
  4: [9, 2, 11, 0, 10, 3, 0, 1, 11, 4, 1, 2, 0, 5, 2, 3, 1, 6, 3, 4, 2, 7, 4, 5, 3, 8, 5, 6, 4, 9],
  5: [4, 9, 2, 11, 0, 5, 10, 3, 0, 1, 6, 11, 4, 1, 2, 7, 0, 5, 2, 3, 8, 1, 6, 3, 4, 9, 2, 7, 4, 5],
  6: [7, 4, 9, 2, 11, 0, 8, 5, 10, 3, 0, 1, 9, 6, 11, 4, 1, 2, 10, 7, 0, 5, 2, 3, 11, 8, 1, 6, 3, 4]
};
/* 十四正曜：ZHENGYAO[紫微宫位] → { 星索引: 宫位 } */
const ZHENGYAO = [
  { 0: 0, 1: 11, 2: 9, 3: 8, 4: 7, 5: 4, 6: 0, 7: 1, 8: 2, 9: 3, 10: 4, 11: 5, 12: 6, 13: 10 },
  { 0: 1, 1: 0, 2: 10, 3: 9, 4: 8, 5: 5, 6: 11, 7: 0, 8: 1, 9: 2, 10: 3, 11: 4, 12: 5, 13: 9 },
  { 0: 2, 1: 1, 2: 11, 3: 10, 4: 9, 5: 6, 6: 10, 7: 11, 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 8 },
  { 0: 3, 1: 2, 2: 0, 3: 11, 4: 10, 5: 7, 6: 9, 7: 10, 8: 11, 9: 0, 10: 1, 11: 2, 12: 3, 13: 7 },
  { 0: 4, 1: 3, 2: 1, 3: 0, 4: 11, 5: 8, 6: 8, 7: 9, 8: 10, 9: 11, 10: 0, 11: 1, 12: 2, 13: 6 },
  { 0: 5, 1: 4, 2: 2, 3: 1, 4: 0, 5: 9, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11, 11: 0, 12: 1, 13: 5 },
  { 0: 6, 1: 5, 2: 3, 3: 2, 4: 1, 5: 10, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 0, 13: 4 },
  { 0: 7, 1: 6, 2: 4, 3: 3, 4: 2, 5: 11, 6: 5, 7: 6, 8: 7, 9: 8, 10: 9, 11: 10, 12: 11, 13: 3 },
  { 0: 8, 1: 7, 2: 5, 3: 4, 4: 3, 5: 0, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 2 },
  { 0: 9, 1: 8, 2: 6, 3: 5, 4: 4, 5: 1, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 12: 9, 13: 1 },
  { 0: 10, 1: 9, 2: 7, 3: 6, 4: 5, 5: 2, 6: 2, 7: 3, 8: 4, 9: 5, 10: 6, 11: 7, 12: 8, 13: 0 },
  { 0: 11, 1: 10, 2: 8, 3: 7, 4: 6, 5: 3, 6: 1, 7: 2, 8: 3, 9: 4, 10: 5, 11: 6, 12: 7, 13: 11 }
];
/* 四化：[禄/权/科/忌][年干] → 星索引
   ⚠️ 修正①：科·癸干 由蓝本的 2(太阳) 改为 7(太阴) —— 标准四化「癸破巨阴贪」 */
const SIHUA = [
  [5, 1, 4, 7, 8, 3, 2, 9, 11, 13],
  [13, 11, 1, 4, 7, 8, 3, 2, 0, 9],
  [3, 0, 16, 1, 15, 11, 7, 17, 14, 7],
  [2, 7, 5, 9, 1, 17, 4, 16, 3, 8]
];
/* 六吉 · 月系[月-1] / 时系[时支寅起] / 年干系[年干] */
const JX_YUE = { 左辅: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1], 右弼: [8, 7, 6, 5, 4, 3, 2, 1, 0, 11, 10, 9] };
const JX_SHI = { 文昌: [6, 5, 4, 3, 2, 1, 0, 11, 10, 9, 8, 7], 文曲: [4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3] };
const JX_NIAN = { 天魁: [11, 10, 9, 9, 11, 10, 11, 4, 1, 1], 天钺: [5, 6, 7, 7, 5, 6, 5, 0, 3, 3] };
/* 六煞 · 年干系 */
const SX_NIAN = { 擎羊: [1, 2, 4, 5, 4, 5, 7, 8, 10, 11], 陀罗: [11, 0, 2, 3, 2, 3, 5, 6, 8, 9] };
/* 六煞 · 时系[生年支] —— 按四组：寅午戌 / 申子辰 / 巳酉丑 / 亥卯未 */
const HUO = {
  寅: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0], 午: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0], 戌: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0],
  申: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1], 子: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1], 辰: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1],
  巳: [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2], 酉: [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2], 丑: [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2],
  亥: [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8], 卯: [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8], 未: [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8]
};
const LING = {
  寅: [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2], 午: [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2], 戌: [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2],
  卯: [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 辰: [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 巳: [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  未: [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 申: [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 酉: [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  亥: [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 子: [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 丑: [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
};
const DIKONG = { 地空: [7, 6, 5, 4, 3, 2, 1, 0, 11, 10, 9, 8], 地劫: [11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
const LUCUN = [0, 1, 3, 4, 3, 4, 6, 7, 9, 10];
/* 驿马表（生年支系）—— 寅午戌马在申 / 申子辰马在寅 / 巳酉丑马在亥 / 亥卯未马在巳
   注：蓝本同名表亦用于「月马」（生月系），iztro 无月马 → 归 _extraStars */
const TIANMA_M = [6, 3, 0, 9, 6, 3, 0, 9, 6, 3, 0, 9];
/* 杂曜 · 月系[月-1] */
const ZY_YUE = {
  天刑: [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6], 天姚: [11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  解神: [6, 6, 8, 8, 10, 10, 0, 0, 2, 2, 4, 4], 天巫: [3, 6, 0, 9, 3, 6, 0, 9, 3, 6, 0, 9],
  天月: [8, 3, 2, 0, 5, 1, 9, 5, 0, 4, 8, 0], 阴煞: [0, 10, 8, 6, 4, 2, 0, 10, 8, 6, 4, 2]
};
/* 杂曜 · 时系[时支寅起] */
const ZY_SHI = { 封诰: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1], 台辅: [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5] };
/* 杂曜 · 年干系[年干] */
const ZY_NG = {
  天官: [5, 2, 3, 0, 1, 7, 9, 7, 8, 4], 天福: [7, 6, 10, 9, 1, 0, 4, 3, 4, 3],
  天厨: [3, 4, 10, 3, 4, 6, 0, 4, 7, 9]
};
/* 杂曜 · 年支系[生年支寅起]
   注：蓝本的「龙德 / 大耗 / 劫煞」在此**不重复放** —— iztro 把这三颗归入
   岁前12神（龙德、大耗）与将前12神（劫煞），本引擎同样由 12 神体系覆盖。
   本表补入 iztro 的「天德」（蓝本缺；公式 = 酉 + 年支(子起)）。 */
const ZY_NZ = {
  天空: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0], 天哭: [2, 1, 0, 11, 10, 9, 8, 7, 6, 5, 4, 3],
  天虚: [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5], 龙池: [4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3],
  凤阁: [6, 5, 4, 3, 2, 1, 0, 11, 10, 9, 8, 7], 红鸾: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  天喜: [5, 4, 3, 2, 1, 0, 11, 10, 9, 8, 7, 6], 蜚廉: [8, 3, 4, 5, 0, 1, 2, 9, 10, 11, 6, 7],
  破碎: [7, 3, 11, 7, 3, 11, 7, 3, 11, 7, 3, 11], 孤辰: [3, 3, 3, 6, 6, 6, 9, 9, 9, 0, 0, 0],
  寡宿: [11, 11, 11, 2, 2, 2, 5, 5, 5, 8, 8, 8], 天德: [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8],
  月德: [5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4], 年解: [6, 5, 4, 3, 2, 1, 0, 11, 10, 9, 8, 7],
  华盖: [8, 5, 2, 11, 8, 5, 2, 11, 8, 5, 2, 11], 咸池: [1, 10, 7, 4, 1, 10, 7, 4, 1, 10, 7, 4]
};
/* 蓝本独有星（iztro 无 → 仅入 _extraStars，不进契约）：年支系表 */
const ZY_EXTRA = {
  龙德: [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6],
  大耗: [7, 6, 9, 8, 11, 10, 1, 0, 3, 2, 5, 4],
  劫煞: [9, 6, 3, 0, 9, 6, 3, 0, 9, 6, 3, 0]
};
/* 天才：按宫名匹配（生年支 → 宫名） */
const TIANCAI = { 寅: '福德', 卯: '田宅', 辰: '官禄', 巳: '交友', 午: '迁移', 未: '疾厄', 申: '财帛', 酉: '子女', 戌: '夫妻', 亥: '兄弟', 子: '命宫', 丑: '父母' };
/* 旬空 · 紫微堂口径（六旬首支）—— 保留作参考
   甲子旬空戌 / 甲戌旬空申 / 甲申旬空午 / 甲午旬空辰 / 甲辰旬空寅 / 甲寅旬空子 */
const XUNKONG = {};
(function () {
  const BY_XUN = [8, 6, 4, 2, 0, 10];   /* 寅起索引：戌=8 申=6 午=4 辰=2 寅=0 子=10 */
  for (let i = 0; i < 60; i++) XUNKONG[GANZHILI[i]] = BY_XUN[Math.floor(i / 10)];
})();
/* 旬空 · iztro 口径（修正③）：六旬首支 + 一步「阴阳 parity」修正
   xk = fixIndex( 年支(寅起) + 9(癸) − 年干 + 1 )
   若 年支阴阳(子起 %2) ≠ xk 阴阳 → xk + 1（落次支）
   实证：甲子→戌（首支）、庚午→戌（首支）、丁亥→未（次支） */
function xunKongIdx(nianGan, nianZhi) {
  const nk = ganIdx(nianGan), zi = zhiIdx(nianZhi);
  let x = (((zi + 9 - nk + 1) % 12) + 12) % 12;
  if ((ZHI_STD.indexOf(nianZhi) % 2) !== (x % 2)) x = (x + 1) % 12;
  return x;
}
/* 截路空亡（修正②）：每干一对两支 —— 首支=截路 / 次支=空亡
   甲己→申酉 / 乙庚→午未 / 丙辛→辰巳 / 丁壬→寅卯 / 戊癸→子丑 */
const JIELU = [6, 4, 2, 0, 10, 6, 4, 2, 0, 10];   /* 首支：甲=申 乙=午 丙=辰 丁=寅 戊=子 己=申 庚=午 辛=辰 壬=寅 癸=子 */
const KONGWANG = [7, 5, 3, 1, 11, 7, 5, 3, 1, 11]; /* 次支：甲=酉 乙=未 丙=巳 丁=卯 戊=丑 己=酉 庚=未 辛=巳 壬=卯 癸=丑 */
/* 天伤 / 天使[命宫] */
const TIANSHANG = {
  天伤: [5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4],
  天使: [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6]
};
const MINGZHU = [20, 17, 5, 3, 13, 3, 5, 17, 20, 9, 8, 9];   /* 命主[命宫] → 星索引 */
const SHENZHU = [11, 4, 16, 1, 23, 10, 11, 4, 16, 1, 23, 10]; /* 身主[生年支寅起] → 星索引 */
/* 长生十二神：CHANGSHENG[名][局数][阳男阴女/阴男阳女 两档] */
const CHANGSHENG = {
  长生: { 2: [6, 6], 3: [9, 9], 4: [3, 3], 5: [6, 6], 6: [0, 0] },
  沐浴: { 2: [7, 5], 3: [10, 8], 4: [4, 2], 5: [7, 5], 6: [1, 11] },
  冠带: { 2: [8, 4], 3: [11, 7], 4: [5, 1], 5: [8, 4], 6: [2, 10] },
  临官: { 2: [9, 3], 3: [0, 6], 4: [6, 0], 5: [9, 3], 6: [3, 9] },
  帝旺: { 2: [10, 2], 3: [1, 5], 4: [7, 11], 5: [10, 2], 6: [4, 8] },
  衰: { 2: [11, 1], 3: [2, 4], 4: [8, 10], 5: [11, 1], 6: [5, 7] },
  病: { 2: [0, 0], 3: [3, 3], 4: [9, 9], 5: [0, 0], 6: [6, 6] },
  死: { 2: [1, 11], 3: [4, 2], 4: [10, 8], 5: [1, 11], 6: [7, 5] },
  墓: { 2: [2, 10], 3: [5, 1], 4: [11, 7], 5: [2, 10], 6: [8, 4] },
  绝: { 2: [3, 9], 3: [6, 0], 4: [0, 6], 5: [3, 9], 6: [9, 3] },
  胎: { 2: [4, 8], 3: [7, 11], 4: [1, 5], 5: [4, 8], 6: [10, 2] },
  养: { 2: [5, 7], 3: [8, 10], 4: [2, 4], 5: [5, 7], 6: [11, 1] }
};
const BS12 = ['博士', '力士', '青龙', '小耗', '将军', '奏书', '飞廉', '喜神', '病符', '大耗', '伏兵', '官府'];
/* 岁前 / 将前 12 神[生年支寅起] → 值即宫位 */
const SUIQIAN = {
  岁建: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 晦气: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0],
  丧门: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1], 贯索: [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2],
  官符: [4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3], 小耗: [5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4],
  大耗: [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5], 龙德: [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6],
  白虎: [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7], 天德: [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8],
  吊客: [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 病符: [11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
};
const JIANGQIAN = {
  将星: [4, 1, 10, 7, 4, 1, 10, 7, 4, 1, 10, 7], 攀鞍: [5, 2, 11, 8, 5, 2, 11, 8, 5, 2, 11, 8],
  岁驿: [6, 3, 0, 9, 6, 3, 0, 9, 6, 3, 0, 9], 息神: [7, 4, 1, 10, 7, 4, 1, 10, 7, 4, 1, 10],
  华盖: [8, 5, 2, 11, 8, 5, 2, 11, 8, 5, 2, 11], 劫煞: [9, 6, 3, 0, 9, 6, 3, 0, 9, 6, 3, 0],
  灾煞: [10, 7, 4, 1, 10, 7, 4, 1, 10, 7, 4, 1], 天煞: [11, 8, 5, 2, 11, 8, 5, 2, 11, 8, 5, 2],
  指背: [0, 9, 6, 3, 0, 9, 6, 3, 0, 9, 6, 3], 咸池: [1, 10, 7, 4, 1, 10, 7, 4, 1, 10, 7, 4],
  月煞: [2, 11, 8, 5, 2, 11, 8, 5, 2, 11, 8, 5], 亡神: [3, 0, 9, 6, 3, 0, 9, 6, 3, 0, 9, 6]
};
const XIAOXIAN = [2, 11, 8, 5, 2, 11, 8, 5, 2, 11, 8, 5];  /* 小限起点[生年支寅起] */
/* 庙旺得平陷[宫位][档0..4] → 星索引数组（档：0庙 1旺 2得 3平 4陷）
   ⚠️ 五档口径（紫微堂）；iztro 为七档（另有「利」「不」）→ 见对撞台「星曜亮度」维度 */
const XYQD = [
  [[5, 6, 9, 10, 11, 12, 20, 23, 24], [0, 2, 7, 19, 27], [1, 3, 13], [4, 8, 26], [16, 17, 25, 22]],
  [[2, 9, 20, 11, 18], [0, 1, 12, 17], [6], [3, 8, 16, 23, 24, 4, 5, 25, 26], [7, 10, 13, 21]],
  [[3, 6, 8, 11, 12, 21, 22], [2, 13], [0, 10, 16, 17], [1, 5, 4], [7, 9, 23, 24, 25, 26]],
  [[4, 16, 17, 20], [0, 2, 9, 19], [6, 10, 23, 24, 26], [1, 3, 12, 13, 27], [5, 7, 8, 11, 22]],
  [[0, 1, 10, 11, 13, 20, 23, 24, 18, 25, 26], [2, 3, 6, 8, 9, 12], [], [5], [4, 7, 16, 17, 21]],
  [[0, 3, 6, 8, 12, 21, 22], [11, 13, 17, 19], [2, 10], [5, 17, 23, 24, 25, 26], [4, 7, 9, 1]],
  [[5, 9, 10, 12, 20, 19, 25, 26], [0, 4, 27], [1, 2, 3, 6, 13, 16, 17], [7, 8], [11, 23, 24, 22]],
  [[9, 16, 17, 20, 19, 25, 26], [0, 1, 6, 7, 12], [11, 23, 24], [3, 8, 2, 4, 5, 26], [10, 13, 21]],
  [[3, 6, 8, 11, 12, 21, 23, 24, 22], [7, 13], [0, 10], [1, 5, 4, 26], [2, 9, 16, 17]],
  [[4, 7, 20], [0, 9, 17, 18, 26], [6, 10], [16, 23, 24, 1, 12, 3, 13, 27], [2, 5, 8, 11, 25, 22]],
  [[1, 6, 7, 10, 11, 13, 20], [3, 4, 8, 9, 12, 18], [16, 17], [0, 5, 25], [2, 21, 23, 24, 26]],
  [[0, 3, 6, 7, 8, 10, 12, 16, 17, 21, 22], [11, 13, 18], [23, 24], [5], [2, 4, 9, 1, 25, 26]]
];
const QD_NAMES = ['庙', '旺', '得', '平', '陷'];
/* 星曜亮度 · 七档（庙旺得利平不陷）· 12 宫寅起 —— **默认口径**
   采用传统「诸星庙旺利陷表」的通行版（与 iztro 完全一致）→ 换引擎后前端显示不变。
   注：这是静态流派数据表，非任何实现的代码资产；蓝本（紫微堂）的五档表见 XYQD。 */
const BRIGHT7 = {
  紫微: ['旺', '旺', '得', '旺', '庙', '庙', '旺', '旺', '得', '旺', '平', '庙'],
  天机: ['得', '旺', '利', '平', '庙', '陷', '得', '旺', '利', '平', '庙', '陷'],
  太阳: ['旺', '庙', '旺', '旺', '旺', '得', '得', '陷', '不', '陷', '陷', '不'],
  武曲: ['得', '利', '庙', '平', '旺', '庙', '得', '利', '庙', '平', '旺', '庙'],
  天同: ['利', '平', '平', '庙', '陷', '不', '旺', '平', '平', '庙', '旺', '不'],
  廉贞: ['庙', '平', '利', '陷', '平', '利', '庙', '平', '利', '陷', '平', '利'],
  天府: ['庙', '得', '庙', '得', '旺', '庙', '得', '旺', '庙', '得', '庙', '庙'],
  太阴: ['旺', '陷', '陷', '陷', '不', '不', '利', '不', '旺', '庙', '庙', '庙'],
  贪狼: ['平', '利', '庙', '陷', '旺', '庙', '平', '利', '庙', '陷', '旺', '庙'],
  巨门: ['庙', '庙', '陷', '旺', '旺', '不', '庙', '庙', '陷', '旺', '旺', '不'],
  天相: ['庙', '陷', '得', '得', '庙', '得', '庙', '陷', '得', '得', '庙', '庙'],
  天梁: ['庙', '庙', '庙', '陷', '庙', '旺', '陷', '得', '庙', '陷', '庙', '旺'],
  七杀: ['庙', '旺', '庙', '平', '旺', '庙', '庙', '庙', '庙', '平', '旺', '庙'],
  破军: ['得', '陷', '旺', '平', '庙', '旺', '得', '陷', '旺', '平', '庙', '旺'],
  文昌: ['陷', '利', '得', '庙', '陷', '利', '得', '庙', '陷', '利', '得', '庙'],
  文曲: ['平', '旺', '得', '庙', '陷', '旺', '得', '庙', '陷', '旺', '得', '庙'],
  火星: ['庙', '利', '陷', '得', '庙', '利', '陷', '得', '庙', '利', '陷', '得'],
  铃星: ['庙', '利', '陷', '得', '庙', '利', '陷', '得', '庙', '利', '陷', '得'],
  擎羊: ['', '陷', '庙', '', '陷', '庙', '', '陷', '庙', '', '陷', '庙'],
  陀罗: ['陷', '', '庙', '陷', '', '庙', '陷', '', '庙', '陷', '', '庙']
};
/* 流昌流曲[流年干] */
const LIUCHANG = [3, 4, 6, 7, 6, 7, 9, 10, 0, 1];
const LIUQU = [7, 6, 4, 3, 4, 3, 1, 0, 10, 9];

/* 星曜分组（对齐 iztro 三分） */
const MAJOR_SET = new Set(['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军']);
const MINOR_SET = new Set(['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '擎羊', '陀罗', '火星', '铃星', '地空', '地劫', '禄存', '天马']);
const MINOR_TYPE = { 左辅: 'soft', 右弼: 'soft', 文昌: 'soft', 文曲: 'soft', 天魁: 'soft', 天钺: 'soft',
  擎羊: 'tough', 陀罗: 'tough', 火星: 'tough', 铃星: 'tough', 地空: 'tough', 地劫: 'tough', 禄存: 'lucun', 天马: 'tianma' };

/* 星曜显示顺序（2026-10-19 全量切换对齐 iztro）：
   前端多处按 slice(0,4) 只展示前几颗，数组顺序变则显示变。
   三张表均由 690 例 iztro 输出做拓扑排序反推，全部为**唯一序**（无环、无冲突）。
   不在表内的星名一律排末尾（保底，不应发生）。 */
const MAJOR_ORDER = ['天同', '天机', '太阳', '天梁', '太阴', '巨门', '廉贞', '武曲', '紫微', '七杀', '天府', '天相', '破军', '贪狼'];
const MINOR_ORDER = ['左辅', '右弼', '文昌', '文曲', '天钺', '天魁', '禄存', '天马', '地空', '地劫', '火星', '铃星', '擎羊', '陀罗'];
const ADJ_ORDER = ['天喜', '红鸾', '天姚', '咸池', '解神', '三台', '八座', '恩光', '天贵', '龙池',
  '凤阁', '天才', '天寿', '台辅', '封诰', '华盖', '天巫', '天官', '天福', '天厨', '天月', '天德',
  '天空', '旬空', '月德', '截路', '空亡', '孤辰', '寡宿', '蜚廉', '破碎', '天刑', '阴煞', '天哭',
  '天虚', '天伤', '天使', '年解'];
const mkRank = (list) => {
  const m = {};
  list.forEach((n, i) => { m[n] = i; });
  return (n) => (m[n] === undefined ? 999 : m[n]);
};
const majorRank = mkRank(MAJOR_ORDER);
const minorRank = mkRank(MINOR_ORDER);
const adjRank = mkRank(ADJ_ORDER);

/* ============================ 主函数 ============================ */
/**
 * 安星：输入农历要素，输出与 iztro Astrolabe 同构的命盘对象
 * @param {Object} o
 *   o.nianGan 年干（农历年干，非立春）
 *   o.nianZhi 年支
 *   o.yue     农历月（1-12，闰月已在调用侧折算）
 *   o.ri      农历日（1-30）
 *   o.shiZhi  时支名（'子'…'亥'）
 *   o.sex     '男' | '女'
 *   o.ti      timeIndex（用于 time 字段与晚子时判定；可省）
 *   o.gender  'male' | 'female'（输出用）
 */
function calcChart(o) {
  const nianGan = o.nianGan, nianZhi = o.nianZhi;
  const yue = o.yue, ri = o.ri, sex = o.sex;
  const nk = ganIdx(nianGan), zk = zhiIdx(nianZhi), sk = zhiIdx(o.shiZhi);
  const y_ak = yue - 1, ri_k = ri - 1;

  const mg = MING[yue][sk];                 /* 命宫 */
  const sg = SHEN[yue][sk];                 /* 身宫 */
  const wx = WUXING[nianGan][mg];           /* 五行局 */
  const yang = (nk % 2 === 0);              /* 阳干 */
  const male = (sex === '男');
  const cs_k = ((yang && male) || (!yang && !male)) ? 0 : 1;  /* 0=顺行 1=逆行 */

  /* 十二宫骨架 */
  const gong = [];
  for (let i = 0; i < 12; i++) {
    const nIdx = (i - mg + 12) % 12;
    gong.push({
      i: i, zhi: DIZHI[i], gan: TIANGAN[GANZHI[nianGan][i]],
      name: SG_BASE[nIdx],        /* 内部名（带「宫」）—— 供宫名匹配逻辑用 */
      outName: OUT_NAME[nIdx],    /* 输出名（对齐 iztro 契约） */
      stars: []
    });
  }
  /* put 支持「星索引」或「星名」；星名用于蓝本表外的输出名（截路 / 空亡） */
  const put = (si, pi, group) => { gong[pi].stars.push({ name: (typeof si === 'number') ? XINGYAO[si] : si, group: group }); };

  /* ── 十四正曜 ── */
  const zwx = ZIWEI[wx][ri_k];
  for (const k in ZHENGYAO[zwx]) put(+k, ZHENGYAO[zwx][k], 'major');
  /* ── 六吉 ── */
  for (const k in JX_YUE) put(XINGYAO.indexOf(k), JX_YUE[k][y_ak], 'minor');
  for (const k in JX_SHI) put(XINGYAO.indexOf(k), JX_SHI[k][sk], 'minor');
  for (const k in JX_NIAN) put(XINGYAO.indexOf(k), JX_NIAN[k][nk], 'minor');
  /* ── 六煞 ── */
  for (const k in SX_NIAN) put(XINGYAO.indexOf(k), SX_NIAN[k][nk], 'minor');
  put(23, HUO[nianZhi][sk], 'minor');    /* 火星 */
  put(24, LING[nianZhi][sk], 'minor');   /* 铃星 */
  put(25, DIKONG['地空'][sk], 'minor');
  put(26, DIKONG['地劫'][sk], 'minor');
  /* ── 禄存 / 天马（年马＝驿马）── */
  put(20, LUCUN[nk], 'minor');
  put(27, TIANMA_M[zk], 'minor');        /* 天马 */
  /* ── 三台八座恩光天贵 ── */
  put(28, (JX_YUE['左辅'][y_ak] + ri_k) % 12, 'adj');
  put(29, (JX_YUE['右弼'][y_ak] + 48 - ri_k) % 12, 'adj');
  put(30, ((JX_SHI['文昌'][sk] + ri_k + 12) - 1) % 12, 'adj');
  put(31, ((JX_SHI['文曲'][sk] + ri_k + 12) - 1) % 12, 'adj');
  /* ── 杂曜 ── */
  for (const k in ZY_YUE) put(XINGYAO.indexOf(k), ZY_YUE[k][y_ak], 'adj');
  for (const k in ZY_SHI) put(XINGYAO.indexOf(k), ZY_SHI[k][sk], 'adj');
  for (const k in ZY_NG) put(XINGYAO.indexOf(k), ZY_NG[k][nk], 'adj');
  for (const k in ZY_NZ) put(XINGYAO.indexOf(k), ZY_NZ[k][zk], 'adj');
  /* 天才：命宫 + 年支（蓝本按「宫名」表达）
     ⚠️ 蓝本 TIANCAI 表自身不一致 —— 仅「子」项带「宫」后缀（'命宫'），余为「福德」等。
        故比较时**两边统一去「宫」后缀**；否则年支=子 的盘会漏天才。 */
  const tcName = TIANCAI[nianZhi].replace(/宫$/, '');
  for (let i = 0; i < 12; i++) if (gong[i].name.replace(/宫$/, '') === tcName) put(38, i, 'adj');
  /* 天寿 */
  const ts_n = (zk === 10) ? 0 : (zk === 11) ? 1 : zk + 2;
  put(39, (sg + ts_n) % 12, 'adj');
  /* 旬空（iztro 口径：六旬首支 + 阴阳 parity） */
  put(65, xunKongIdx(nianGan, nianZhi), 'adj');
  /* 截路 / 空亡（修正②：蓝本「截空」拆两颗 —— 首支截路 / 次支空亡，与 iztro 对齐） */
  put('截路', JIELU[nk], 'adj');
  put('空亡', KONGWANG[nk], 'adj');
  /* 天伤天使 */
  put(57, TIANSHANG['天伤'][mg], 'adj');
  put(58, TIANSHANG['天使'][mg], 'adj');
  /* ── 蓝本独有（iztro 无）→ _extraStars ── */
  const extra = [];
  extra.push({ name: '月马', palace: TIANMA_M[y_ak] });                  /* 月系驿马 */
  extra.push({ name: '龙德', palace: ZY_EXTRA['龙德'][zk] });
  extra.push({ name: '大耗', palace: ZY_EXTRA['大耗'][zk] });
  extra.push({ name: '劫煞', palace: ZY_EXTRA['劫煞'][zk] });

  /* ── 长生 12 ── */
  const cs = {};
  for (const name in CHANGSHENG) { const p = CHANGSHENG[name][wx][cs_k]; cs[p] = name; }
  /* ── 博士 12（禄存起、阳男阴女顺 / 阴男阳女逆）── */
  const bs = [];
  let b = LUCUN[nk];
  for (let i = 0; i < 12; i++) { bs[b] = BS12[i]; b = (cs_k === 0) ? (b + 1) % 12 : (b === 0 ? 11 : b - 1); }
  /* ── 岁前 / 将前 12 ── */
  const sq = [], jq = [];
  for (const k in SUIQIAN) sq[SUIQIAN[k][zk]] = k;
  for (const k in JIANGQIAN) jq[JIANGQIAN[k][zk]] = k;
  /* ── 大限 ── */
  const dx = {};
  let dn = mg + 12, ds = wx, de = wx + 9;
  for (let i = 0; i < 12; i++) {
    dx[dn % 12] = [ds, de];
    ds += 10; de += 10;
    if (cs_k === 0) dn++; else dn--;
  }
  /* ── 小限（男顺女逆）── */
  const xx = {};
  let x = XIAOXIAN[zk];
  for (let i = 1; i <= 12; i++) {
    xx[x] = i;
    if (male) { x = (x + 1) % 12; } else { if (x === 0) x = 12; x--; }
  }
  /* ── 生年四化 ── */
  const sihua = { 禄: XINGYAO[SIHUA[0][nk]], 权: XINGYAO[SIHUA[1][nk]], 科: XINGYAO[SIHUA[2][nk]], 忌: XINGYAO[SIHUA[3][nk]] };
  /* ── 亮度（按宫位）──
     默认七档 BRIGHT7（与 iztro 一致，前端显示不变）；o.brightScheme='wzt' 切蓝本五档 XYQD */
  const bright = {};
  const useWzt = (o.brightScheme === 'wzt');
  for (let i = 0; i < 12; i++) {
    bright[i] = {};
    if (useWzt) {
      for (let lv = 0; lv < 5; lv++) {
        const arr = XYQD[i][lv] || [];
        for (const s of arr) if (typeof s === 'number') bright[i][XINGYAO[s]] = QD_NAMES[lv];
      }
    } else {
      for (const nm in BRIGHT7) { const v = BRIGHT7[nm][i]; if (v) bright[i][nm] = v; }
    }
  }
  return { mg, sg, wx, cs_k, yang, male, gong, sihua, cs, bs, sq, jq, dx, xx, bright, extra, ri_k, y_ak, nk, zk, sk };
}

/**
 * 主入口：由农历排出 iztro 同构命盘
 * @param {Object} o  { nianGan, nianZhi, yue, ri, shiZhi, sex, ti, gender, lunarText, solarText, chineseDate }
 */
function byLunar(o) {
  const c = calcChart(o);
  const { mg, sg, wx, gong, sihua, cs, bs, sq, jq, dx, xx, bright, extra } = c;
  const genderOut = o.gender || (o.sex === '男' ? 'male' : 'female');
  const ti = (o.ti === undefined || o.ti === null) ? null : o.ti;

  const palaces = gong.map((g, i) => {
    const majorStars = [], minorStars = [], adjectiveStars = [];
    for (const s of g.stars) {
      const b = (bright[i] && bright[i][s.name]) || '';
      if (s.group === 'major') {
        majorStars.push({ name: s.name, type: 'major', scope: 'origin', brightness: b, mutagen: huaOf(s.name, sihua) });
      } else if (s.group === 'minor') {
        minorStars.push({ name: s.name, type: MINOR_TYPE[s.name] || 'minor', scope: 'origin', brightness: b, mutagen: huaOf(s.name, sihua) });
      } else {
        adjectiveStars.push({ name: s.name, type: 'adjective', scope: 'origin' });
      }
    }
    /* 顺序对齐 iztro（前端按数组顺序展示） */
    if (majorStars.length > 1) majorStars.sort((a, b) => majorRank(a.name) - majorRank(b.name));
    if (minorStars.length > 1) minorStars.sort((a, b) => minorRank(a.name) - minorRank(b.name));
    if (adjectiveStars.length > 1) adjectiveStars.sort((a, b) => adjRank(a.name) - adjRank(b.name));
    /* ages：该宫为小限命宫时的虚岁序列（12 年一轮，至 120） */
    const st = xx[i];
    const ages = [];
    if (st) for (let n = st; n <= 120; n += 12) ages.push(n);
    return {
      index: i, name: g.outName,
      isBodyPalace: i === sg, isOriginalPalace: false,
      heavenlyStem: g.gan, earthlyBranch: g.zhi,
      majorStars, minorStars, adjectiveStars,
      changsheng12: cs[i] || '', boshi12: bs[i] || '', suiqian12: sq[i] || '', jiangqian12: jq[i] || '',
      decadal: dx[i] ? { range: dx[i], heavenlyStem: g.gan, earthlyBranch: g.zhi } : null,
      ages
    };
  });

  return {
    gender: genderOut,
    solarDate: o.solarText || '',
    lunarDate: o.lunarText || '',
    chineseDate: o.chineseDate || '',
    time: ti === null ? '' : TI_TO_SHICHEN(ti),
    timeIndex: ti,
    earthlyBranchOfSoulPalace: DIZHI[mg],
    earthlyBranchOfBodyPalace: DIZHI[sg],
    soul: XINGYAO[MINGZHU[mg]],
    body: XINGYAO[SHENZHU[c.zk]],
    fiveElementsClass: WXJ[wx],
    palaces,
    /* 附加（非 iztro 字段）：生年四化 & 蓝本独有星 */
    _fourTransform: sihua,
    _extraStars: extra,
    _engine: 'ziwei-core/1.0'
  };
}

/* 星曜 → 生年四化标记（禄/权/科/忌） */
function huaOf(name, sihua) {
  if (sihua.禄 === name) return '禄';
  if (sihua.权 === name) return '权';
  if (sihua.科 === name) return '科';
  if (sihua.忌 === name) return '忌';
  return '';
}

/* ══════════════════════════════════════════════════════════════
   运限层 —— 大限 / 小限 / 流年 / 流月 / 流日 / 流时
   与 iztro horoscope 同契约；蓝本：iztro lib/astro/FunctionalAstrolabe.js
   :: _getHoroscopeBySolarDate
   ──────────────────────────────────────────────────────────────
   · 索引一律「寅起」（0=寅 … 11=丑）；日期与干支由调用方（ziwei-engine）供给
   · 虚岁 = 目标农历年 − 本命农历年 + 1（ageDivide='normal'）
   · 大限：虚岁 ∈ 宫.decadal.range；未起运 → 童限（1命 2财 3疾厄 4夫妻 5福德 6官禄）
   · 小限：虚岁 ∈ 宫.ages
   · 流年：流年支（寅起）
   · 流月：流年支逆数生月（闰月「日>15」折下月）→ 该宫顺数生时 = 正月宫，此后一月一宫
   · 流日：流月宫 + (农历日 − 1)
   · 流时：流日宫 + 时支（子起）
   · palaceNames = OUT_NAME[(i − index) mod 12]；mutagen = 天干四化表
   ══════════════════════════════════════════════════════════════ */
const EARTH12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']; /* 子起（indexOf 用） */
const YIN_AT = EARTH12.indexOf('寅');
function fxMod(i, m) { m = m || 12; i %= m; return i < 0 ? i + m : i; }
function zhiToYin(zhi) { return fxMod(EARTH12.indexOf(zhi) - YIN_AT); }          /* 地支 → 寅起索引 */
/* 从寅起、以 fromIndex 为命宫的十二宫名（输出契约同 OUT_NAME） */
function palaceNamesOf(fromIndex) {
  const r = [];
  for (let i = 0; i < 12; i++) r.push(OUT_NAME[fxMod(i - fromIndex)]);
  return r;
}
/* 天干四化 → [禄, 权, 科, 忌] 星名 */
function mutagenOf(gan) {
  const gi = TIANGAN.indexOf(gan);
  if (gi < 0) return [];
  return [XINGYAO[SIHUA[0][gi]], XINGYAO[SIHUA[1][gi]], XINGYAO[SIHUA[2][gi]], XINGYAO[SIHUA[3][gi]]];
}
/* 童限宫序（未起运时以虚岁取宫）*/
const CHILDHOOD_SEQ = ['命宫', '财帛', '疾厄', '夫妻', '福德', '官禄'];

/**
 * horoscopeOf(pan, ctx) —— 运限计算
 * @param pan core.byLunar() 的本命盘
 * @param ctx {
 *   nominalAge,                                  // 目标日期虚岁
 *   birthMonth, birthDay, birthLeap,             // 本命农历（流月推算用）
 *   birthHourZhi,                                // 本命时支
 *   targetMonth, targetDay, targetLeap,          // 目标农历
 *   yearly:[gan,zhi], monthly:[gan,zhi],         // 目标年柱/月柱
 *   daily:[gan,zhi], hourly:[gan,zhi]            // 目标日柱/时柱
 * }
 */
function horoscopeOf(pan, ctx) {
  const nominalAge = ctx.nominalAge;
  const yearlyIndex = zhiToYin(ctx.yearly[1]);
  /* ── 大限 ── */
  let decadalIndex = -1, dGan = '甲', dZhi = '子', isChildhood = false;
  pan.palaces.some(function (p) {
    if (p.decadal && nominalAge >= p.decadal.range[0] && nominalAge <= p.decadal.range[1]) {
      decadalIndex = p.index; dGan = p.decadal.heavenlyStem; dZhi = p.decadal.earthlyBranch; return true;
    }
    return false;
  });
  if (decadalIndex < 0) {                                    /* 未起运 → 童限 */
    const nm = CHILDHOOD_SEQ[nominalAge - 1];
    const tp = pan.palaces.filter(function (p) { return p.name === nm; })[0];
    if (tp) { isChildhood = true; decadalIndex = tp.index; dGan = tp.heavenlyStem; dZhi = tp.earthlyBranch; }
  }
  /* ── 小限 ── */
  let ageIndex = -1, aGan = '甲', aZhi = '子';
  pan.palaces.some(function (p) {
    if (p.ages && p.ages.indexOf(nominalAge) >= 0) { ageIndex = p.index; aGan = p.heavenlyStem; aZhi = p.earthlyBranch; return true; }
    return false;
  });
  /* ── 流月 / 流日 / 流时 ── */
  const leapAdd = (ctx.birthLeap && ctx.birthDay > 15) ? 1 : 0;
  const dateLeapAdd = (ctx.targetLeap && ctx.targetDay > 15) ? 1 : 0;
  const monthlyIndex = fxMod(yearlyIndex - (ctx.birthMonth + leapAdd)
    + EARTH12.indexOf(ctx.birthHourZhi) + (ctx.targetMonth + dateLeapAdd));
  const dailyIndex = fxMod(monthlyIndex + ctx.targetDay - 1);
  const hourlyIndex = fxMod(dailyIndex + EARTH12.indexOf(ctx.hourly[1]));
  function mk(idx, gz, name) {
    return {
      index: idx, name: name,
      heavenlyStem: gz[0], earthlyBranch: gz[1],
      palaceNames: palaceNamesOf(idx), mutagen: mutagenOf(gz[0])
    };
  }
  return {
    decadal: mk(decadalIndex, [dGan, dZhi], isChildhood ? '童限' : '大限'),
    age: (function () { const o = mk(ageIndex, [aGan, aZhi], '小限'); o.nominalAge = nominalAge; return o; })(),
    yearly: mk(yearlyIndex, ctx.yearly, '流年'),
    monthly: mk(monthlyIndex, ctx.monthly, '流月'),
    daily: mk(dailyIndex, ctx.daily, '流日'),
    hourly: mk(hourlyIndex, ctx.hourly, '流时')
  };
}

module.exports = {
  byLunar, calcChart, horoscopeOf, palaceNamesOf, mutagenOf,
  XINGYAO, DIZHI, TIANGAN, GANZHILI, MING, SHEN, SHIER, WUXING, WXJ, SIHUA,
  JX_YUE, JX_SHI, JX_NIAN, SX_NIAN, LUCUN, TIANMA_M, CHANGSHENG, BS12, SUIQIAN, JIANGQIAN,
  XIAOXIAN, XYQD, MINGZHU, SHENZHU, XUNKONG, JIELU, KONGWANG, xunKongIdx, zhiIdx, ganIdx,
  _const: { MAJOR_SET, MINOR_SET }
};

if (require.main === module) {
  console.log('ziwei-core v1.0 — 安星层（无日期层，请用 byLunar 传农历要素）');
  console.log(JSON.stringify(byLunar({ nianGan: '庚', nianZhi: '午', yue: 5, ri: 23, shiZhi: '午', sex: '男', ti: 6 }), (k, v) => k === 'palaces' ? '[...12宫]' : v, 1));
}
