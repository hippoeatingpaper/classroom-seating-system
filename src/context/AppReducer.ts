//src/context/AppReducer.tsx
import { AppState, AppAction, Student, ClassroomConfig } from '@/types';
import { generateId } from '@/utils/idGenerator';

/**
 * 기본 학생 명단 생성
 */
const createDefaultStudents = (): Student[] => {
  const defaultStudentData = [
    { "번호": 1, "이름": "강민지", "성별": "여" },
    { "번호": 2, "이름": "고은지", "성별": "여" },
    { "번호": 3, "이름": "김나연", "성별": "여" },
    { "번호": 4, "이름": "김도현", "성별": "남" },
    { "번호": 5, "이름": "김민준", "성별": "남" },
    { "번호": 6, "이름": "김서연", "성별": "여" },
    { "번호": 7, "이름": "박서준", "성별": "남" },
    { "번호": 8, "이름": "박수현", "성별": "여" },
    { "번호": 9, "이름": "박지후", "성별": "남" },
    { "번호": 10, "이름": "서지민", "성별": "여" },
    { "번호": 11, "이름": "송하윤", "성별": "여" },
    { "번호": 12, "이름": "신유진", "성별": "여" },
    { "번호": 13, "이름": "안지호", "성별": "남" },
    { "번호": 14, "이름": "오예은", "성별": "여" },
    { "번호": 15, "이름": "유서연", "성별": "여" },
    { "번호": 16, "이름": "이건우", "성별": "남" },
    { "번호": 17, "이름": "이서준", "성별": "남" },
    { "번호": 18, "이름": "이시우", "성별": "남" },
    { "번호": 19, "이름": "이하늘", "성별": "여" },
    { "번호": 20, "이름": "장민재", "성별": "남" },
    { "번호": 21, "이름": "전예은", "성별": "여" },
    { "번호": 22, "이름": "정다은", "성별": "여" },
    { "번호": 23, "이름": "정유진", "성별": "여" },
    { "번호": 24, "이름": "조현우", "성별": "남" },
    { "번호": 25, "이름": "최지훈", "성별": "남" }
  ];

  return defaultStudentData.map(student => ({
    id: generateId(),
    name: student.이름,
    gender: student.성별 === '남' ? 'male' as const : 'female' as const,
    number: student.번호,
    createdAt: new Date(),
  }));
};

const createInitialState = (): AppState => ({
  students: createDefaultStudents(),
  classroom: {
    rows: 5,
    cols: 5,
    name: '',
    pairColumns: [[0, 1], [2, 3]], // 기본값: 1-2열, 3-4열이 짝
    seatGenderConstraints: [],
    seatUsageConstraints: [],
    createdAt: new Date(),
  },
  constraints: {
    pairRequired: [],
    pairProhibited: [],
    distanceRules: [],
    rowExclusions: [],
  },
  currentSeating: {},
  ui: {
    selectedStudents: [],
    draggedStudent: null,
    loading: false,
    activeModal: null,
    contextMenu: {
      visible: false,
      position: { x: 0, y: 0 },
      seatPosition: null,
    },
  },
});

