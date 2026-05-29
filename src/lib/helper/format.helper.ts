export const formatAverage = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);
