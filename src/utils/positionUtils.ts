//src/utils/positionUtils.ts
export const getPositionKey = (row: number, col: number): string => {
  return `${row}-${col}`;
};

export const parsePositionKey = (posKey: string): { row: number; col: number } => {
  const [row, col] = posKey.split('-').map(Number);
  return { row, col };
};