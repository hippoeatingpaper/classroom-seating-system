//src/utils/advancedBacktrackingAlgorithm.ts
import { 
  Student, 
  ClassroomConfig, 
  Constraints, 
  SeatingArrangement, 
  Position, 
  PlacementResult, 
  ConstraintViolation,
  FixedStudentPlacement 
} from '@/types';
import { 
  isPairPosition, 
  calculateDistance, 
  validateAllConstraints,
  findStudentPosition,
} from './constraintValidator';
import { 
  getAvailableSeats, 
  isValidStudentPlacement, 
  createSeatingFromFixed, 
  getAvailableSeatsExcludingFixed 
} from './seatingAlgorithm';

interface HeuristicWeights {
  mrv: number;
  degree: number; 
  criticality: number;
  flexibility: number;
}

interface StudentPriority {
  student: Student;
  remainingOptions: number;    // MRV: 배치 가능한 좌석 수
  constraintDegree: number;    // Degree: 연결된 제약조건 수
  criticalityScore: number;    // 임계성 점수
  flexibilityScore: number;    // 유연성 점수
  priorityScore: number;       // 종합 우선순위 점수
}

interface SeatScore {
  position: Position;
  constraintSatisfaction: number;  // 제약조건 만족도 (0-100)
  futureFlexibility: number;       // 미래 배치 유연성 (0-100)
  proximityBonus: number;          // 관련 학생과의 근접성 (0-100)
  conflictPenalty: number;         // 충돌 위험도 (0-100, 낮을수록 좋음)
  totalScore: number;              // 종합 점수
}

interface ConstraintPropagationResult {
  isValid: boolean;
  reducedDomains: Map<string, Position[]>;  // 학생별 가능한 좌석 목록
  conflicts: string[];
  propagatedConstraints: number;
}

interface PlacementState {
  seating: SeatingArrangement;
  placedStudents: Set<string>;
  unplacedStudents: Student[];
  studentDomains: Map<string, Position[]>;  // 각 학생의 가능한 좌석들
  depth: number;
  violations: ConstraintViolation[];
  constraintsSatisfied: number;
  timeSpent: number;
}

/**
 * 고급 휴리스틱 기반 백트래킹 배치 엔진
 */
export class AdvancedHeuristicEngine {
  private classroom: ClassroomConfig;
  private constraints: Constraints;
  private availableSeats: Position[];
  private constraintGraph: Map<string, string[]>;
  private maxDepth: number;
  private timeLimit: number;
  private startTime: number = 0;
  private fixedPlacements: FixedStudentPlacement[]; // 새로 추가
  private fixedSeating: SeatingArrangement; // 새로 추가
  
  // 휴리스틱 가중치
  private weights: HeuristicWeights = {
    mrv: 0.4,
    degree: 0.3,
    criticality: 0.2,
    flexibility: 0.1
  };

  constructor(
    classroom: ClassroomConfig, 
    constraints: Constraints,
    options: {
      maxDepth?: number;
      timeLimit?: number;
      weights?: Partial<HeuristicWeights>;
      fixedPlacements?: FixedStudentPlacement[]; // 새로 추가
    } = {}
  ) {
    this.classroom = classroom;
    this.constraints = constraints;
    this.fixedPlacements = options.fixedPlacements || []; // 새로 추가
    this.fixedSeating = createSeatingFromFixed(this.fixedPlacements); // 새로 추가
    this.availableSeats = getAvailableSeatsExcludingFixed(classroom, this.fixedPlacements); // 수정
    this.maxDepth = options.maxDepth || 1000;
    this.timeLimit = options.timeLimit || 30000;
    this.constraintGraph = this.buildConstraintGraph();
    
    if (options.weights) {
      this.weights = { ...this.weights, ...options.weights };
    }
  }

  /**
   * 제약조건 그래프 구축 (학생 간 연결 관계)
   */
  private buildConstraintGraph(): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    // 모든 제약조건에서 학생 쌍들을 추출하여 그래프 구성
    const allConstraints = [
      ...this.constraints.pairRequired,
      ...this.constraints.pairProhibited,
      ...this.constraints.distanceRules
    ];

    allConstraints.forEach(constraint => {
      const [student1, student2] = constraint.students;
      
      if (!graph.has(student1)) graph.set(student1, []);
      if (!graph.has(student2)) graph.set(student2, []);
      
      graph.get(student1)!.push(student2);
      graph.get(student2)!.push(student1);
    });

