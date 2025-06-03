//src/utils/constraintValidator.ts
import { 
  Position, 
  SeatingArrangement, 
  Student, 
  ClassroomConfig, 
  Constraints, 
  ConstraintViolation,
  PairConstraint,
  DistanceConstraint,
  RowExclusionConstraint
} from '@/types';

/**
 * 두 위치가 짝인지 확인
 * 짝의 정의: 같은 행에 있으면서, 연속된 홀수-짝수 열에 위치 (0-1, 2-3, 4-5, ...)
 */
export const isPairPosition = (pos1: Position, pos2: Position): boolean => {
  // 같은 행이 아니면 짝이 될 수 없음
  if (pos1.row !== pos2.row) return false;
  
  const col1 = pos1.col;
  const col2 = pos2.col;
  
  // 정렬해서 작은 것이 짝수, 큰 것이 홀수인지 확인
  const [smaller, larger] = [col1, col2].sort((a, b) => a - b);
  return smaller % 2 === 0 && larger === smaller + 1;
};

/**
 * 두 위치 간의 거리 계산 (체스판 거리 - 킹의 이동)
 * 행과 열 중 더 큰 차이를 반환
 */
export const calculateDistance = (pos1: Position, pos2: Position): number => {
  const rowDistance = Math.abs(pos1.row - pos2.row);
  const colDistance = Math.abs(pos1.col - pos2.col);
  return Math.max(rowDistance, colDistance);
};

/**
 * 좌석 배치에서 특정 학생의 위치 찾기
 */
export const findStudentPosition = (studentId: string, seating: SeatingArrangement): Position | null => {
  const positionKey = Object.keys(seating).find(key => seating[key] === studentId);
  if (!positionKey) return null;
  
  const [row, col] = positionKey.split('-').map(Number);
  return { row, col };
};

/**
 * 두 학생이 현재 짝으로 배치되어 있는지 확인
 */
export const areStudentsPaired = (
  student1Id: string, 
  student2Id: string, 
  seating: SeatingArrangement
): boolean => {
  const pos1 = findStudentPosition(student1Id, seating);
  const pos2 = findStudentPosition(student2Id, seating);
  
  if (!pos1 || !pos2) return false;
  return isPairPosition(pos1, pos2);
};

/**
 * 두 학생 간의 현재 거리 계산
 */
export const getStudentsDistance = (
  student1Id: string, 
  student2Id: string, 
  seating: SeatingArrangement
): number | null => {
  const pos1 = findStudentPosition(student1Id, seating);
  const pos2 = findStudentPosition(student2Id, seating);
  
  if (!pos1 || !pos2) return null;
  return calculateDistance(pos1, pos2);
};

/**
 * 특정 위치에서 지정된 거리 내의 모든 위치 찾기
 */
export const getPositionsWithinDistance = (
  center: Position, 
  distance: number, 
  classroom: ClassroomConfig
): Position[] => {
  const positions: Position[] = [];
  
  for (let row = 0; row < classroom.rows; row++) {
    for (let col = 0; col < classroom.cols; col++) {
      const pos = { row, col };
      if (calculateDistance(center, pos) < distance) {
        positions.push(pos);
      }
    }
  }
  
  return positions;
};

/**
 * 짝 강제 제약조건 위반 검사
 */
export const validatePairRequiredConstraints = (
  seating: SeatingArrangement,
  constraints: PairConstraint[],
  students: Student[]
): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  constraints.forEach(constraint => {
    const [student1Id, student2Id] = constraint.students;
    const student1 = students.find(s => s.id === student1Id);
    const student2 = students.find(s => s.id === student2Id);
    
    if (!student1 || !student2) {
      violations.push({
        type: 'pair_required',
        message: `짝 강제 제약조건에 존재하지 않는 학생이 포함됨`,
        studentIds: constraint.students,
      });
      return;
    }
    
    const pos1 = findStudentPosition(student1Id, seating);
    const pos2 = findStudentPosition(student2Id, seating);
    
    // 둘 중 하나라도 배치되지 않은 경우
    if (!pos1 || !pos2) {
      const unplacedStudents = [
        !pos1 ? student1.name : null,
        !pos2 ? student2.name : null,
      ].filter(Boolean);
      
      violations.push({
        type: 'pair_required',
        message: `짝 강제: ${student1.name}과 ${student2.name}이 짝이어야 하지만, ${unplacedStudents.join(', ')}이 배치되지 않음`,
        studentIds: constraint.students,
        positions: [pos1, pos2].filter(Boolean) as Position[],
      });
      return;
    }
    
    // 짝으로 배치되지 않은 경우
    if (!isPairPosition(pos1, pos2)) {
      violations.push({
        type: 'pair_required',
        message: `짝 강제: ${student1.name}과 ${student2.name}이 짝이어야 하지만 다른 위치에 배치됨`,
        studentIds: constraint.students,
        positions: [pos1, pos2],
      });
    }
  });
  
  return violations;
};

