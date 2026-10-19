# ziwei-core

紫微斗数（Zi Wei Dou Shu）安星核心 —— 把出生时间排成一张命盘。

零依赖、纯函数、Node 12+ 可跑。对外签名与 [iztro](https://github.com/SylarLong/iztro) 兼容，可原地替换。

```js
const { bySolar } = require('ziwei-core/engine');

const chart = bySolar('1990-6-15', 6, 'male');
console.log(chart.fiveElementsClass); // 五行局
console.log(chart.palaces[0].majorStars); // 主星 + 亮度 + 四化
```

---

## 它算的是什么

| 层 | 产出 |
|---|---|
| 安星层（`ziwei-core`） | 十二宫、宫干宫支、十四主星、辅星、杂曜、生年四化、五行局、命主、身主、大限、小限、长生十二神、将前诸星、岁前诸星 |
| 日期层（`ziwei-core/engine`） | 公历 → 农历、四柱、闰月折算、时辰索引、大限/流年/流月/流日/流时 |
| **不算** | 任何吉凶判断、解读、预测 —— 那是解读层的事，本包只负责「盘算对」 |

## 安装

```bash
npm i ziwei-core
```

安星层（`require('ziwei-core')`）**零依赖**，纯函数、Node 12+ 可跑。

`require('ziwei-core/engine')` 需要日期层 `lunar-typescript`（公历↔农历换算）。它已作为**正式依赖随包自动安装**，无需手动装；只有想用自建万年历替换时才需要设 `LUNAR_PATH` 指向你自己的模块（需导出 `{ Solar, Lunar }`）。

## 用法

### ① 公历出生 → 完整命盘

```js
const { bySolar, byLunar } = require('ziwei-core/engine');

// bySolar(公历日期, 时辰索引, 性别)
// 时辰索引 0=早子(00–01) 1=丑 … 11=亥 12=晚子(23–24)
const chart = bySolar('1990-6-15', 6, 'male');

chart.lunarDate;          // 农历日期
chart.chineseDate;        // 四柱
chart.fiveElementsClass;  // 五行局，如「火六局」
chart.soul;               // 命主
chart.body;               // 身主
chart.earthlyBranchOfSoulPalace;  // 命宫地支
chart.palaces;            // 12 个宫位
```

每个宫位：

```js
{
  name: '命宫',              // 宫名
  heavenlyStem: '丙',        // 宫干
  earthlyBranch: '申',       // 宫支
  isBodyPalace: false,       // 是否身宫
  majorStars: [{ name: '廉贞', type: 'major', brightness: '庙', mutagen: '忌' }],
  minorStars: [{ name: '文昌', type: 'soft', brightness: '得', mutagen: '' }],
  adjectiveStars: [{ name: '天喜', type: 'adjective' }],
  decadal: { range: [6, 15] },  // 大限区间
  ages: [6, 18, 30, ...]        // 小限年龄
}
```

### ② 已知农历 → 安星（零依赖）

```js
const core = require('ziwei-core');

const chart = core.byLunar({
  nianGan: '丙', nianZhi: '辰',  // 生年干支
  yue: 9, ri: 23,                // 农历月（1–12）、日（1–30）
  shiZhi: '寅',                  // 时支
  sex: '男',
  ti: 2,                         // 时辰索引（可选，用于大限顺逆之外的细化）
});
```

### ③ 流年 / 运限

`core.horoscopeOf(pan, ctx)` 返回「大限 / 流年 / 流月 / 流日 / 流时」五层的宫位索引与四化。

`ctx` 需自备农历上下文（虚岁、流年干支、目标月日时、出生月与时辰等），字段清单见 `src/core.js` 中 `horoscopeOf` 上方的注释 —— 本包不内置「公历年份 → 流年干支」的换算，避免把历法口径偷偷藏进排盘库。

## 口径（与主流实现对齐，逐条写死）

| 项 | 口径 |
|---|---|
| 年干支 | 取**农历年**干支（非立春分年） |
| 闰月 | 「日 > 15」作下月 |
| 晚子时 | `timeIndex=12` 归**次日**整盘 |
| 月柱 | 五虎遁（按闰月折算后的农历月），**不用节气月** |
| 星曜亮度 | 七档：庙 得 利 平 不 陷 闲 |
| 星曜数组顺序 | 主星 / 辅星 / 杂曜各自全局固定序（前端常按 `slice(0, 4)` 渲染，顺序影响显示） |

## 验证结果

本包不是「跑通就行」，是拿真值对撞过的：

| 验证 | 规模 | 结果 |
|---|---|---|
| 与 iztro 2.5.8 逐字段对撞（真实命例） | **700 例** | 100%（宫名/宫干/主星/辅星/杂曜/四化/大限，含数组顺序） |
| 全空间对撞（1924–1987 × 12 月 × 30 日 × 12 时辰 × 男女，含闰月） | **280,656 盘** | 不一致 0 |
| 外部真值：命盘图 OCR（五行局 / 命主 / 身主） | 615 / 681 / 681 | **100%** |
| 本仓库单元测试（20 例端到端 + 6 项安星断言） | 27 项 | 全绿 |

身主那 8 例初判不符，逐条核过全是 OCR 错字（「天粱」→天梁 ×5、「火皇」→火星 ×3），非排盘差异。

`test/fixtures/charts.json` 里的 20 例期望值由 iztro 2.5.8 独立排出（MIT），与本仓库无代码共享；出生信息已脱敏，只保留排盘所需字段与盘面结果。

## 与 iztro 的关系

- **签名兼容**：`bySolar(dateStr, timeIndex, gender)` / `byLunar(...)` / `config(...)` 一致，替换只需改 `require` 路径
- **实现独立**：安星表由传统斗数规则独立实现，不复制 iztro 源码
- **日期层复用**：`ziwei-core/engine` 用 `lunar-typescript`（MIT，与 iztro 同源）做公历农历转换；`ziwei-core` 本体不含任何日期库

## 不做的事

本包**不提供**解读、吉凶判断、事件预测。紫微斗数的解读层涉及大量流派分歧（三合 / 四化 / 飞星），把判断逻辑塞进排盘库只会让两个问题混在一起：盘算错没算错、断得对没断对。这里只解决第一个。

## 协议

MIT © AI紫府（ziweiai.cn）

安星规则源自传统紫微斗数典籍（公开知识），代码为本项目独立实现。欢迎 fork、改、商用，保留版权声明即可。

## 相关

- [ziwei-time](https://github.com/ziweiai/ziwei-time) —— 真太阳时与时辰换算（IANA 时区 / 夏令时 / 均时差 / 晚子时）
- 在线使用：<https://ziweiai.cn>