    return graph;
  }

  /**
   * 메인 배치 실행 함수
   */
  public async generatePlacement(students: Student[]): Promise<PlacementResult> {
    this.startTime = Date.now();
    
    console.log('🚀 고급 휴리스틱 백트래킹 시작:', {
      students: students.length,
      constraints: this.constraints.pairRequired.length + this.constraints.pairProhibited.length + this.constraints.distanceRules.length,
      availableSeats: this.availableSeats.length,
      fixedStudents: this.fixedPlacements.length // 새로 추가
    });

    // 고정된 학생들 제외하고 배치할 학생들만 필터링
    const fixedStudentIds = new Set(this.fixedPlacements.map(fp => fp.studentId));
    const studentsToPlace = students.filter(s => !fixedStudentIds.has(s.id));

    // 1단계: 초기 도메인 계산 (배치할 학생들만 대상)
    const initialDomains = this.calculateInitialDomains(studentsToPlace);
    
    // 2단계: 제약조건 전파로 도메인 축소
    const propagationResult = this.propagateConstraints(studentsToPlace, initialDomains);
    
    if (!propagationResult.isValid) {
      return {
        success: false,
        seating: { ...this.fixedSeating }, // 고정 배치 포함
        message: `제약조건 전파 실패: ${propagationResult.conflicts.join(', ')}`,
        stats: this.createStats({ ...this.fixedSeating }, students)
      };
    }

    // 3단계: 초기 상태 생성 (고정 배치 포함)
    const initialState: PlacementState = {
      seating: { ...this.fixedSeating }, // 고정된 학생들을 초기 배치에 포함
      placedStudents: new Set(fixedStudentIds), // 고정된 학생들을 배치됨으로 설정
      unplacedStudents: [...studentsToPlace], // 배치할 학생들만
      studentDomains: propagationResult.reducedDomains,
      depth: 0,
      violations: [],
      constraintsSatisfied: 0,
      timeSpent: 0
    };

    // 4단계: 고급 휴리스틱 백트래킹 실행
    const result = await this.advancedBacktrack(initialState);
    
    const duration = Date.now() - this.startTime;
    console.log('✅ 고급 휴리스틱 백트래킹 완료:', {
      duration: `${duration}ms`,
      placed: result.stats.placedStudents,
      unplaced: result.stats.unplacedStudents,
      violations: result.stats.constraintViolations,
      fixed: this.fixedPlacements.length
    });

    return result;
  }

  /**
   * 각 학생의 초기 도메인 계산 (기본 제약조건만 고려)
   */
  private calculateInitialDomains(students: Student[]): Map<string, Position[]> {
    const domains = new Map<string, Position[]>();
    
    students.forEach(student => {
      const validSeats = this.availableSeats.filter(seat => 
        this.isBasicallyValidSeat(student, seat)
      );
      domains.set(student.id, validSeats);
    });

    return domains;
  }

  /**
   * 기본 유효성 검사 (성별 제약, 사용불가 좌석)
   */
  private isBasicallyValidSeat(student: Student, seat: Position): boolean {
    return isValidStudentPlacement(student, seat, this.classroom, this.constraints);
  }

  /**
   * 제약조건 전파 (Arc Consistency + Forward Checking)
   */
  private propagateConstraints(
    students: Student[], 
    initialDomains: Map<string, Position[]>
  ): ConstraintPropagationResult {
    const domains = new Map(initialDomains);
    const conflicts: string[] = [];
    let propagatedConstraints = 0;

    // 짝 강제 제약조건 전파
    for (const constraint of this.constraints.pairRequired) {
      const [student1Id, student2Id] = constraint.students;
      const student1 = students.find(s => s.id === student1Id);
      const student2 = students.find(s => s.id === student2Id);
      
      if (!student1 || !student2) {
        conflicts.push(`짝 강제 제약조건에 존재하지 않는 학생: ${student1Id}, ${student2Id}`);
        continue;
      }

      // 두 학생 모두 짝 좌석에만 앉을 수 있도록 도메인 축소
      const pairSeats = this.findPairSeats();
      const validPairs = this.filterValidPairSeats(pairSeats, student1, student2);
      
      if (validPairs.length === 0) {
        conflicts.push(`${student1.name}과 ${student2.name}이 앉을 수 있는 짝 좌석이 없음`);
        continue;
      }

      // 도메인 업데이트
      const student1ValidSeats = validPairs.flatMap(pair => [pair[0], pair[1]])
        .filter(seat => this.isBasicallyValidSeat(student1, seat));
      const student2ValidSeats = validPairs.flatMap(pair => [pair[0], pair[1]])
        .filter(seat => this.isBasicallyValidSeat(student2, seat));

      domains.set(student1Id, student1ValidSeats);
      domains.set(student2Id, student2ValidSeats);
      propagatedConstraints++;
    }

    // 거리 제약조건 전파
    for (const constraint of this.constraints.distanceRules) {
      const [student1Id, student2Id] = constraint.students;
      const domain1 = domains.get(student1Id) || [];
      const domain2 = domains.get(student2Id) || [];

      // 각 학생의 도메인에서 거리 제약을 위반하는 좌석들 제거
      const filteredDomain1 = domain1.filter(seat1 => 
        domain2.some(seat2 => calculateDistance(seat1, seat2) >= constraint.minDistance)
      );
      
      const filteredDomain2 = domain2.filter(seat2 => 
        domain1.some(seat1 => calculateDistance(seat1, seat2) >= constraint.minDistance)
      );

      if (filteredDomain1.length === 0 || filteredDomain2.length === 0) {
        const student1 = students.find(s => s.id === student1Id);
        const student2 = students.find(s => s.id === student2Id);
        conflicts.push(`${student1?.name}과 ${student2?.name}의 거리 제약(${constraint.minDistance}칸)을 만족할 수 없음`);
        continue;
      }

      domains.set(student1Id, filteredDomain1);
      domains.set(student2Id, filteredDomain2);
      propagatedConstraints++;
    }

    // 도메인이 비어있는 학생 체크
    for (const student of students) {
      const domain = domains.get(student.id) || [];
      if (domain.length === 0) {
        conflicts.push(`${student.name}이 앉을 수 있는 좌석이 없음`);
      }
    }

    return {
      isValid: conflicts.length === 0,
      reducedDomains: domains,
      conflicts,
      propagatedConstraints
    };
  }

  /**
   * 짝 좌석 찾기
   */
  private findPairSeats(): Position[][] {
    const pairs: Position[][] = [];
    
    this.classroom.pairColumns?.forEach(pairCols => {
      for (let row = 0; row < this.classroom.rows; row++) {
        const leftSeat = { row, col: pairCols[0] };
        const rightSeat = { row, col: pairCols[1] };
        
        // 둘 다 사용 가능한지 확인
        const leftAvailable = this.availableSeats.some(s => s.row === leftSeat.row && s.col === leftSeat.col);
        const rightAvailable = this.availableSeats.some(s => s.row === rightSeat.row && s.col === rightSeat.col);
        
        if (leftAvailable && rightAvailable) {
          pairs.push([leftSeat, rightSeat]);
        }
      }
    });
    
    return pairs;
  }

  /**
   * 특정 학생 쌍에게 유효한 짝 좌석 필터링
   */
  private filterValidPairSeats(
    pairSeats: Position[][], 
    student1: Student, 
    student2: Student
  ): Position[][] {
    return pairSeats.filter(pair => {
      const [leftSeat, rightSeat] = pair;
      
      // 두 가지 배치 방법 모두 확인
      const option1 = this.isBasicallyValidSeat(student1, leftSeat) && 
                     this.isBasicallyValidSeat(student2, rightSeat);
      const option2 = this.isBasicallyValidSeat(student1, rightSeat) && 
                     this.isBasicallyValidSeat(student2, leftSeat);
      
      return option1 || option2;
    });
  }

  /**
   * 고급 휴리스틱 백트래킹 메인 함수
   */
  private async advancedBacktrack(state: PlacementState): Promise<PlacementResult> {
    // 시간 제한 체크
    if (Date.now() - this.startTime > this.timeLimit) {
      return this.createResult(state, '시간 제한 도달');
    }

    // 깊이 제한 체크
    if (state.depth > this.maxDepth) {
      return this.createResult(state, '최대 깊이 도달');
    }

    // 모든 학생 배치 완료
    if (state.unplacedStudents.length === 0) {
      return this.createResult(state, '모든 학생 배치 완료');
    }

    // 1단계: 가장 제약이 많은 학생 선택 (고급 휴리스틱)
    const nextStudent = this.selectBestStudent(state);
    if (!nextStudent) {
      return this.createResult(state, '배치할 학생 선택 실패');
    }

    // 2단계: 해당 학생의 최적 좌석들 계산
    const seatCandidates = this.calculateOptimalSeats(nextStudent, state);
    if (seatCandidates.length === 0) {
      return this.createResult(state, `${nextStudent.student.name} 배치 불가`);
    }

    // 3단계: 각 좌석 후보에 대해 시도
    let bestResult: PlacementResult | null = null;

    for (const candidate of seatCandidates) {
      // Forward Checking: 이 배치가 다른 학생들에게 미치는 영향 확인
      const forwardCheckResult = this.forwardCheck(nextStudent.student, candidate.position, state);
      if (!forwardCheckResult.isValid) {
        continue; // 이 배치는 미래에 해가 없음
      }

      // 새로운 상태 생성
      const newState = this.createNewState(state, nextStudent.student, candidate.position, forwardCheckResult.updatedDomains);
      
      // 재귀 호출
      const result = await this.advancedBacktrack(newState);
      
      // 더 나은 결과인지 비교
      if (!bestResult || this.isResultBetter(result, bestResult)) {
        bestResult = result;
        
        // 완벽한 해를 찾으면 즉시 반환
        if (result.stats.unplacedStudents === 0 && result.stats.constraintViolations === 0) {
          break;
        }
      }
    }

    return bestResult || this.createResult(state, '모든 후보 실패');
  }

  /**
   * MRV + Degree + 고급 휴리스틱으로 최적 학생 선택
   */
  private selectBestStudent(state: PlacementState): StudentPriority | null {
    if (state.unplacedStudents.length === 0) return null;

    const priorities: StudentPriority[] = state.unplacedStudents.map(student => {
      const domain = state.studentDomains.get(student.id) || [];
      const constraintConnections = this.constraintGraph.get(student.id) || [];
      
      return {
        student,
        remainingOptions: domain.length, // MRV
        constraintDegree: constraintConnections.length, // Degree
        criticalityScore: this.calculateCriticality(student, state),
        flexibilityScore: this.calculateFlexibility(student, state),
        priorityScore: 0 // 나중에 계산
      };
    });

    // 종합 우선순위 점수 계산
    priorities.forEach(p => {
      // MRV: 선택지가 적을수록 높은 점수 (정규화)
      const mrvScore = p.remainingOptions === 0 ? 100 : (1 / p.remainingOptions) * 100;
      
      // Degree: 제약조건이 많을수록 높은 점수
      const degreeScore = p.constraintDegree * 10;
      
      p.priorityScore = (
        mrvScore * this.weights.mrv +
        degreeScore * this.weights.degree +
        p.criticalityScore * this.weights.criticality +
        p.flexibilityScore * this.weights.flexibility
      );
    });

    // 우선순위 점수가 가장 높은 학생 선택
    return priorities.reduce((best, current) => 
      current.priorityScore > best.priorityScore ? current : best
    );
  }

  /**
   * 학생의 임계성 계산 (배치가 시급한 정도)
   */
  private calculateCriticality(student: Student, state: PlacementState): number {
    let criticalityScore = 0;
    const domain = state.studentDomains.get(student.id) || [];
    
    // 1. 도메인 크기 기반 임계성 (작을수록 임계)
    if (domain.length <= 1) criticalityScore += 50;
    else if (domain.length <= 3) criticalityScore += 30;
    else if (domain.length <= 5) criticalityScore += 10;
    
    // 2. 제약조건 상대방의 상태 기반 임계성
    const connections = this.constraintGraph.get(student.id) || [];
    for (const otherId of connections) {
      const otherDomain = state.studentDomains.get(otherId) || [];
      if (otherDomain.length <= 2) {
        criticalityScore += 20; // 상대방도 선택지가 적으면 더 임계
      }
    }
    
    // 3. 짝 강제 제약조건의 경우 더 높은 임계성
    const hasRequiredPair = this.constraints.pairRequired.some(
      c => c.students.includes(student.id)
    );
    if (hasRequiredPair) criticalityScore += 25;
    
    return Math.min(criticalityScore, 100);
  }

  /**
   * 학생의 유연성 계산 (나중에 배치해도 되는 정도)
   */
  private calculateFlexibility(student: Student, state: PlacementState): number {
    let flexibilityScore = 0;
    const domain = state.studentDomains.get(student.id) || [];
    
    // 1. 큰 도메인은 유연성 증가
    if (domain.length > 10) flexibilityScore += 30;
    else if (domain.length > 5) flexibilityScore += 20;
    else if (domain.length > 3) flexibilityScore += 10;
    
    // 2. 제약조건이 적으면 유연성 증가
    const connections = this.constraintGraph.get(student.id) || [];
    if (connections.length === 0) flexibilityScore += 40;
    else if (connections.length <= 2) flexibilityScore += 20;
    
    // 3. 성별 제약이 없는 좌석들이 많으면 유연성 증가
    const flexibleSeats = domain.filter(seat => {
      const genderConstraint = this.classroom.seatGenderConstraints?.find(
        c => c.position.row === seat.row && c.position.col === seat.col
      );
      return !genderConstraint?.requiredGender;
    });
    
    if (flexibleSeats.length > domain.length * 0.7) flexibilityScore += 20;
    
    return Math.min(flexibilityScore, 100);
  }

  /**
   * 학생에 대한 최적 좌석들 계산 및 정렬
   */
  private calculateOptimalSeats(studentPriority: StudentPriority, state: PlacementState): SeatScore[] {
    const student = studentPriority.student;
    const domain = state.studentDomains.get(student.id) || [];
    
    const seatScores: SeatScore[] = domain.map(seat => {
      const constraintSatisfaction = this.evaluateConstraintSatisfaction(student, seat, state);
      const futureFlexibility = this.evaluateFutureFlexibility(student, seat, state);
      const proximityBonus = this.evaluateProximityBonus(student, seat, state);
      const conflictPenalty = this.evaluateConflictPenalty(student, seat, state);
      
      return {
        position: seat,
        constraintSatisfaction,
        futureFlexibility,
        proximityBonus,
        conflictPenalty,
        totalScore: constraintSatisfaction + futureFlexibility + proximityBonus - conflictPenalty
      };
    });

    // 총점이 높은 순으로 정렬
    return seatScores.sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * 제약조건 만족도 평가
   */
  private evaluateConstraintSatisfaction(student: Student, seat: Position, state: PlacementState): number {
    let score = 0;
    const connections = this.constraintGraph.get(student.id) || [];
    
    for (const otherId of connections) {
      const otherPosition = findStudentPosition(otherId, state.seating);
      if (!otherPosition) continue; // 아직 배치되지 않은 학생
      
      // 짝 강제 제약조건 확인
      const pairRequired = this.constraints.pairRequired.find(
        c => c.students.includes(student.id) && c.students.includes(otherId)
      );
      if (pairRequired && isPairPosition(seat, otherPosition)) {
        score += 40; // 짝 강제 만족 시 높은 점수
      }
      
      // 짝 방지 제약조건 확인
      const pairProhibited = this.constraints.pairProhibited.find(
        c => c.students.includes(student.id) && c.students.includes(otherId)
      );
      if (pairProhibited && !isPairPosition(seat, otherPosition)) {
        score += 30; // 짝 방지 만족 시 점수
      }
      
      // 거리 제약조건 확인
      const distanceRule = this.constraints.distanceRules.find(
        c => c.students.includes(student.id) && c.students.includes(otherId)
      );
      if (distanceRule) {
        const distance = calculateDistance(seat, otherPosition);
        if (distance >= distanceRule.minDistance) {
          score += 35; // 거리 제약 만족 시 점수
        } else {
          score -= (distanceRule.minDistance - distance) * 10; // 위반 시 페널티
        }
      }
    }
    
    return Math.max(0, Math.min(score, 100));
  }

  /**
   * 미래 유연성 평가 (이 좌석에 앉았을 때 다른 학생들의 선택지에 미치는 영향)
   */
  private evaluateFutureFlexibility(student: Student, seat: Position, state: PlacementState): number {
    let flexibilityScore = 50; // 기본 점수
    
    // 이 좌석이 다른 학생들의 도메인에 미치는 영향 계산
    for (const otherStudent of state.unplacedStudents) {
      if (otherStudent.id === student.id) continue;
      
      const otherDomain = state.studentDomains.get(otherStudent.id) || [];
      
      // 이 좌석을 제거했을 때 다른 학생의 선택지가 얼마나 줄어드는지
      const reducedDomain = otherDomain.filter(otherSeat => 
        !(otherSeat.row === seat.row && otherSeat.col === seat.col)
      );
      
      const reductionRatio = 1 - (reducedDomain.length / Math.max(otherDomain.length, 1));
      
      // 다른 학생의 선택지를 많이 줄이는 좌석은 점수 감소
      if (reductionRatio > 0.5) flexibilityScore -= 20;
      else if (reductionRatio > 0.3) flexibilityScore -= 10;
      
      // 제약조건이 있는 학생의 선택지를 줄이는 경우 더 큰 페널티
      const hasConstraints = this.constraintGraph.has(otherStudent.id);
      if (hasConstraints && reductionRatio > 0.3) flexibilityScore -= 15;
    }
    
    return Math.max(0, Math.min(flexibilityScore, 100));
  }

  /**
   * 근접성 보너스 평가 (관련 학생들과의 전략적 위치)
   */
  private evaluateProximityBonus(student: Student, seat: Position, state: PlacementState): number {
    let proximityScore = 0;
    const connections = this.constraintGraph.get(student.id) || [];
    
    for (const otherId of connections) {
      const otherPosition = findStudentPosition(otherId, state.seating);
      if (!otherPosition) continue;
      
      const distance = calculateDistance(seat, otherPosition);
      
      // 짝 강제인 경우 가까울수록 좋음
      const pairRequired = this.constraints.pairRequired.find(
        c => c.students.includes(student.id) && c.students.includes(otherId)
      );
      if (pairRequired) {
        if (distance === 1) proximityScore += 30; // 바로 옆
        else if (distance <= 2) proximityScore += 15; // 가까움
      }
      
      // 거리 제약의 경우 최소 거리보다 약간 더 떨어져 있으면 좋음
      const distanceRule = this.constraints.distanceRules.find(
        c => c.students.includes(student.id) && c.students.includes(otherId)
      );
      if (distanceRule) {
        if (distance === distanceRule.minDistance) proximityScore += 20; // 딱 맞음
        else if (distance === distanceRule.minDistance + 1) proximityScore += 15; // 약간 여유
      }
    }
    
    return Math.min(proximityScore, 100);
  }

  /**
   * 충돌 위험도 평가
   */
  private evaluateConflictPenalty(student: Student, seat: Position, state: PlacementState): number {
    let penalty = 0;
    
    // 짝 좌석의 반대편이 이미 차있고 제약조건 위반인 경우
    const pairSeat = this.findPairSeat(seat);
    if (pairSeat) {
      const posKey = `${pairSeat.row}-${pairSeat.col}`;
      const occupantId = state.seating[posKey];
      
      if (occupantId) {
        // 짝 방지 제약조건 위반
        const prohibited = this.constraints.pairProhibited.find(
          c => c.students.includes(student.id) && c.students.includes(occupantId)
        );
        if (prohibited) penalty += 50;
        
        // 성별이 다른 경우 (남녀 구분 배치 선호)
        //const occupant = state.unplacedStudents.find(s => s.id === occupantId) || 
        //                [...state.placedStudents].map(id => ({ id })).find(s => s.id === occupantId);
        // 실제로는 전체 학생 목록에서 찾아야 하지만 간단히 처리
      }
    }
    
    // 거리 제약조건 위반 위험
    const connections = this.constraintGraph.get(student.id) || [];
    for (const otherId of connections) {
      const otherPosition = findStudentPosition(otherId, state.seating);
      if (!otherPosition) continue;
      
      const distanceRule = this.constraints.distanceRules.find(
        c => c.students.includes(student.id) && c.students.includes(otherId)
      );
      
      if (distanceRule) {
        const distance = calculateDistance(seat, otherPosition);
        if (distance < distanceRule.minDistance) {
          penalty += (distanceRule.minDistance - distance) * 20;
        }
      }
    }
    
    return Math.min(penalty, 100);
  }

  /**
   * 짝 좌석 찾기 (주어진 좌석의 짝)
   */
  private findPairSeat(seat: Position): Position | null {
    for (const pairCols of this.classroom.pairColumns || []) {
      if (seat.col === pairCols[0]) {
        return { row: seat.row, col: pairCols[1] };
      } else if (seat.col === pairCols[1]) {
        return { row: seat.row, col: pairCols[0] };
      }
    }
    return null;
  }

  /**
   * Forward Checking: 특정 배치가 다른 학생들에게 미치는 영향 확인
   */
  private forwardCheck(
    student: Student, 
    position: Position, 
    state: PlacementState
  ): { isValid: boolean; updatedDomains: Map<string, Position[]> } {
    const updatedDomains = new Map(state.studentDomains);
    //const posKey = `${position.row}-${position.col}`;
    
    // 1. 배치된 좌석을 모든 학생의 도메인에서 제거
    for (const [studentId, domain] of updatedDomains) {
      if (studentId === student.id) continue;
      
      const filteredDomain = domain.filter(seat => 
        !(seat.row === position.row && seat.col === position.col)
      );
      updatedDomains.set(studentId, filteredDomain);
    }

    // 2. 제약조건 기반 도메인 축소
    const connections = this.constraintGraph.get(student.id) || [];
    
    for (const otherId of connections) {
      const otherDomain = updatedDomains.get(otherId) || [];
      
      // 짝 강제 제약조건
      const pairRequired = this.constraints.pairRequired.find(
        c => c.students.includes(student.id) && c.students.includes(otherId)
      );
      
      if (pairRequired) {
        const pairSeat = this.findPairSeat(position);
        if (pairSeat) {
          // 상대방은 오직 짝 좌석에만 앉을 수 있음
          const pairOnlyDomain = otherDomain.filter(seat => 
            seat.row === pairSeat.row && seat.col === pairSeat.col
          );
          updatedDomains.set(otherId, pairOnlyDomain);
        } else {
          // 짝 좌석이 아닌 곳에 앉으면 짝 강제 제약조건 위반
          updatedDomains.set(otherId, []);
        }
      }
      
      // 짝 방지 제약조건
      const pairProhibited = this.constraints.pairProhibited.find(
        c => c.students.includes(student.id) && c.students.includes(otherId)
      );
      
      if (pairProhibited) {
        const pairSeat = this.findPairSeat(position);
        if (pairSeat) {
          // 상대방은 짝 좌석에 앉을 수 없음
          const nonPairDomain = otherDomain.filter(seat => 
            !(seat.row === pairSeat.row && seat.col === pairSeat.col)
          );
          updatedDomains.set(otherId, nonPairDomain);
        }
      }
      
      // 거리 제약조건
      const distanceRule = this.constraints.distanceRules.find(
        c => c.students.includes(student.id) && c.students.includes(otherId)
      );
      
      if (distanceRule) {
        // 상대방은 최소 거리 이상 떨어진 곳에만 앉을 수 있음
        const validDistanceDomain = otherDomain.filter(seat => 
          calculateDistance(position, seat) >= distanceRule.minDistance
        );
        updatedDomains.set(otherId, validDistanceDomain);
      }
    }

    // 3. 도메인이 비어있는 학생이 있으면 실패
    for (const [studentId, domain] of updatedDomains) {
      if (studentId !== student.id && domain.length === 0) {
        return { isValid: false, updatedDomains };
      }
    }

    return { isValid: true, updatedDomains };
  }

  /**
   * 새로운 상태 생성
   */
  private createNewState(
    oldState: PlacementState,
    student: Student,
    position: Position,
    updatedDomains: Map<string, Position[]>
  ): PlacementState {
    const posKey = `${position.row}-${position.col}`;
    
    return {
      seating: { ...oldState.seating, [posKey]: student.id },
      placedStudents: new Set([...oldState.placedStudents, student.id]),
      unplacedStudents: oldState.unplacedStudents.filter(s => s.id !== student.id),
      studentDomains: updatedDomains,
      depth: oldState.depth + 1,
      violations: [], // 나중에 계산
      constraintsSatisfied: oldState.constraintsSatisfied,
      timeSpent: Date.now() - this.startTime
    };
  }

  /**
   * 결과 비교 (첫 번째가 더 좋으면 true)
   */
  private isResultBetter(result1: PlacementResult, result2: PlacementResult): boolean {
    // 1. 배치된 학생 수 비교
    if (result1.stats.placedStudents !== result2.stats.placedStudents) {
      return result1.stats.placedStudents > result2.stats.placedStudents;
    }
    
    // 2. 제약조건 위반 수 비교
    if (result1.stats.constraintViolations !== result2.stats.constraintViolations) {
      return result1.stats.constraintViolations < result2.stats.constraintViolations;
    }
    
    // 3. 같으면 첫 번째 유지
    return false;
  }

  /**
   * 최종 결과 생성
   */
  private createResult(state: PlacementState, message: string): PlacementResult {
    // 전체 학생 목록 재구성 (고정된 학생 + 배치할 학생)
    const allStudents = [...state.unplacedStudents];
    
    // 배치된 학생들의 정보도 복원
    for (const studentId of state.placedStudents) {
      if (!allStudents.some(s => s.id === studentId)) {
        // 고정된 학생 정보 찾기
        const fixedStudent = this.fixedPlacements.find(fp => fp.studentId === studentId);
        if (fixedStudent) {
          // 실제로는 전체 학생 목록에서 찾아야 하지만, 여기서는 더미 생성
          allStudents.push({
            id: studentId,
            name: `Student_${studentId.slice(-4)}`,
            gender: 'male' as const,
            createdAt: new Date()
          });
        }
      }
    }

    const validation = validateAllConstraints(
      state.seating, 
      allStudents, 
      this.classroom, 
      this.constraints
    );

    const stats = this.createStats(state.seating, allStudents);
    const placementRate = allStudents.length > 0 ? 
      (stats.placedStudents / allStudents.length * 100).toFixed(1) : '0';

    const fixedText = this.fixedPlacements.length > 0 ? ` (고정 ${this.fixedPlacements.length}명 포함)` : '';

    return {
      success: state.unplacedStudents.length === 0,
      seating: state.seating,
      message: `고급 휴리스틱 배치: ${message} (${stats.placedStudents}/${allStudents.length}명, ${placementRate}%)${fixedText}`,
      violations: validation.violations,
      stats
    };
  }

  /**
   * 통계 생성
   */
  private createStats(seating: SeatingArrangement, students: Student[]) {
    const totalSeats = this.classroom.rows * this.classroom.cols;
    const placedStudents = Object.keys(seating).length;
    
    return {
      totalSeats,
      availableSeats: this.availableSeats.length,
      disabledSeats: totalSeats - this.availableSeats.length,
      placedStudents,
      unplacedStudents: students.length - placedStudents,
      constraintViolations: 0 // validateAllConstraints에서 계산됨
    };
  }
}