export const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    // 학생 관리
    case 'ADD_STUDENT':
      return {
        ...state,
        students: [...state.students, action.payload],
      };

    case 'REMOVE_STUDENT': {
      const removedStudentId = action.payload;
      
      // 좌석 배치에서 해당 학생 제거
      const newSeating = { ...state.currentSeating };
      Object.keys(newSeating).forEach(posKey => {
        if (newSeating[posKey] === removedStudentId) {
          delete newSeating[posKey];
        }
      });

      // 제약조건에서 해당 학생 제거
      const newConstraints = {
        pairRequired: state.constraints.pairRequired.filter(
          c => !c.students.includes(removedStudentId)
        ),
        pairProhibited: state.constraints.pairProhibited.filter(
          c => !c.students.includes(removedStudentId)
        ),
        distanceRules: state.constraints.distanceRules.filter(
          c => !c.students.includes(removedStudentId)
        ),
        rowExclusions: state.constraints.rowExclusions.filter(
          c => c.studentId !== removedStudentId
        ),
      };

      return {
        ...state,
        students: state.students.filter(s => s.id !== removedStudentId),
        currentSeating: newSeating,
        constraints: newConstraints,
      };
    }

    case 'UPDATE_STUDENT':
      return {
        ...state,
        students: state.students.map(s => 
          s.id === action.payload.id 
            ? { ...s, ...action.payload.updates }
            : s
        ),
      };

    case 'SET_STUDENTS':
      return {
        ...state,
        students: action.payload,
      };

    // 교실 설정
    case 'UPDATE_CLASSROOM':
      return {
        ...state,
        classroom: { ...state.classroom, ...action.payload },
        // 교실 크기가 변경되면 범위를 벗어난 좌석의 학생들 제거
        currentSeating: action.payload.rows || action.payload.cols 
          ? validateSeatingBounds(state.currentSeating, {
              ...state.classroom,
              ...action.payload
            })
          : state.currentSeating,
      };

    // 제약조건
    case 'SET_CONSTRAINTS':
      return {
        ...state,
        constraints: action.payload,
      };

    // 좌석 성별 제약조건
    case 'SET_SEAT_GENDER_CONSTRAINT': {
      const { position, requiredGender, isLocked } = action.payload;
      
      const updatedConstraints = state.classroom.seatGenderConstraints.filter(
        c => !(c.position.row === position.row && c.position.col === position.col)
      );

      if (requiredGender !== null || isLocked) {
        updatedConstraints.push(action.payload);
      }

      return {
        ...state,
        classroom: {
          ...state.classroom,
          seatGenderConstraints: updatedConstraints,
        },
      };
    }

    case 'REMOVE_SEAT_GENDER_CONSTRAINT':
      return {
        ...state,
        classroom: {
          ...state.classroom,
          seatGenderConstraints: state.classroom.seatGenderConstraints.filter(
            c => !(c.position.row === action.payload.row && c.position.col === action.payload.col)
          ),
        },
      };

    // 좌석 사용 제약조건
    case 'SET_SEAT_USAGE_CONSTRAINT': {
      const { position, isDisabled } = action.payload;
      
      const updatedConstraints = state.classroom.seatUsageConstraints.filter(
        c => !(c.position.row === position.row && c.position.col === position.col)
      );

      if (isDisabled) {
        updatedConstraints.push(action.payload);
        
        // 사용 불가로 설정된 좌석에 학생이 있다면 제거
        const positionKey = `${position.row}-${position.col}`;
        const newSeating = { ...state.currentSeating };
        if (newSeating[positionKey]) {
          delete newSeating[positionKey];
        }

        return {
          ...state,
          classroom: {
            ...state.classroom,
            seatUsageConstraints: updatedConstraints,
          },
          currentSeating: newSeating,
        };
      } else {
        return {
          ...state,
          classroom: {
            ...state.classroom,
            seatUsageConstraints: updatedConstraints,
          },
        };
      }
    }

    case 'REMOVE_SEAT_USAGE_CONSTRAINT':
      return {
        ...state,
        classroom: {
          ...state.classroom,
          seatUsageConstraints: state.classroom.seatUsageConstraints.filter(
            c => !(c.position.row === action.payload.row && c.position.col === action.payload.col)
          ),
        },
      };

    // 짝 제약조건 관리
    case 'ADD_PAIR_CONSTRAINT': {
      const { type, constraint } = action.payload;
      const newConstraint = {
        ...constraint,
        id: generateId(),
        createdAt: new Date(),
      };

      const targetArray = type === 'required' ? 'pairRequired' : 'pairProhibited';
      
      return {
        ...state,
        constraints: {
          ...state.constraints,
          [targetArray]: [...state.constraints[targetArray], newConstraint],
        },
      };
    }

    case 'REMOVE_PAIR_CONSTRAINT': {
      const constraintId = action.payload;
      
      return {
        ...state,
        constraints: {
          ...state.constraints,
          pairRequired: state.constraints.pairRequired.filter(c => c.id !== constraintId),
          pairProhibited: state.constraints.pairProhibited.filter(c => c.id !== constraintId),
        },
      };
    }

    case 'UPDATE_PAIR_CONSTRAINT': {
      const { id, updates } = action.payload;
      
      const updateConstraintInArray = (constraints: any[]) => 
        constraints.map(c => c.id === id ? { ...c, ...updates } : c);
      
      return {
        ...state,
        constraints: {
          ...state.constraints,
          pairRequired: updateConstraintInArray(state.constraints.pairRequired),
          pairProhibited: updateConstraintInArray(state.constraints.pairProhibited),
        },
      };
    }

    // 거리 제약조건 관리
    case 'ADD_DISTANCE_CONSTRAINT': {
      const newConstraint = {
        ...action.payload,
        id: generateId(),
        createdAt: new Date(),
      };
      
      return {
        ...state,
        constraints: {
          ...state.constraints,
          distanceRules: [...state.constraints.distanceRules, newConstraint],
        },
      };
    }

    case 'REMOVE_DISTANCE_CONSTRAINT': {
      const constraintId = action.payload;
      
      return {
        ...state,
        constraints: {
          ...state.constraints,
          distanceRules: state.constraints.distanceRules.filter(c => c.id !== constraintId),
        },
      };
    }

    case 'UPDATE_DISTANCE_CONSTRAINT': {
      const { id, distance } = action.payload;
      
      return {
        ...state,
        constraints: {
          ...state.constraints,
          distanceRules: state.constraints.distanceRules.map(c => 
            c.id === id ? { ...c, minDistance: distance } : c
          ),
        },
      };
    }

    // 줄 제외 제약조건 관리
    case 'ADD_ROW_EXCLUSION_CONSTRAINT': {
      const newConstraint = {
        ...action.payload,
        id: generateId(),
        createdAt: new Date(),
      };
      
      return {
        ...state,
        constraints: {
          ...state.constraints,
          rowExclusions: [...state.constraints.rowExclusions, newConstraint],
        },
      };
    }

    case 'REMOVE_ROW_EXCLUSION_CONSTRAINT': {
      const constraintId = action.payload;
      
      return {
        ...state,
        constraints: {
          ...state.constraints,
          rowExclusions: state.constraints.rowExclusions.filter(c => c.id !== constraintId),
        },
      };
    }

    case 'UPDATE_ROW_EXCLUSION_CONSTRAINT': {
      const { id, excludedRowsFromBack } = action.payload;
      
      return {
        ...state,
        constraints: {
          ...state.constraints,
          rowExclusions: state.constraints.rowExclusions.map(c => 
            c.id === id ? { ...c, excludedRowsFromBack } : c
          ),
        },
      };
    }

    // 좌석 배치
    case 'SET_SEATING':
      return {
        ...state,
        currentSeating: action.payload,
      };

    case 'MOVE_STUDENT': {
      const { studentId, position } = action.payload;
      const positionKey = `${position.row}-${position.col}`;
      
      // 사용 불가 좌석인지 확인
      const isDisabledSeat = state.classroom.seatUsageConstraints.some(
        c => c.position.row === position.row && 
            c.position.col === position.col && 
            c.isDisabled
      );
      
      if (isDisabledSeat) {
        // 사용 불가 좌석이면 배치하지 않음
        return state;
      }
      
      // 기존 위치에서 학생 제거
      const newSeating = { ...state.currentSeating };
      Object.keys(newSeating).forEach(key => {
        if (newSeating[key] === studentId) {
          delete newSeating[key];
        }
      });
      
      // 새 위치에 학생 배치
      newSeating[positionKey] = studentId;

      return {
        ...state,
        currentSeating: newSeating,
      };
    }

    case 'GENERATE_SEATING':
      return {
        ...state,
        currentSeating: action.payload,
      };

    case 'CLEAR_SEATING':
      return {
        ...state,
        currentSeating: {},
      };

    // UI 상태
    case 'SET_UI_STATE':
      return {
        ...state,
        ui: { ...state.ui, ...action.payload },
      };

    case 'SHOW_CONTEXT_MENU':
      return {
        ...state,
        ui: {
          ...state.ui,
          contextMenu: {
            visible: true,
            position: action.payload.position,
            seatPosition: action.payload.seatPosition,
          },
        },
      };

    case 'HIDE_CONTEXT_MENU':
      return {
        ...state,
        ui: {
          ...state.ui,
          contextMenu: {
            ...state.ui.contextMenu,
            visible: false,
          },
        },
      };

    case 'SET_LOADING':
      return {
        ...state,
        ui: { ...state.ui, loading: action.payload },
      };

    // 전체 초기화
    case 'RESET_ALL':
      // 완전한 초기 상태로 복원
      return createInitialState();

    default:
      return state;
  }
};

// 교실 크기 변경 시 좌석 유효성 검사
const validateSeatingBounds = (seating: any, classroom: ClassroomConfig) => {
  const validSeating: any = {};
  
  Object.entries(seating).forEach(([posKey, studentId]) => {
    const [row, col] = posKey.split('-').map(Number);
    if (row < classroom.rows && col < classroom.cols) {
      // 사용 불가 좌석이 아닌 경우만 유지
      const isDisabled = classroom.seatUsageConstraints?.some(
        c => c.position.row === row && c.position.col === col && c.isDisabled
      );
      if (!isDisabled) {
        validSeating[posKey] = studentId;
      }
    }
  });
  
  return validSeating;
};

export { createInitialState };