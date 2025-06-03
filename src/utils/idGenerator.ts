//src/utils/idGenerator.ts

/**
 * 고유 ID 생성 함수
 * 타임스탬프와 랜덤 문자열을 조합하여 충돌 가능성을 최소화
 */
export const generateId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 9);
  return `${timestamp}_${randomStr}`;
};

/**
 * 제약조건용 색상 생성 (시각적 구분을 위해)
 */
const CONSTRAINT_COLORS = [
  '#3B82F6', // blue-500
  '#EF4444', // red-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#6B7280', // gray-500
  '#059669', // emerald-600
  '#DC2626', // red-600
  '#7C3AED', // violet-600
];

let colorIndex = 0;

/**
 * 제약조건용 랜덤 색상 생성
 */
export const generateConstraintColor = (): string => {
  const color = CONSTRAINT_COLORS[colorIndex % CONSTRAINT_COLORS.length];
  colorIndex++;
  return color;
};

/**
 * 색상 초기화 (새로운 세션 시작 시)
 */
export const resetColorIndex = (): void => {
  colorIndex = 0;
};