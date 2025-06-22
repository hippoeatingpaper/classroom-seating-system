//src/utils/seatingAlgorithm.ts
import { Student, ClassroomConfig, Constraints, SeatingArrangement, Position, PlacementResult } from '@/types';
import { 
  isPairPosition, 
  calculateDistance, 
  validateAllConstraints,
  findStudentPosition
} from './constraintValidator';
import { 
  generateConstraintFocusedHeuristicPlacement
} from './advancedBacktrackingAlgorithm';

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
 * 남녀 구분 배치 - N쌍 우선 배치 + 나머지 랜덤 배치
 */
export const generateGenderBalancedPlacement = async (
  students: Student[], 
  classroom: ClassroomConfig,
  constraints: Constraints = { pairRequired: [], pairProhibited: [], distanceRules: [], rowExclusions: [] },
  pairCount: number = 0
): Promise<PlacementResult> => {

  if (students.length === 0) {
    return {
      success: false,
      seating: {},
      message: '배치할 학생이 없습니다.',
      stats: { totalSeats: 0, availableSeats: 0, disabledSeats: 0, placedStudents: 0, unplacedStudents: 0, constraintViolations: 0 }
    };
  }

  // 1. 좌석 성별 제약 초기화 (사용 안함 설정은 유지)
  const updatedClassroom: ClassroomConfig = {
    ...classroom,
    seatGenderConstraints: [] // 성별 제약 모두 제거
  };

  const availableSeats = getAvailableSeats(updatedClassroom);
  const seating: SeatingArrangement = {};

  // 2. 남녀 학생 분류 및 랜덤 셔플 추가
  const maleStudents = [...students.filter(s => s.gender === 'male')].sort(() => Math.random() - 0.5);
  const femaleStudents = [...students.filter(s => s.gender === 'female')].sort(() => Math.random() - 0.5);
  
  // 3. 실제 배치 가능한 쌍 수 계산
  const maxPossiblePairs = Math.min(maleStudents.length, femaleStudents.length);
  const actualPairCount = Math.min(pairCount, maxPossiblePairs);

  // 4. 짝 좌석 찾기
  const pairSeats = findAvailablePairSeats(updatedClassroom);

  // 짝 좌석 랜덤 셔플
  const shuffledPairSeats = [...pairSeats].sort(() => Math.random() - 0.5);
  
  // 5. N쌍의 남녀 우선 배치
  const placedStudents = new Set<string>();
  let pairsPlaced = 0;

  for (let i = 0; i < actualPairCount && pairsPlaced < actualPairCount; i++) {
    // 남은 학생들 중에서 랜덤 선택
    const availableMales = maleStudents.filter(s => !placedStudents.has(s.id));
    const availableFemales = femaleStudents.filter(s => !placedStudents.has(s.id));
    
    if (availableMales.length === 0 || availableFemales.length === 0) break;
    
    // 랜덤 인덱스로 학생 선택
    const maleIndex = Math.floor(Math.random() * availableMales.length);
    const femaleIndex = Math.floor(Math.random() * availableFemales.length);
    
    const maleStudent = availableMales[maleIndex];
    const femaleStudent = availableFemales[femaleIndex];
    
    if (!maleStudent || !femaleStudent) break;

    // shuffledPairSeats 사용
    const validPairSeat = findValidPairSeatForCouple(
      maleStudent, femaleStudent, shuffledPairSeats, updatedClassroom, constraints, seating
    );

    if (validPairSeat) {
      // 짝 배치 실행
      const posKey1 = `${validPairSeat[0].row}-${validPairSeat[0].col}`;
      const posKey2 = `${validPairSeat[1].row}-${validPairSeat[1].col}`;
      
      seating[posKey1] = maleStudent.id;
      seating[posKey2] = femaleStudent.id;
      
      placedStudents.add(maleStudent.id);
      placedStudents.add(femaleStudent.id);
      pairsPlaced++;

      // shuffledPairSeats에서 사용된 짝 좌석 제거
      const seatIndex = shuffledPairSeats.findIndex(pair => 
        (pair[0].row === validPairSeat[0].row && pair[0].col === validPairSeat[0].col) ||
        (pair[1].row === validPairSeat[0].row && pair[1].col === validPairSeat[0].col)
      );
      if (seatIndex >= 0) {
        shuffledPairSeats.splice(seatIndex, 1);
      }
    }
  }

  // 6. 나머지 학생들 랜덤 배치
  const remainingStudents = students.filter(s => !placedStudents.has(s.id));
  const usedPositions = new Set(Object.keys(seating));
  const remainingSeats = availableSeats.filter(seat => 
    !usedPositions.has(`${seat.row}-${seat.col}`)
  );

  // 랜덤 셔플
  const shuffledStudents = [...remainingStudents].sort(() => Math.random() - 0.5);
  const shuffledSeats = [...remainingSeats].sort(() => Math.random() - 0.5);

  for (let i = 0; i < shuffledStudents.length && i < shuffledSeats.length; i++) {
    const student = shuffledStudents[i];
    const seat = shuffledSeats[i];
    
    if (isValidStudentPlacement(student, seat, updatedClassroom, constraints, seating)) {
      const posKey = `${seat.row}-${seat.col}`;
      seating[posKey] = student.id;
      placedStudents.add(student.id);
    }
  }

  // 7. 제약조건 검증 및 경고
  const validation = validateAllConstraints(seating, students, updatedClassroom, constraints);
  
  // 8. 제약조건 위반 시 경고 처리
  if (validation.violations.length > 0) {
    // 기존과 동일한 방식으로 alert 표시
    const violationMessages = validation.violations.map(v => v.message).slice(0, 3);
    const remainingCount = validation.violations.length > 3 ? validation.violations.length - 3 : 0;
    
    let alertMessage = `배치 완료되었지만 다음 제약조건이 위반되었습니다:\n\n${violationMessages.join('\n')}`;
    if (remainingCount > 0) {
      alertMessage += `\n... 외 ${remainingCount}건 더`;
    }
    
    // 비동기적으로 alert 표시 (배치 결과 반환 후)
    setTimeout(() => {
      alert(alertMessage);
    }, 100);
  }

  // 9. 결과 생성
  const stats = {
    totalSeats: updatedClassroom.rows * updatedClassroom.cols,
    availableSeats: availableSeats.length,
    disabledSeats: (updatedClassroom.rows * updatedClassroom.cols) - availableSeats.length,
    placedStudents: placedStudents.size,
    unplacedStudents: students.length - placedStudents.size,
    constraintViolations: validation.violations.length
  };

  const message = `남녀 짝 배치: ${pairsPlaced}쌍 배치, 전체 ${stats.placedStudents}/${students.length}명 배치됨`;

  return {
    success: placedStudents.size === students.length,
    seating,
    message,
    violations: validation.violations,
    stats
  };
};

