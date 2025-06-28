//src/utils/backtrackingAlgorithm.ts
import { Student, ClassroomConfig, Constraints, SeatingArrangement, Position, PlacementResult, ConstraintViolation, FixedStudentPlacement } from '@/types';
import { 
  isPairPosition, 
  calculateDistance, 
  validateAllConstraints,
  findStudentPosition
} from './constraintValidator';
import { getAvailableSeats, isValidStudentPlacement, createSeatingFromFixed, getAvailableSeatsExcludingFixed } from './seatingAlgorithm';

interface BacktrackingState {
  seating: SeatingArrangement;
  placedStudents: Set<string>;
  unplacedStudents: Student[];
  depth: number;
  violations: ConstraintViolation[];
}

interface ConstraintGraph {
  studentNodes: Map<string, StudentNode>;
  constraintEdges: ConstraintEdge[];
}

interface StudentNode {
  studentId: string;
  student: Student;
  constraints: ConstraintEdge[];
  priority: number; // 제약조건 수에 따른 우선순위
}

interface ConstraintEdge {
  type: 'pair_required' | 'pair_prohibited' | 'distance';
  students: [string, string];
  weight: number; // 제약조건 중요도 (1-10)
  data: any; // 추가 데이터 (거리값 등)
}

interface PlacementCandidate {
  student: Student;
  position: Position;
  cost: number; // 배치 비용 (낮을수록 좋음)
  futureConstraints: number; // 미래 제약조건에 미치는 영향
}

/**
 * 백트래킹 기반 좌석 배치 엔진
 */
export class BacktrackingPlacementEngine {
  private classroom: ClassroomConfig;
  private constraints: Constraints;
  private availableSeats: Position[];
  private constraintGraph: ConstraintGraph;
  private maxDepth: number;
  private maxAttempts: number;
  private startTime: number = 0;
  private timeLimit: number;
  private fixedPlacements: FixedStudentPlacement[]; // 새로 추가
  private fixedSeating: SeatingArrangement; // 새로 추가

  constructor(
    classroom: ClassroomConfig, 
    constraints: Constraints,
    options: {
      maxDepth?: number;
      maxAttempts?: number;
      timeLimit?: number;
      fixedPlacements?: FixedStudentPlacement[]; // 새로 추가
    } = {}
  ) {
    this.classroom = classroom;
    this.constraints = constraints;
    this.fixedPlacements = options.fixedPlacements || []; // 새로 추가
    this.fixedSeating = createSeatingFromFixed(this.fixedPlacements); // 새로 추가
    this.availableSeats = getAvailableSeatsExcludingFixed(classroom, this.fixedPlacements); // 수정
    this.maxDepth = options.maxDepth || 1000;
    this.maxAttempts = options.maxAttempts || 10000;
    this.timeLimit = options.timeLimit || 30000;
    this.constraintGraph = this.buildConstraintGraph();
  }

  /**
   * 제약조건 그래프 구축
   */
  private buildConstraintGraph(): ConstraintGraph {
    const studentNodes = new Map<string, StudentNode>();
    const constraintEdges: ConstraintEdge[] = [];

    // 학생 노드 초기화
    const allStudentIds = new Set<string>();
    [...this.constraints.pairRequired, ...this.constraints.pairProhibited]
      .forEach(c => c.students.forEach(id => allStudentIds.add(id)));
    this.constraints.distanceRules.forEach(c => c.students.forEach(id => allStudentIds.add(id)));

    allStudentIds.forEach(studentId => {
      studentNodes.set(studentId, {
        studentId,
        student: null as any, // 나중에 설정
        constraints: [],
        priority: 0
      });
    });

    // 제약조건 간선 추가
    this.constraints.pairRequired.forEach(constraint => {
      const edge: ConstraintEdge = {
        type: 'pair_required',
        students: constraint.students,
        weight: 10, // 높은 우선순위
        data: constraint
      };
      constraintEdges.push(edge);
      
      // 양방향 연결
      const node1 = studentNodes.get(constraint.students[0]);
      const node2 = studentNodes.get(constraint.students[1]);
      if (node1) node1.constraints.push(edge);
      if (node2) node2.constraints.push(edge);
    });

    this.constraints.pairProhibited.forEach(constraint => {
      const edge: ConstraintEdge = {
        type: 'pair_prohibited',
        students: constraint.students,
        weight: 7, // 중간 우선순위
        data: constraint
      };
      constraintEdges.push(edge);
      
      const node1 = studentNodes.get(constraint.students[0]);
      const node2 = studentNodes.get(constraint.students[1]);
      if (node1) node1.constraints.push(edge);
      if (node2) node2.constraints.push(edge);
    });

    this.constraints.distanceRules.forEach(constraint => {
      const edge: ConstraintEdge = {
        type: 'distance',
        students: constraint.students,
        weight: 8, // 높은 우선순위
        data: constraint
      };
      constraintEdges.push(edge);
      
      const node1 = studentNodes.get(constraint.students[0]);
      const node2 = studentNodes.get(constraint.students[1]);
      if (node1) node1.constraints.push(edge);
      if (node2) node2.constraints.push(edge);
    });

    // 우선순위 계산
    studentNodes.forEach(node => {
      node.priority = node.constraints.reduce((sum, edge) => sum + edge.weight, 0);
    });

    return { studentNodes, constraintEdges };
  }