/**
 * 짝 방지 제약조건 위반 검사
 */
export const validatePairProhibitedConstraints = (
  seating: SeatingArrangement,
  constraints: PairConstraint[],
  students: Student[]
): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  constraints.forEach(constraint => {
    const [student1Id, student2Id] = constraint.students;
    const student1 = students.find(s => s.id === student1Id);
    const student2 = students.find(s => s.id === student2Id);
    
    if (!student1 || !student2) return;
    
    const pos1 = findStudentPosition(student1Id, seating);
    const pos2 = findStudentPosition(student2Id, seating);
    
    // 둘 다 배치되어 있고 짝으로 배치된 경우
    if (pos1 && pos2 && isPairPosition(pos1, pos2)) {
      violations.push({
        type: 'pair_prohibited',
        message: `짝 방지: ${student1.name}과 ${student2.name}이 짝이 되면 안 되지만 짝으로 배치됨`,
        studentIds: constraint.students,
        positions: [pos1, pos2],
      });
    }
  });
  
  return violations;
};

/**
 * 거리 제약조건 위반 검사
 */
export const validateDistanceConstraints = (
  seating: SeatingArrangement,
  constraints: DistanceConstraint[],
  students: Student[]
): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  constraints.forEach(constraint => {
    const [student1Id, student2Id] = constraint.students;
    const student1 = students.find(s => s.id === student1Id);
    const student2 = students.find(s => s.id === student2Id);
    
    if (!student1 || !student2) return;
    
    const distance = getStudentsDistance(student1Id, student2Id, seating);
    
    // 둘 다 배치되어 있고 거리가 부족한 경우
    if (distance !== null && distance < constraint.minDistance) {
      const pos1 = findStudentPosition(student1Id, seating)!;
      const pos2 = findStudentPosition(student2Id, seating)!;
      
      violations.push({
        type: 'distance',
        message: `거리 유지: ${student1.name}과 ${student2.name}은 최소 ${constraint.minDistance}칸 떨어져야 하지만 ${distance}칸 떨어져 있음`,
        studentIds: constraint.students,
        positions: [pos1, pos2],
      });
    }
  });
  
  return violations;
};

/**
 * 성별 제약조건 위반 검사
 */
export const validateGenderConstraints = (
  seating: SeatingArrangement,
  classroom: ClassroomConfig,
  students: Student[]
): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  Object.entries(seating).forEach(([positionKey, studentId]) => {
    const [row, col] = positionKey.split('-').map(Number);
    const position = { row, col };
    const student = students.find(s => s.id === studentId);
    
    if (!student) return;
    
    const genderConstraint = classroom.seatGenderConstraints?.find(
      c => c.position.row === row && c.position.col === col
    );
    
    if (genderConstraint && genderConstraint.requiredGender) {
      if (student.gender !== genderConstraint.requiredGender) {
        const requiredGenderText = genderConstraint.requiredGender === 'male' ? '남학생' : '여학생';
        const studentGenderText = student.gender === 'male' ? '남학생' : '여학생';
        
        violations.push({
          type: 'gender',
          message: `성별 제약: 좌석 ${row + 1}-${col + 1}은 ${requiredGenderText} 전용이지만 ${studentGenderText} ${student.name}이 배치됨`,
          studentIds: [studentId],
          positions: [position],
        });
      }
    }
  });
  
  return violations;
};

/**
 * 사용 불가 좌석 위반 검사
 */
