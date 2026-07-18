/** 解析中文数字为阿拉伯数字 */
const CHINESE_NUM_MAP: Record<string, number> = {
  "零": 0, "一": 1, "二": 2, "三": 3, "四": 4,
  "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
  "十": 10, "百": 100, "千": 1000, "万": 10000,
};

export function parseChineseNumber(text: string): number {
  const cleaned = text.replace(/\s+/g, "").trim();
  if (!cleaned) return 0;

  const num = Number(cleaned);
  if (!isNaN(num)) return num;

  let result = 0;
  let current = 0;

  for (const char of cleaned) {
    const val = CHINESE_NUM_MAP[char];
    if (val === undefined) continue;

    if (val >= 10) {
      if (current === 0) current = 1;
      result += current * val;
      current = 0;
    } else {
      current = val;
    }
  }

  return result + current;
}