  /**
   * 백트래킹 배치 실행
   */
  public async generatePlacement(students: Student[]): Promise<PlacementResult> {
    this.startTime = Date.now();
    
    // 고정된 학생들 제외하고 배치할 학생들만 필터링
    const fixedStudentIds = new Set(this.fixedPlacements.map(fp => fp.studentId));
    const studentsToPlace = students.filter(s => !fixedStudentIds.has(s.id));
    
    // 학생 정보를 그래프에 연결 (배치할 학생들만)
    studentsToPlace.forEach(student => {
      const node = this.constraintGraph.studentNodes.get(student.id);
      if (node) {
        node.student = student;
      }
    });

    // 초기 상태 생성 (고정 배치 포함)
    const initialState: BacktrackingState = {
      seating: { ...this.fixedSeating }, // 고정된 학생들을 초기 배치에 포함
      placedStudents: new Set(fixedStudentIds), // 고정된 학생들을 배치됨으로 설정
      unplacedStudents: [...studentsToPlace], // 배치할 학생들만
      depth: 0,
      violations: []
    };

    console.log('🔄 백트래킹 배치 시작:', {
      students: students.length,
      studentsToPlace: studentsToPlace.length,
      fixedStudents: this.fixedPlacements.length,
      availableSeats: this.availableSeats.length,
      constraints: this.constraintGraph.constraintEdges.length
    });

    // 제약조건이 있는 학생들을 우선순위 순으로 정렬
    const sortedStudents = this.sortStudentsByPriority(studentsToPlace);
    initialState.unplacedStudents = sortedStudents;

    let bestResult = await this.backtrack(initialState);
    
    // 시간이 남으면 여러 번 시도해서 더 나은 결과 찾기
    let attempts = 1;
    while (attempts < this.maxAttempts && 
           Date.now() - this.startTime < this.timeLimit && 
           bestResult.stats.unplacedStudents > 0) {
      
      // 다른 순서로 시도
      const shuffledStudents = this.shuffleArray([...sortedStudents]);
      const newState: BacktrackingState = {
        seating: { ...this.fixedSeating }, // 고정 배치로 다시 시작
        placedStudents: new Set(fixedStudentIds), // 고정된 학생들만
        unplacedStudents: shuffledStudents,
        depth: 0,
        violations: []
      };
      
      const newResult = await this.backtrack(newState);
      
      // 더 나은 결과인지 비교
      if (this.comparePlacementResults(newResult, bestResult) > 0) {
        bestResult = newResult;
        console.log(`🎯 개선된 결과 발견 (시도 ${attempts}):`, {
          placed: bestResult.stats.placedStudents,
          violations: bestResult.stats.constraintViolations
        });
      }
      
      attempts++;
    }

    console.log('✅ 백트래킹 완료:', {
      attempts,
      duration: Date.now() - this.startTime,
      finalResult: {
        placed: bestResult.stats.placedStudents,
        unplaced: bestResult.stats.unplacedStudents,
        violations: bestResult.stats.constraintViolations,
        fixed: this.fixedPlacements.length
      }
    });

    return bestResult;
  }

