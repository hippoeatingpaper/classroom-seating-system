//src/types/index.ts
export interface Student {
  id: string;
  name: string;
  gender: 'male' | 'female';
  number?: number;
  createdAt: Date;
}

export interface SeatGenderConstraint {
  position: { row: number; col: number };
  requiredGender: 'male' | 'female' | null;
  isLocked: boolean;
}

export interface SeatUsageConstraint {
  position: { row: number; col: number };
  isDisabled: boolean; // true면 사용하지 않는 좌석
  reason?: string; // 사용하지 않는 이유 (선택사항)
  createdAt: Date;
}

export interface ClassroomConfig {
  rows: number;
  cols: number;
  name: string;
  pairColumns: number[][];
  seatGenderConstraints: SeatGenderConstraint[];
  seatUsageConstraints: SeatUsageConstraint[];
  createdAt: Date;
}

// 짝 제약조건 (강제/방지)
export interface PairConstraint {
  id: string;
  students: [string, string]; // 정확히 2명으로 제한
  type: 'required' | 'prohibited';
  color?: string; // UI에서 시각적 구분을 위한 색상
  createdAt: Date;
}

// 거리 제약조건
export interface DistanceConstraint {
  id: string;
  students: [string, string]; // 정확히 2명으로 제한
  minDistance: number; // 최소 거리 (기본값: 2)
  createdAt: Date;
}

// 줄 제약조건
export interface RowExclusionConstraint {
  id: string;
  studentId: string;
  excludedRowsFromBack: number; // 뒤에서부터 제외할 줄 수 (1 = 맨 뒤 1줄)
  createdAt: Date;
}

export interface Constraints {
  pairRequired: PairConstraint[];     // 짝 강제
  pairProhibited: PairConstraint[];   // 짝 방지
  distanceRules: DistanceConstraint[]; // 거리 유지
  rowExclusions: RowExclusionConstraint[]; // 줄 제외
}

export interface FixedStudentPlacement {
  studentId: string;
  position: Position;
  fixedAt: Date;
}

export interface SeatingArrangement {
  [key: string]: string; // position -> studentId
}

export interface AppState {
  students: Student[];
  classroom: ClassroomConfig;
  constraints: Constraints;
  currentSeating: SeatingArrangement;
  fixedPlacements: FixedStudentPlacement[]; 
  ui: {
    selectedStudents: string[];
    draggedStudent: string | null;
    loading: boolean;
    activeModal: string | null;
    contextMenu: {
      visible: boolean;
      position: { x: number; y: number };
      seatPosition: { row: number; col: number } | null;
    };
  };
}

export interface ExcelColumnMapping {
  nameColumn: string;
  genderColumn: string;
  numberColumn: string;
}

export interface ExcelImportResult {
  headers: string[];
  data: any[][];
  previewData: Student[];
  columnMapping: ExcelColumnMapping;
}

// Position 인터페이스 추가 (제약조건 검증에 사용)
export interface Position {
  row: number;
  col: number;
}

// 제약조건 위반 정보
export interface ConstraintViolation {
  type: 'pair_required' | 'pair_prohibited' | 'distance' | 'gender' | 'disabled_seat' | 'row_exclusion';
  message: string;
  studentIds: string[];
  positions?: Position[];
}

// 고정 학생 배치 정보
export interface FixedStudentPlacement {
  id: string;
  studentId: string;
  position: Position;
  fixedAt: Date;
  reason?: string; // 고정 이유 (선택사항)
}

// 배치 결과 인터페이스
export interface PlacementResult {
  success: boolean;
  seating: SeatingArrangement;
  message: string;
  violations?: ConstraintViolation[];
  stats: {
    totalSeats: number;
    availableSeats: number;
    disabledSeats: number;
    placedStudents: number;
    unplacedStudents: number;
    constraintViolations: number;
  };
}

export type AppAction = 
  | { type: 'ADD_STUDENT'; payload: Student }
  | { type: 'REMOVE_STUDENT'; payload: string }
  | { type: 'UPDATE_STUDENT'; payload: { id: string; updates: Partial<Student> } }
  | { type: 'SET_STUDENTS'; payload: Student[] }
  | { type: 'UPDATE_CLASSROOM'; payload: Partial<ClassroomConfig> }
  | { type: 'SET_CONSTRAINTS'; payload: Constraints }
  | { type: 'SET_SEAT_GENDER_CONSTRAINT'; payload: SeatGenderConstraint }
  | { type: 'REMOVE_SEAT_GENDER_CONSTRAINT'; payload: { row: number; col: number } }
  | { type: 'SET_SEAT_USAGE_CONSTRAINT'; payload: SeatUsageConstraint }
  | { type: 'REMOVE_SEAT_USAGE_CONSTRAINT'; payload: { row: number; col: number } }
  // 제약조건 관련 액션들
  | { type: 'ADD_PAIR_CONSTRAINT'; payload: { type: 'required' | 'prohibited'; constraint: Omit<PairConstraint, 'id' | 'createdAt'> } }
  | { type: 'REMOVE_PAIR_CONSTRAINT'; payload: string }
  | { type: 'UPDATE_PAIR_CONSTRAINT'; payload: { id: string; updates: Partial<Omit<PairConstraint, 'id' | 'createdAt'>> } }
  | { type: 'ADD_DISTANCE_CONSTRAINT'; payload: Omit<DistanceConstraint, 'id' | 'createdAt'> }
  | { type: 'REMOVE_DISTANCE_CONSTRAINT'; payload: string }
  | { type: 'UPDATE_DISTANCE_CONSTRAINT'; payload: { id: string; distance: number } }
  // 기존 액션들
  | { type: 'SET_SEATING'; payload: SeatingArrangement }
  | { type: 'MOVE_STUDENT'; payload: { studentId: string; position: { row: number; col: number } } }
  | { type: 'SET_UI_STATE'; payload: Partial<AppState['ui']> }
  | { type: 'SHOW_CONTEXT_MENU'; payload: { position: { x: number; y: number }; seatPosition: { row: number; col: number } } }
  | { type: 'HIDE_CONTEXT_MENU' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'GENERATE_SEATING'; payload: SeatingArrangement }
  | { type: 'CLEAR_SEATING' }
  | { type: 'RESET_ALL' }
  | { type: 'ADD_ROW_EXCLUSION_CONSTRAINT'; payload: Omit<RowExclusionConstraint, 'id' | 'createdAt'> }
  | { type: 'REMOVE_ROW_EXCLUSION_CONSTRAINT'; payload: string }
  | { type: 'UPDATE_ROW_EXCLUSION_CONSTRAINT'; payload: { id: string; excludedRowsFromBack: number } }
  // 학생 고정 관련 액션들
  | { type: 'ADD_FIXED_PLACEMENT'; payload: Omit<FixedStudentPlacement, 'id' | 'fixedAt'> }
  | { type: 'REMOVE_FIXED_PLACEMENT'; payload: { row: number; col: number } }
  | { type: 'REMOVE_FIXED_PLACEMENT_BY_STUDENT'; payload: string } // studentId
  | { type: 'CLEAR_ALL_FIXED_PLACEMENTS' }
  | { type: 'SET_FIXED_PLACEMENTS'; payload: FixedStudentPlacement[] }