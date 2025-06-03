//src/utils/seatingAlgorithm.ts
import { Student, ClassroomConfig, Constraints, SeatingArrangement, Position, PlacementResult } from '@/types';
import { 
  isPairPosition, 
  calculateDistance, 
  validateAllConstraints,
  findStudentPosition
} from './constraintValidator';
import { 
  generateAdvancedHeuristicPlacement,
  generateConstraintFocusedHeuristicPlacement
} from './advancedBacktrackingAlgorithm';

// interface SeatGroups {
//   maleOnlySeats: Position[];
//   femaleOnlySeats: Position[];
//   pairSeats: Position[][];
//   freeSeats: Position[];
// }

// interface StudentGroups {
//   males: Student[];
//   females: Student[];
// }

// interface ConstraintGroup {
//   requiredPairs: { students: [string, string]; constraint: any }[];
//   prohibitedPairs: { students: [string, string]; constraint: any }[];
//   distanceRules: { students: [string, string]; minDistance: number; constraint: any }[];
//   rowExclusions: { studentId: string; excludedRowsFromBack: number; constraint: any }[];
// }

// interface AlgorithmMetrics {
//   complexity: number;
//   constraintDensity: number;
//   studentToSeatRatio: number;
//   timeEstimate: number;
//   recommendedAlgorithm: string;
// }

/**
 * 사용 가능한 좌석만 필터링
 */
export const getAvailableSeats = (classroom: ClassroomConfig): Position[] => {
  const seats: Position[] = [];
  
  for (let row = 0; row < classroom.rows; row++) {
    for (let col = 0; col < classroom.cols; col++) {
      const isDisabled = classroom.seatUsageConstraints?.some(
        c => c.position.row === row && c.position.col === col && c.isDisabled
      );
      
      if (!isDisabled) {
        seats.push({ row, col });
      }
    }
  }
  
  return seats;
};

/**
 * 좌석의 성별 제약조건 확인
 */
// const getSeatGenderRequirement = (position: Position, classroom: ClassroomConfig): 'male' | 'female' | null => {
//   const constraint = classroom.seatGenderConstraints?.find(
//     c => c.position.row === position.row && c.position.col === position.col
//   );
//   return constraint?.requiredGender || null;
// };

/**
 * 학생이 특정 좌석에 앉을 수 있는지 기본 검사 (성별, 사용불가, 줄제외)
 */
const canStudentPlaceAt = (
  student: Student, 
  position: Position, 
  classroom: ClassroomConfig, 
  constraints: Constraints
): boolean => {
  // 1. 성별 제약조건 체크
  const genderConstraint = classroom.seatGenderConstraints?.find(
    c => c.position.row === position.row && c.position.col === position.col
  );
  if (genderConstraint?.requiredGender && student.gender !== genderConstraint.requiredGender) {
    return false;
  }

  // 2. 사용 불가 좌석 체크
  const usageConstraint = classroom.seatUsageConstraints?.find(
    c => c.position.row === position.row && c.position.col === position.col && c.isDisabled
  );
  if (usageConstraint) {
    return false;
  }

  // 3. 줄 제외 제약조건 체크
  const rowExclusion = constraints.rowExclusions.find(re => re.studentId === student.id);
  if (rowExclusion) {
    // 뒤에서부터 N줄 제외 확인
    const excludedRows = [];
    for (let i = 0; i < rowExclusion.excludedRowsFromBack; i++) {
      excludedRows.push(classroom.rows - 1 - i);
    }
    if (excludedRows.includes(position.row)) {
      return false;
    }
  }

  return true;
};

/**
 * 모든 알고리즘에서 사용할 통합 검증 함수
 */