  /**
   * 재귀적 백트래킹 실행
   */
  private async backtrack(state: BacktrackingState): Promise<PlacementResult> {
    // 시간 제한 체크
    if (Date.now() - this.startTime > this.timeLimit) {
      return this.createResult(state, '시간 제한으로 인한 조기 종료');
    }

    // 깊이 제한 체크
    if (state.depth > this.maxDepth) {
      return this.createResult(state, '최대 깊이 도달');
    }

    // 모든 학생이 배치된 경우
    if (state.unplacedStudents.length === 0) {
      return this.createResult(state, '모든 학생 배치 완료');
    }

    // 더 이상 배치할 좌석이 없는 경우
    const availablePositions = this.getAvailablePositions(state.seating);
    if (availablePositions.length === 0) {
      return this.createResult(state, '사용 가능한 좌석 없음');
    }

    // 다음 배치할 학생 선택 (Most Constraining Variable 휴리스틱)
    const nextStudent = this.selectNextStudent(state);
    if (!nextStudent) {
      return this.createResult(state, '배치할 학생 선택 실패');
    }

    // 가능한 배치 위치 찾기 (Least Constraining Value 휴리스틱)
    const candidates = this.generatePlacementCandidates(nextStudent, state);
    
    if (candidates.length === 0) {
      // 현재 학생을 배치할 수 없음 - 백트래킹
      return this.createResult(state, `${nextStudent.name} 배치 불가`);
    }

    // 각 후보 위치를 시도
    let bestResult: PlacementResult | null = null;

    for (const candidate of candidates) {
      // Forward Checking: 이 배치가 미래에 문제를 일으킬지 확인
      if (!this.forwardCheck(candidate, state)) {
        continue;
      }

      // 새로운 상태 생성
      const newState = this.createNewState(state, candidate);
      
      // 재귀 호출
      const result = await this.backtrack(newState);
      
      // 더 나은 결과인지 비교
      if (!bestResult || this.comparePlacementResults(result, bestResult) > 0) {
        bestResult = result;
        
        // 완벽한 해를 찾은 경우 즉시 반환
        if (result.stats.unplacedStudents === 0 && result.stats.constraintViolations === 0) {
          break;
        }
      }
    }

    return bestResult || this.createResult(state, '모든 후보 위치 실패');
  }