export const validateDisabledSeatConstraints = (
  seating: SeatingArrangement,
  classroom: ClassroomConfig,
  students: Student[]
): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  Object.entries(seating).forEach(([positionKey, studentId]) => {
    const [row, col] = positionKey.split('-').map(Number);
    const student = students.find(s => s.id === studentId);
    
    if (!student) return;
    
    const usageConstraint = classroom.seatUsageConstraints?.find(
      c => c.position.row === row && c.position.col === col && c.isDisabled
    );
    
    if (usageConstraint) {
      violations.push({
        type: 'disabled_seat',
        message: `사용 불가 좌석: ${student.name}이 사용하지 않는 좌석 ${row + 1}-${col + 1}에 배치됨${usageConstraint.reason ? ` (${usageConstraint.reason})` : ''}`,
        studentIds: [studentId],
        positions: [{ row, col }],
      });
    }
  });
  
  return violations;
};

/**
 * 줄 제외 제약조건 위반 검사
 */
export const validateRowExclusionConstraints = (
  seating: SeatingArrangement,
  constraints: RowExclusionConstraint[],
  students: Student[],
  classroom: ClassroomConfig
): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  
  constraints.forEach(constraint => {
    const student = students.find(s => s.id === constraint.studentId);
    if (!student) return;
    
    const studentPosition = findStudentPosition(constraint.studentId, seating);
    if (!studentPosition) return; // 배치되지 않은 경우는 위반 아님
    
    // 뒤에서부터 N줄의 행 인덱스 계산
    const excludedRows = [];
    for (let i = 0; i < constraint.excludedRowsFromBack; i++) {
      excludedRows.push(classroom.rows - 1 - i);
    }
    
    if (excludedRows.includes(studentPosition.row)) {
      const rowNumber = studentPosition.row + 1;
      const excludedRowNumbers = excludedRows.map(r => r + 1).sort((a, b) => b - a);
      
      violations.push({
        type: 'row_exclusion',
        message: `줄 제외: ${student.name}이 ${rowNumber}번 줄에 배치되었지만, ${excludedRowNumbers.join(', ')}번 줄에는 앉을 수 없습니다`,
        studentIds: [constraint.studentId],
        positions: [studentPosition],
      });
    }
  });
  
  return violations;
};

/**
 * 학생이 특정 위치에 앉을 수 있는지 확인 (줄 제외 제약조건 포함)
 */
export const canStudentSitAtPosition = (
  studentId: string,
  position: Position,
  classroom: ClassroomConfig,
  rowExclusions: RowExclusionConstraint[]
): boolean => {
  const exclusion = rowExclusions.find(re => re.studentId === studentId);
  if (!exclusion) return true;
  
  // 뒤에서부터 N줄 제외 확인
  const excludedRows = [];
  for (let i = 0; i < exclusion.excludedRowsFromBack; i++) {
    excludedRows.push(classroom.rows - 1 - i);
  }
  
  return !excludedRows.includes(position.row);
};

/**
 * 모든 제약조건 검증
 */
export const validateAllConstraints = (
  seating: SeatingArrangement,
  students: Student[],
  classroom: ClassroomConfig,
  constraints: Constraints
): { isValid: boolean; violations: ConstraintViolation[] } => {
  const allViolations: ConstraintViolation[] = [
    ...validatePairRequiredConstraints(seating, constraints.pairRequired, students),
    ...validatePairProhibitedConstraints(seating, constraints.pairProhibited, students),
    ...validateDistanceConstraints(seating, constraints.distanceRules, students),
    ...validateGenderConstraints(seating, classroom, students),
    ...validateDisabledSeatConstraints(seating, classroom, students),
    ...validateRowExclusionConstraints(seating, constraints.rowExclusions, students, classroom), // 새로 추가
  ];
  
  return {
    isValid: allViolations.length === 0,
    violations: allViolations,
  };
};

/**
 * 제약조건들 간의 충돌 검사 (배치 전 사전 검증)
 */