export const isValidStudentPlacement = (
  student: Student,
  position: Position,
  classroom: ClassroomConfig,
  constraints: Constraints,
  currentSeating?: SeatingArrangement
): boolean => {
  // 기본 제약조건들 (성별, 사용불가, 줄제외)
  if (!canStudentPlaceAt(student, position, classroom, constraints)) {
    return false;
  }

  // 현재 배치 상황이 주어진 경우 추가 검증
  if (currentSeating) {
    // 이미 다른 학생이 앉아있는지 확인
    const posKey = `${position.row}-${position.col}`;
    if (currentSeating[posKey] && currentSeating[posKey] !== student.id) {
      return false;
    }

    // 거리 제약조건 체크
    for (const rule of constraints.distanceRules) {
      if (rule.students.includes(student.id)) {
        const otherId = rule.students.find(id => id !== student.id);
        if (otherId) {
          const otherPosition = findStudentPosition(otherId, currentSeating);
          if (otherPosition) {
            const distance = calculateDistance(position, otherPosition);
            if (distance < rule.minDistance) {
              return false;
            }
          }
        }
      }
    }

    // 짝 방지 제약조건 체크
    for (const rule of constraints.pairProhibited) {
      if (rule.students.includes(student.id)) {
        const otherId = rule.students.find(id => id !== student.id);
        if (otherId) {
          const otherPosition = findStudentPosition(otherId, currentSeating);
          if (otherPosition && isPairPosition(position, otherPosition)) {
            return false;
          }
        }
      }
    }
  }

  return true;
};

/**
 * 학생의 배치 가능한 모든 좌석 반환
 */
export const getValidSeatsForStudent = (
  student: Student,
  classroom: ClassroomConfig,
  constraints: Constraints,
  currentSeating?: SeatingArrangement
): Position[] => {
  const availableSeats = getAvailableSeats(classroom);
  
  return availableSeats.filter(seat => 
    isValidStudentPlacement(student, seat, classroom, constraints, currentSeating)
  );
};

/**
 * 좌석을 제약조건별로 분류
 */
// const classifySeats = (classroom: ClassroomConfig): SeatGroups => {
//   const availableSeats = getAvailableSeats(classroom);
//   const groups: SeatGroups = {
//     maleOnlySeats: [],
//     femaleOnlySeats: [],
//     pairSeats: [],
//     freeSeats: []
//   };

//   // 성별 제약 좌석 분류
//   const constrainedSeats = new Set<string>();
//   availableSeats.forEach(seat => {
//     const requirement = getSeatGenderRequirement(seat, classroom);
//     if (requirement === 'male') {
//       groups.maleOnlySeats.push(seat);
//       constrainedSeats.add(`${seat.row}-${seat.col}`);
//     } else if (requirement === 'female') {
//       groups.femaleOnlySeats.push(seat);
//       constrainedSeats.add(`${seat.row}-${seat.col}`);
//     }
//   });

//   // 짝 좌석 분류 (제약이 없는 좌석들만)
//   const usedInPairs = new Set<string>();
//   classroom.pairColumns?.forEach(pairCols => {
//     for (let row = 0; row < classroom.rows; row++) {
//       const leftSeat = { row, col: pairCols[0] };
//       const rightSeat = { row, col: pairCols[1] };
//       const leftKey = `${leftSeat.row}-${leftSeat.col}`;
//       const rightKey = `${rightSeat.row}-${rightSeat.col}`;

//       // 둘 다 사용 가능하고 제약이 없는 경우만 짝으로 처리
//       const leftAvailable = availableSeats.some(s => s.row === leftSeat.row && s.col === leftSeat.col);
//       const rightAvailable = availableSeats.some(s => s.row === rightSeat.row && s.col === rightSeat.col);
      
//       if (leftAvailable && rightAvailable && 
//           !constrainedSeats.has(leftKey) && !constrainedSeats.has(rightKey)) {
//         groups.pairSeats.push([leftSeat, rightSeat]);
//         usedInPairs.add(leftKey);
//         usedInPairs.add(rightKey);
//       }
//     }
//   });

//   // 나머지는 자유 좌석
//   groups.freeSeats = availableSeats.filter(seat => {
//     const key = `${seat.row}-${seat.col}`;
//     return !constrainedSeats.has(key) && !usedInPairs.has(key);
//   });

//   return groups;
// };

/**
 * 학생을 성별별로 분류
 */
// const classifyStudents = (students: Student[]): StudentGroups => {
//   return {
//     males: students.filter(s => s.gender === 'male'),
//     females: students.filter(s => s.gender === 'female')
//   };
// };

/**
 * 제약조건을 그룹별로 분류
 */