/**
 * 고급 휴리스틱 백트래킹 배치 함수 (기존 함수와 호환)
 */
export const generateAdvancedHeuristicPlacement = async (
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

  // 복잡도에 따른 파라미터 조정
  const totalConstraints = constraints.pairRequired.length + 
                          constraints.pairProhibited.length + 
                          constraints.distanceRules.length;
  
  const complexity = students.length * totalConstraints;
  
  let timeLimit = 15000; // 기본 15초
  let maxDepth = students.length * 5;
  
  // 복잡도에 따른 동적 조정
  if (complexity > 500) {
    timeLimit = 45000; // 45초
    maxDepth = students.length * 3;
  } else if (complexity > 200) {
    timeLimit = 30000; // 30초
    maxDepth = students.length * 4;
  }

  console.log('🎯 고급 휴리스틱 파라미터:', {
    students: students.length,
    constraints: totalConstraints,
    complexity,
    timeLimit: `${timeLimit/1000}s`,
    maxDepth,
    fixedStudents: fixedPlacements.length
  });

  const engine = new AdvancedHeuristicEngine(classroom, constraints, {
    maxDepth,
    timeLimit,
    fixedPlacements, // 고정 배치 전달
    weights: {
      mrv: 0.35,
      degree: 0.35,
      criticality: 0.2,
      flexibility: 0.1
    }
  });

  return await engine.generatePlacement(students);
};