/**
 * 사용 가능한 짝 좌석들 찾기
 */
function findAvailablePairSeats(classroom: ClassroomConfig): Position[][] {
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
}

/**
 * 남녀 커플이 앉을 수 있는 유효한 짝 좌석 찾기
 */
function findValidPairSeatForCouple(
  maleStudent: Student,
  femaleStudent: Student,
  pairSeats: Position[][],
  classroom: ClassroomConfig,
  constraints: Constraints,
  currentSeating: SeatingArrangement
): Position[] | null {
  
  for (const pairSeat of pairSeats) {
    const [leftSeat, rightSeat] = pairSeat;
    
    // 🔥 새로운 로직: 성별 배치 위치 랜덤화 (문제2 해결)
    const arrangements = [
      { male: leftSeat, female: rightSeat },
      { male: rightSeat, female: leftSeat }
    ];
    
    // 🔥 랜덤하게 배치 순서 결정
    const shuffledArrangements = Math.random() < 0.5 ? arrangements : arrangements.reverse();
    
    for (const arrangement of shuffledArrangements) {
      const tempSeating = { ...currentSeating };
      const maleKey = `${arrangement.male.row}-${arrangement.male.col}`;
      const femaleKey = `${arrangement.female.row}-${arrangement.female.col}`;
      
      // 임시 배치
      tempSeating[maleKey] = maleStudent.id;
      tempSeating[femaleKey] = femaleStudent.id;
      
      // 유효성 검증
      const maleValid = isValidStudentPlacement(maleStudent, arrangement.male, classroom, constraints, tempSeating);
      const femaleValid = isValidStudentPlacement(femaleStudent, arrangement.female, classroom, constraints, tempSeating);
      
      if (maleValid && femaleValid) {
        return [arrangement.male, arrangement.female];
      }
    }
  }
  
  return null;
}

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