export const validateConstraintCompatibility = (
  constraints: Constraints,
  students: Student[],
  classroom: ClassroomConfig
): { isValid: boolean; conflicts: string[] } => {
  const conflicts: string[] = [];
  
  // 1. 같은 학생 쌍에 대한 짝 강제와 짝 방지 동시 적용 체크
  constraints.pairRequired.forEach(required => {
    const conflicting = constraints.pairProhibited.find(prohibited => 
      (required.students[0] === prohibited.students[0] && required.students[1] === prohibited.students[1]) ||
      (required.students[0] === prohibited.students[1] && required.students[1] === prohibited.students[0])
    );
    
    if (conflicting) {
      const student1 = students.find(s => s.id === required.students[0]);
      const student2 = students.find(s => s.id === required.students[1]);
      conflicts.push(`${student1?.name}과 ${student2?.name}에 대해 짝 강제와 짝 방지가 동시에 설정됨`);
    }
  });
  
  // 2. 짝 강제 + 성별 제약 충돌 체크
  constraints.pairRequired.forEach(pairConstraint => {
    const [student1Id, student2Id] = pairConstraint.students;
    const student1 = students.find(s => s.id === student1Id);
    const student2 = students.find(s => s.id === student2Id);
    
    if (!student1 || !student2) return;
    
    // 같은 성별인 경우, 남녀 전용 좌석이 짝으로 설정된 경우 충돌 가능성 체크
    if (student1.gender === student2.gender) {
      const availablePairs = getAvailablePairSeats(classroom);
      const compatiblePairs = availablePairs.filter(pair => {
        return pair.every(pos => {
          const genderReq = getSeatGenderRequirement(pos, classroom);
          return !genderReq || genderReq === student1.gender;
        });
      });
      
      if (compatiblePairs.length === 0) {
        conflicts.push(`${student1.name}과 ${student2.name}(모두 ${student1.gender === 'male' ? '남학생' : '여학생'})이 짝 강제로 설정되었지만, 해당 성별이 함께 앉을 수 있는 짝 좌석이 없음`);
      }
    }
  });
  
  // 3. 거리 제약 + 짝 강제 충돌 체크
  constraints.distanceRules.forEach(distanceConstraint => {
    const conflicting = constraints.pairRequired.find(pairConstraint => 
      (distanceConstraint.students[0] === pairConstraint.students[0] && distanceConstraint.students[1] === pairConstraint.students[1]) ||
      (distanceConstraint.students[0] === pairConstraint.students[1] && distanceConstraint.students[1] === pairConstraint.students[0])
    );
    
    if (conflicting && distanceConstraint.minDistance > 1) {
      const student1 = students.find(s => s.id === distanceConstraint.students[0]);
      const student2 = students.find(s => s.id === distanceConstraint.students[1]);
      conflicts.push(`${student1?.name}과 ${student2?.name}에 대해 짝 강제와 거리 유지(${distanceConstraint.minDistance}칸)가 동시에 설정됨 (짝은 거리 1)`);
    }
  });
  
  return {
    isValid: conflicts.length === 0,
    conflicts,
  };
};

/**
 * 헬퍼 함수들
 */
const getSeatGenderRequirement = (position: Position, classroom: ClassroomConfig): 'male' | 'female' | null => {
  const constraint = classroom.seatGenderConstraints?.find(
    c => c.position.row === position.row && c.position.col === position.col
  );
  return constraint?.requiredGender || null;
};

const getAvailablePairSeats = (classroom: ClassroomConfig): Position[][] => {
  const pairs: Position[][] = [];
  
  classroom.pairColumns?.forEach(pairCols => {
    for (let row = 0; row < classroom.rows; row++) {
      const leftSeat = { row, col: pairCols[0] };
      const rightSeat = { row, col: pairCols[1] };
      
      // 둘 다 사용 가능한지 확인
      const leftDisabled = classroom.seatUsageConstraints?.some(
        c => c.position.row === leftSeat.row && c.position.col === leftSeat.col && c.isDisabled
      );
      const rightDisabled = classroom.seatUsageConstraints?.some(
        c => c.position.row === rightSeat.row && c.position.col === rightSeat.col && c.isDisabled
      );
      
      if (!leftDisabled && !rightDisabled) {
        pairs.push([leftSeat, rightSeat]);
      }
    }
  });
  
  return pairs;
};