/**
 * 경량화된 휴리스틱 배치 (빠른 실행용)
 */
export const generateLightweightHeuristicPlacement = async (
  students: Student[], 
  classroom: ClassroomConfig,
  constraints: Constraints = { pairRequired: [], pairProhibited: [], distanceRules: [], rowExclusions: [] },
  fixedPlacements: FixedStudentPlacement[] = []
): Promise<PlacementResult> => {
  
  const engine = new AdvancedHeuristicEngine(classroom, constraints, {
    maxDepth: students.length * 2,
    timeLimit: 10000,
    fixedPlacements, // 고정 배치 전달
    weights: {
      mrv: 0.5,
      degree: 0.3,
      criticality: 0.15,
      flexibility: 0.05
    }
  });

  return await engine.generatePlacement(students);
};

/**
 * 제약조건 집중 휴리스틱 배치 (높은 정확도용)
 */
export const generateConstraintFocusedHeuristicPlacement = async (
  students: Student[], 
  classroom: ClassroomConfig,
  constraints: Constraints = { pairRequired: [], pairProhibited: [], distanceRules: [], rowExclusions: [] },
  fixedPlacements: FixedStudentPlacement[] = []
): Promise<PlacementResult> => {
  
  const engine = new AdvancedHeuristicEngine(classroom, constraints, {
    maxDepth: students.length * 8,
    timeLimit: 60000,
    fixedPlacements, // 고정 배치 전달
    weights: {
      mrv: 0.25,
      degree: 0.45,
      criticality: 0.25,
      flexibility: 0.05
    }
  });

  return await engine.generatePlacement(students);
};