/**
 * 제약조건 재시도 포함 배치 실행
 */
export const generatePlacementWithRetry = async (
  algorithmType: string,
  students: Student[],
  classroom: ClassroomConfig,
  constraints: Constraints,
  options: {
    enableRetry: boolean;
    maxRetries?: number;
    onProgress?: (attempt: number, maxAttempts: number) => void;
    algorithmOptions?: any;
  }
): Promise<PlacementResult> => {
  const maxRetries = options.maxRetries || 10;
  let bestResult: PlacementResult | null = null;
  let attempt = 1;

  while (attempt <= (options.enableRetry ? maxRetries : 1)) {
    // 진행 상황 알림
    if (options.onProgress) {
      options.onProgress(attempt, options.enableRetry ? maxRetries : 1);
    }

    // 알고리즘 실행
    let result: PlacementResult;
    
    switch (algorithmType) {
      case 'gender':
        result = await generateGenderBalancedPlacement(
          students, 
          classroom, 
          constraints,
          options.algorithmOptions?.pairCount || 0
        );
        break;
      case 'adaptive_random_subtle':
      case 'adaptive_random_balanced':
      case 'adaptive_random_creative':
      case 'adaptive_random_wild':
        // adaptive random 알고리즘들 - 각각 다른 시드 사용
        const { generateAdaptiveRandomPlacement } = await import('./adaptiveRandomHeuristics');
        result = await generateAdaptiveRandomPlacement(
          students,
          classroom,
          constraints,
          {
            ...options.algorithmOptions,
            seed: options.algorithmOptions?.seed === 0 ? Math.floor(Math.random() * 1000000) + attempt : options.algorithmOptions?.seed + attempt
          }
        );
        break;
      default:
        throw new Error(`지원하지 않는 알고리즘: ${algorithmType}`);
    }

    // 첫 번째 결과이거나 더 나은 결과인 경우 저장
    if (!bestResult || isBetterResult(result, bestResult)) {
      bestResult = result;
    }

    // 재시도가 비활성화되어 있거나 제약조건을 모두 만족하면 종료
    if (!options.enableRetry || bestResult.stats.constraintViolations === 0) {
      break;
    }

    attempt++;
  }

  // 최종 결과에 재시도 정보 추가
  if (bestResult && options.enableRetry && attempt > 1) {
    bestResult.message = `${bestResult.message} (${attempt - 1}회 재시도 후 최적 결과)`;
    // violations 정보가 누락되지 않도록 보장
    if (!bestResult.violations && bestResult.stats.constraintViolations > 0) {
      // 제약조건 재검증하여 violations 배열 생성
      const validation = validateAllConstraints(
        bestResult.seating, 
        students, 
        classroom, 
        constraints
      );
      bestResult.violations = validation.violations;
    }
  }

  return bestResult!;
};

/**
 * 배치 결과 품질 비교 (result1이 더 좋으면 true)
 */
const isBetterResult = (result1: PlacementResult, result2: PlacementResult): boolean => {
  // 1. 제약조건 위반이 적은 것이 최우선
  if (result1.stats.constraintViolations !== result2.stats.constraintViolations) {
    return result1.stats.constraintViolations < result2.stats.constraintViolations;
  }

  // 2. 배치된 학생 수가 많은 것이 좋음
  if (result1.stats.placedStudents !== result2.stats.placedStudents) {
    return result1.stats.placedStudents > result2.stats.placedStudents;
  }

  // 3. 배치되지 않은 학생이 적은 것이 좋음
  if (result1.stats.unplacedStudents !== result2.stats.unplacedStudents) {
    return result1.stats.unplacedStudents < result2.stats.unplacedStudents;
  }

  // 4. 성공 여부
  if (result1.success !== result2.success) {
    return result1.success;
  }

  return false;
};