  /**
   * 학생을 제약조건 우선순위로 정렬
   */
  private sortStudentsByPriority(students: Student[]): Student[] {
    return students.sort((a, b) => {
      const priorityA = this.constraintGraph.studentNodes.get(a.id)?.priority || 0;
      const priorityB = this.constraintGraph.studentNodes.get(b.id)?.priority || 0;
      
      // 우선순위가 높은 순 (제약조건이 많은 순)
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      
      // 같은 우선순위면 성별로 구분 (성별 제약이 있을 수 있으므로)
      if (a.gender !== b.gender) {
        return a.gender === 'male' ? -1 : 1;
      }
      
      // 그 외에는 이름순
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * 다음 배치할 학생 선택 (Most Constraining Variable)
   */
  private selectNextStudent(state: BacktrackingState): Student | null {
    if (state.unplacedStudents.length === 0) return null;

    // 제약조건이 많은 학생부터 선택
    return state.unplacedStudents.reduce((selected, current) => {
      const selectedNode = this.constraintGraph.studentNodes.get(selected.id);
      const currentNode = this.constraintGraph.studentNodes.get(current.id);
      
      const selectedPriority = selectedNode?.priority || 0;
      const currentPriority = currentNode?.priority || 0;
      
      return currentPriority > selectedPriority ? current : selected;
    });
  }

  /**
   * 배치 후보 위치 생성 (Least Constraining Value)
   */
  private generatePlacementCandidates(student: Student, state: BacktrackingState): PlacementCandidate[] {
    const availablePositions = this.getAvailablePositions(state.seating);
    const candidates: PlacementCandidate[] = [];

    for (const position of availablePositions) {
      // 기본 제약조건 체크 (성별, 사용불가 좌석 등)
      if (!this.canPlaceStudentAt(student, position, state.seating)) {
        continue;
      }

      // 배치 비용 계산
      const cost = this.calculatePlacementCost(student, position, state);
      const futureConstraints = this.calculateFutureConstraints(student, position, state);

      candidates.push({
        student,
        position,
        cost,
        futureConstraints
      });
    }

    // 비용이 낮고 미래 제약이 적은 순으로 정렬
    return candidates.sort((a, b) => {
      if (a.cost !== b.cost) {
        return a.cost - b.cost;
      }
      return a.futureConstraints - b.futureConstraints;
    });
  }

  /**
   * Forward Checking: 미래 배치 가능성 확인
   */
  private forwardCheck(candidate: PlacementCandidate, state: BacktrackingState): boolean {
    // 임시로 배치해보고 남은 학생들이 배치 가능한지 확인
    const tempSeating = { ...state.seating };
    const posKey = `${candidate.position.row}-${candidate.position.col}`;
    tempSeating[posKey] = candidate.student.id;

    const remainingStudents = state.unplacedStudents.filter(s => s.id !== candidate.student.id);
    const remainingPositions = this.getAvailablePositions(tempSeating);

    // 남은 학생 수가 남은 좌석 수보다 많으면 불가능
    if (remainingStudents.length > remainingPositions.length) {
      return false;
    }

    // 제약조건이 있는 학생들이 배치 가능한지 확인
    for (const student of remainingStudents) {
      const node = this.constraintGraph.studentNodes.get(student.id);
      if (node && node.constraints.length > 0) {
        const hasViablePosition = remainingPositions.some(pos => 
          this.canPlaceStudentAt(student, pos, tempSeating)
        );
        if (!hasViablePosition) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 배치 비용 계산
   */
  private calculatePlacementCost(student: Student, position: Position, state: BacktrackingState): number {
    let cost = 0;
    // const posKey = `${position.row}-${position.col}`;
    // const tempSeating = { ...state.seating, [posKey]: student.id };

    // 제약조건 위반 비용
    const node = this.constraintGraph.studentNodes.get(student.id);
    if (node) {
      for (const edge of node.constraints) {
        const otherStudentId = edge.students.find(id => id !== student.id);
        if (!otherStudentId) continue;

        const otherPosition = findStudentPosition(otherStudentId, state.seating);
        if (!otherPosition) continue; // 아직 배치되지 않음

        switch (edge.type) {
          case 'pair_required':
            if (!isPairPosition(position, otherPosition)) {
              cost += edge.weight * 10; // 높은 비용
            }
            break;
          case 'pair_prohibited':
            if (isPairPosition(position, otherPosition)) {
              cost += edge.weight * 10; // 높은 비용
            }
            break;
          case 'distance':
            const distance = calculateDistance(position, otherPosition);
            const requiredDistance = edge.data.minDistance;
            if (distance < requiredDistance) {
              cost += edge.weight * (requiredDistance - distance);
            }
            break;
        }
      }
    }

    return cost;
  }

  /**
   * 미래 제약조건 영향 계산
   */
  private calculateFutureConstraints(student: Student, _position: Position, state: BacktrackingState): number {
    let futureConstraints = 0;
    
    // 이 위치가 다른 학생들의 배치에 미치는 영향 계산
    for (const unplacedStudent of state.unplacedStudents) {
      if (unplacedStudent.id === student.id) continue;

      const node = this.constraintGraph.studentNodes.get(unplacedStudent.id);
      if (node) {
        for (const edge of node.constraints) {
          if (edge.students.includes(student.id)) {
            futureConstraints += edge.weight;
          }
        }
      }
    }

    return futureConstraints;
  }

  /**
   * 새로운 상태 생성
   */
  private createNewState(oldState: BacktrackingState, candidate: PlacementCandidate): BacktrackingState {
    const posKey = `${candidate.position.row}-${candidate.position.col}`;
    
    return {
      seating: { ...oldState.seating, [posKey]: candidate.student.id },
      placedStudents: new Set([...oldState.placedStudents, candidate.student.id]),
      unplacedStudents: oldState.unplacedStudents.filter(s => s.id !== candidate.student.id),
      depth: oldState.depth + 1,
      violations: [] // 나중에 계산
    };
  }

  /**
   * 사용 가능한 위치 목록 반환
   */
  private getAvailablePositions(seating: SeatingArrangement): Position[] {
    const usedPositions = new Set(Object.keys(seating));
    return this.availableSeats.filter(pos => {
      const posKey = `${pos.row}-${pos.col}`;
      return !usedPositions.has(posKey);
    });
  }

  /**
   * 학생이 특정 위치에 배치 가능한지 확인
   */
  private canPlaceStudentAt(student: Student, position: Position, seating: SeatingArrangement): boolean {
    return isValidStudentPlacement(student, position, this.classroom, this.constraints, seating);
  }

  /**
   * 배치 결과 비교 (양수면 첫 번째가 더 좋음)
   */
  private comparePlacementResults(result1: PlacementResult, result2: PlacementResult): number {
    // 1. 배치된 학생 수가 더 많은 것이 좋음
    const placedDiff = result1.stats.placedStudents - result2.stats.placedStudents;
    if (placedDiff !== 0) return placedDiff;

    // 2. 제약조건 위반이 적은 것이 좋음
    const violationDiff = result2.stats.constraintViolations - result1.stats.constraintViolations;
    if (violationDiff !== 0) return violationDiff;

    // 3. 같으면 첫 번째 유지
    return 0;
  }

  /**
   * 결과 생성
   */
  private createResult(state: BacktrackingState, message: string): PlacementResult {
    // 전체 학생 목록 재구성
    const allStudents = [...Array.from(state.placedStudents), ...state.unplacedStudents.map(s => s.id)];
    const studentsArray = allStudents.map(id => 
      state.unplacedStudents.find(s => s.id === id) || 
      { id, name: 'Unknown', gender: 'male' as const, createdAt: new Date() }
    );

    const validation = validateAllConstraints(
      state.seating, 
      studentsArray, 
      this.classroom, 
      this.constraints
    );

    const totalSeats = this.classroom.rows * this.classroom.cols;
    const placedCount = Object.keys(state.seating).length;
    const unplacedCount = state.unplacedStudents.length;
    const totalStudents = placedCount + unplacedCount;

    const fixedText = this.fixedPlacements.length > 0 ? ` (고정 ${this.fixedPlacements.length}명 포함)` : '';

    return {
      success: unplacedCount === 0,
      seating: state.seating,
      message: `백트래킹 배치: ${message} (${placedCount}/${totalStudents}명 배치)${fixedText}`,
      violations: validation.violations,
      stats: {
        totalSeats,
        availableSeats: this.availableSeats.length + this.fixedPlacements.length, // 전체 사용 가능 좌석
        disabledSeats: totalSeats - (this.availableSeats.length + this.fixedPlacements.length),
        placedStudents: placedCount,
        unplacedStudents: unplacedCount,
        constraintViolations: validation.violations.length
      }
    };
  }

  /**
   * 배열 섞기
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

/**
 * 백트래킹 기반 배치 함수 (기존 함수와 호환)
 */
export const generateBacktrackingPlacement = async (
  students: Student[], 
  classroom: ClassroomConfig,
  constraints: Constraints = { pairRequired: [], pairProhibited: [], distanceRules: [], rowExclusions: [] },
  fixedPlacements: FixedStudentPlacement[] = [] // 새로 추가
): Promise<PlacementResult> => {
  
  if (students.length === 0) {
    return {
      success: false,
      seating: createSeatingFromFixed(fixedPlacements), // 고정 배치만 반환
      message: '배치할 학생이 없습니다.',
      stats: {
        totalSeats: classroom.rows * classroom.cols,
        availableSeats: getAvailableSeats(classroom).length,
        disabledSeats: 0,
        placedStudents: fixedPlacements.length,
        unplacedStudents: 0,
        constraintViolations: 0
      }
    };
  }

  // 배치할 학생 수에 따른 파라미터 조정
  const studentsToPlace = students.filter(s => 
    !fixedPlacements.some(fp => fp.studentId === s.id)
  );

  const engine = new BacktrackingPlacementEngine(classroom, constraints, {
    maxDepth: Math.min(1000, studentsToPlace.length * 10),
    maxAttempts: Math.min(50, studentsToPlace.length),
    timeLimit: studentsToPlace.length > 30 ? 45000 : 30000,
    fixedPlacements // 고정 배치 전달
  });

  return await engine.generatePlacement(students);
};