// const classifyConstraints = (constraints: Constraints): ConstraintGroup => {
//   return {
//     requiredPairs: constraints.pairRequired.map(c => ({
//       students: c.students,
//       constraint: c
//     })),
//     prohibitedPairs: constraints.pairProhibited.map(c => ({
//       students: c.students,
//       constraint: c
//     })),
//     distanceRules: constraints.distanceRules.map(c => ({
//       students: c.students,
//       minDistance: c.minDistance,
//       constraint: c
//     })),
//     rowExclusions: constraints.rowExclusions.map(c => ({
//       studentId: c.studentId,
//       excludedRowsFromBack: c.excludedRowsFromBack,
//       constraint: c
//     }))
//   };
// };

/**
 * 배열을 섞는 함수
 */
// const shuffle = <T>(array: T[]): T[] => {
//   const shuffled = [...array];
//   for (let i = shuffled.length - 1; i > 0; i--) {
//     const j = Math.floor(Math.random() * (i + 1));
//     [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
//   }
//   return shuffled;
// };

/**
 * 학생의 배치 우선순위 계산
 */
// const calculateStudentPlacementPriority = (
//   student: Student,
//   availableSeats: Position[],
//   seating: SeatingArrangement,
//   classroom: ClassroomConfig,
//   constraintGroups: ConstraintGroup
// ): number => {
//   let priority = 0;
  
//   // 제약조건 수에 따른 우선순위
//   const constraintCount = 
//     constraintGroups.requiredPairs.filter(rule => rule.students.includes(student.id)).length +
//     constraintGroups.prohibitedPairs.filter(rule => rule.students.includes(student.id)).length +
//     constraintGroups.distanceRules.filter(rule => rule.students.includes(student.id)).length +
//     (constraintGroups.rowExclusions.find(rule => rule.studentId === student.id) ? 1 : 0);
  
//   priority += constraintCount * 20;
  
//   // 앉을 수 있는 좌석 수가 적을수록 우선순위 높음
//   const validSeats = availableSeats.filter(seat => 
//     isValidStudentPlacement(student, seat, classroom, { 
//       pairRequired: constraintGroups.requiredPairs.map(r => r.constraint),
//       pairProhibited: constraintGroups.prohibitedPairs.map(r => r.constraint), 
//       distanceRules: constraintGroups.distanceRules.map(r => r.constraint),
//       rowExclusions: constraintGroups.rowExclusions.map(r => r.constraint)
//     }, seating)
//   );
  
//   if (validSeats.length <= 3) priority += 50;
//   else if (validSeats.length <= 5) priority += 30;
//   else if (validSeats.length <= 10) priority += 10;
  
//   return priority;
// };

/**
 * 통계 생성
 */
// const createStats = (
//   classroom: ClassroomConfig, 
//   students: Student[], 
//   seating: SeatingArrangement,
//   violations: ConstraintViolation[]
// ) => {
//   const totalSeats = classroom.rows * classroom.cols;
//   const availableSeats = getAvailableSeats(classroom).length;
//   const placedStudents = Object.keys(seating).length;
  
//   return {
//     totalSeats,
//     availableSeats,
//     disabledSeats: totalSeats - availableSeats,
//     placedStudents,
//     unplacedStudents: students.length - placedStudents,
//     constraintViolations: violations.length
//   };
// };

/**
 * 제약조건 기반 배치 (고급 휴리스틱 사용)
 */
export const generateConstraintBasedPlacement = async (
  students: Student[], 
  classroom: ClassroomConfig, 
  constraints: Constraints
): Promise<PlacementResult> => {
  return await generateConstraintFocusedHeuristicPlacement(students, classroom, constraints);
};

/**
 * 남녀 구분 배치 (개선된 버전)
 */
export const generateGenderBalancedPlacement = async (
  students: Student[], 
  classroom: ClassroomConfig,
  constraints: Constraints = { pairRequired: [], pairProhibited: [], distanceRules: [], rowExclusions: [] }
): Promise<PlacementResult> => {
  
  const result = await generateAdvancedHeuristicPlacement(students, classroom, constraints);
  
  return {
    ...result,
    message: result.message.replace('고급 휴리스틱 배치', '남녀 구분 배치'),
  };
};

/**
 * 좌석 배치 유효성 검증
 */
export const validateSeatingArrangement = (
  seating: SeatingArrangement,
  students: Student[],
  classroom: ClassroomConfig,
  constraints: Constraints
): { isValid: boolean; violations: string[] } => {
  const validation = validateAllConstraints(seating, students, classroom, constraints);
  
  return {
    isValid: validation.isValid,
    violations: validation.violations.map(v => v.message),
  };
};