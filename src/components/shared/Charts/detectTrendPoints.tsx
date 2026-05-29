const detectTrendPoints = (
  data: number[],
  minGap = 3,
): { idx: number; dir: "up" | "down" }[] => {
  const results: { idx: number; dir: "up" | "down" }[] = [];
  let lastIdx = -99;

  for (let i = 1; i < data.length - 1; i++) {
    const prev = data[i - 1],
      cur = data[i],
      next = data[i + 1];
    const diff = cur - prev; // change from previous point
    const absDiff = Math.abs(diff);

    // Significant single-step jump (threshold ≥ 3 pts)
    const bigJump = absDiff >= 3;
    // Local minimum (valley) or local maximum (peak)
    const isValley = cur < prev && cur < next;
    const isPeak = cur > prev && cur > next;

    if ((bigJump || isValley || isPeak) && i - lastIdx >= minGap) {
      results.push({ idx: i, dir: diff >= 0 ? "up" : "down" });
      lastIdx = i;
    }
  }
  return results;
};
export default detectTrendPoints;
