//src/utils/adaptiveRandomHeuristic.ts
import { 
  Student, 
  ClassroomConfig, 
  Constraints, 
  SeatingArrangement, 
  Position, 
  PlacementResult,
  FixedStudentPlacement
} from '@/types';
import { 
  validateAllConstraints,
  isPairPosition,
  calculateDistance,
  findStudentPosition
} from './constraintValidator';
import { 
  getAvailableSeats, 
  createSeatingFromFixed, 
  getAvailableSeatsExcludingFixed 
} from './seatingAlgorithm';

interface RandomizationConfig {
  mode: 'conservative' | 'balanced' | 'exploratory' | 'chaos';
  studentSelectionRandomness: number;    // 0-100: 학생 선택 시 랜덤성
  seatSelectionRandomness: number;       // 0-100: 좌석 선택 시 랜덤성
  constraintFlexibility: number;         // 0-100: 제약조건 엄격함 정도
  diversityBoost: number;                // 0-100: 다양성 추구 정도
  explorationProbability: number;        // 0-100: 탐험적 선택 확률
}

interface StudentCandidate {
  student: Student;
  baseScore: number;           // 기본 휴리스틱 점수
  randomBonus: number;         // 랜덤 보너스
  finalScore: number;          // 최종 점수
  selectionReason: string;     // 선택 이유
}

interface SeatCandidate {
  position: Position;
  constraintScore: number;     // 제약조건 점수
  heuristicScore: number;      // 휴리스틱 점수
  randomFactor: number;        // 랜덤 요소
  diversityScore: number;      // 다양성 점수
  finalScore: number;          // 최종 점수
  riskLevel: 'safe' | 'moderate' | 'risky'; // 위험도
}

interface PlacementDecision {
  student: Student;
  position: Position;
  confidence: number;          // 0-100: 결정 신뢰도
  randomInfluence: number;     // 0-100: 랜덤성 영향도
  alternativeCount: number;    // 다른 선택지 수
  reasoning: string[];         // 결정 과정 설명
}


export class AdaptiveRandomHeuristicEngine {
  private classroom: ClassroomConfig;
  private constraints: Constraints;
  private availableSeats: Position[];
  private constraintGraph: Map<string, string[]>;
  private randomConfig: RandomizationConfig;
  private placementHistory: PlacementDecision[] = [];
  private diversityMap: Map<string, number> = new Map();
  private rng: () => number;
  private fixedPlacements: FixedStudentPlacement[]; 
  private fixedSeating: SeatingArrangement; 
  private startTime: number = 0;
  private maxDepth: number;
  private timeLimit: number;

  constructor(
    classroom: ClassroomConfig,
    constraints: Constraints,
    randomConfig?: Partial<RandomizationConfig>,
    seed?: number,
    fixedPlacements: FixedStudentPlacement[] = [],
    options: { maxDepth?: number; timeLimit?: number } = {} 
  ) {
    this.classroom = classroom;
    this.constraints = constraints;
    this.fixedPlacements = fixedPlacements; 
    this.fixedSeating = createSeatingFromFixed(fixedPlacements); 
    this.availableSeats = getAvailableSeatsExcludingFixed(classroom, fixedPlacements); // 수정
    this.randomConfig = this.createRandomConfig(randomConfig);
    this.rng = this.createSeededRandom(seed);
    this.constraintGraph = this.buildConstraintGraph();
    this.initializeDiversityMap();
    this.maxDepth = options.maxDepth || 1000;
    this.timeLimit = options.timeLimit || 30000;
  }

  /**
   * 메인 배치 실행
   */
  public async generatePlacement(students: Student[]): Promise<PlacementResult> {
    this.startTime = Date.now();
    
    console.log(`🎲 적응형 랜덤 휴리스틱 시작 (모드: ${this.randomConfig.mode})`);
    
    // 고정된 학생들 제외하고 배치할 학생들만 필터링
    const fixedStudentIds = new Set(this.fixedPlacements.map(fp => fp.studentId));
    const studentsToPlace = students.filter(s => !fixedStudentIds.has(s.id));
    
    // 초기 배치에 고정된 학생들 포함
    const seating: SeatingArrangement = { ...this.fixedSeating };
    const placedStudents = new Set<string>(fixedStudentIds);
    let unplacedStudents = [...studentsToPlace];
    
    // 다단계 배치 실행
    const phases = [
      { name: '제약조건 우선', weight: 0.8, randomness: 0.2 },
      { name: '휴리스틱 기반', weight: 0.6, randomness: 0.4 },
      { name: '적응형 탐색', weight: 0.4, randomness: 0.6 },
      { name: '다양성 추구', weight: 0.2, randomness: 0.8 }
    ];

    for (const phase of phases) {
      if (unplacedStudents.length === 0) break;
      
      console.log(`📍 ${phase.name} 단계 시작 (랜덤성: ${(phase.randomness * 100).toFixed(0)}%)`);
      
      const phaseConfig = {
        ...this.randomConfig,
        studentSelectionRandomness: this.randomConfig.studentSelectionRandomness * phase.randomness,
        seatSelectionRandomness: this.randomConfig.seatSelectionRandomness * phase.randomness
      };

      const phaseResult = await this.executePlacementPhase(
        unplacedStudents,
        seating,
        phaseConfig,
        phase.name
      );

      // 성공한 배치들을 적용
      Object.assign(seating, phaseResult.newPlacements);
      phaseResult.placedStudentIds.forEach(id => placedStudents.add(id));
      unplacedStudents = unplacedStudents.filter(s => !placedStudents.has(s.id));

      console.log(`✅ ${phase.name} 완료: ${phaseResult.placedStudentIds.length}명 배치`);
    }

    // 최종 검증 및 결과 생성 (전체 학생 대상)
    const validation = validateAllConstraints(seating, students, this.classroom, this.constraints);
    const stats = this.createStats(seating, students);
    const diversityScore = this.calculateDiversityScore(seating);

    const message = this.generateResultMessage(stats, diversityScore, this.randomConfig.mode, this.fixedPlacements.length);

    return {
      success: unplacedStudents.length === 0,
      seating,
      message,
      violations: validation.violations,
      stats
    };
  }

  /**
   * 현재 배치에서 사용 가능한 위치들 반환 (고정된 좌석 제외)
   */
  private getAvailablePositions(currentSeating: SeatingArrangement): Position[] {
    const usedPositions = new Set(Object.keys(currentSeating));
    return this.availableSeats.filter(pos => {
      const posKey = `${pos.row}-${pos.col}`;
      return !usedPositions.has(posKey);
    });
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
   * 단일 배치 단계 실행
   */
  private async executePlacementPhase(
    students: Student[],
    currentSeating: SeatingArrangement,
    config: RandomizationConfig,
    phaseName: string
  ): Promise<{ newPlacements: SeatingArrangement; placedStudentIds: string[] }> {
    
    const newPlacements: SeatingArrangement = {};
    const placedStudentIds: string[] = [];
    let remainingStudents = [...students];

    while (remainingStudents.length > 0) {
      // 1단계: 다음 배치할 학생 선택 (랜덤성 적용)
      const studentCandidate = this.selectNextStudent(remainingStudents, currentSeating, config);
      if (!studentCandidate) break;

      // 2단계: 해당 학생의 좌석 후보들 생성 및 평가
      const seatCandidates = this.evaluateSeatCandidates(
        studentCandidate.student,
        currentSeating,
        newPlacements,
        config
      );

      if (seatCandidates.length === 0) {
        // 배치할 수 없는 학생은 제외
        remainingStudents = remainingStudents.filter(s => s.id !== studentCandidate.student.id);
        continue;
      }

      // 3단계: 랜덤성을 고려한 좌석 선택
      const selectedSeat = this.selectSeatWithRandomness(seatCandidates, config);
      
      // 4단계: 배치 결정 및 기록
      const decision: PlacementDecision = {
        student: studentCandidate.student,
        position: selectedSeat.position,
        confidence: this.calculatePlacementConfidence(studentCandidate, selectedSeat),
        randomInfluence: this.calculateRandomInfluence(studentCandidate, selectedSeat, config),
        alternativeCount: seatCandidates.length - 1,
        reasoning: this.generatePlacementReasoning(studentCandidate, selectedSeat, config, phaseName)
      };

      // 5단계: 배치 실행
      const posKey = `${selectedSeat.position.row}-${selectedSeat.position.col}`;
      newPlacements[posKey] = studentCandidate.student.id;
      placedStudentIds.push(studentCandidate.student.id);
      remainingStudents = remainingStudents.filter(s => s.id !== studentCandidate.student.id);
      
      this.placementHistory.push(decision);
      this.updateDiversityMap(selectedSeat.position, studentCandidate.student);

      // 랜덤성에 따른 조기 종료 (탐험적 모드에서)
      if (config.mode === 'exploratory' && this.rng() < 0.1) {
        console.log(`🎯 탐험적 조기 종료 (${phaseName})`);
        break;
      }
    }

    return { newPlacements, placedStudentIds };
  }

  /**
   * 랜덤성이 적용된 학생 선택
   */
  private selectNextStudent(
    students: Student[],
    currentSeating: SeatingArrangement,
    config: RandomizationConfig
  ): StudentCandidate | null {
    
    if (students.length === 0) return null;

    const candidates: StudentCandidate[] = students.map(student => {
      // 기본 휴리스틱 점수 계산
      const baseScore = this.calculateStudentHeuristicScore(student, currentSeating);
      
      // 랜덤 보너스 적용
      const randomBonus = this.rng() * config.studentSelectionRandomness;
      
      // 다양성 보너스
      const diversityBonus = this.calculateStudentDiversityBonus(student, currentSeating) * config.diversityBoost / 100;
      
      const finalScore = baseScore + randomBonus + diversityBonus;

      return {
        student,
        baseScore,
        randomBonus,
        finalScore,
        selectionReason: this.generateStudentSelectionReason(baseScore, randomBonus, diversityBonus)
      };
    });

    // 탐험적 선택 vs 착취적 선택
    if (this.rng() < config.explorationProbability / 100) {
      // 탐험: 상위 30% 중에서 랜덤 선택
      const topCandidates = candidates
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, Math.max(1, Math.ceil(candidates.length * 0.3)));
      
      const randomIndex = Math.floor(this.rng() * topCandidates.length);
      return topCandidates[randomIndex];
    } else {
      // 착취: 최고 점수 선택 (약간의 랜덤성 포함)
      const sortedCandidates = candidates.sort((a, b) => b.finalScore - a.finalScore);
      
      // 상위 3개 중에서 가중 랜덤 선택
      const topThree = sortedCandidates.slice(0, 3);
      const weights = [0.6, 0.3, 0.1]; // 첫 번째가 가장 높은 확률
      
      const randomValue = this.rng();
      let cumulativeWeight = 0;
      
      for (let i = 0; i < topThree.length; i++) {
        cumulativeWeight += weights[i];
        if (randomValue <= cumulativeWeight) {
          return topThree[i];
        }
      }
      
      return topThree[0]; // 폴백
    }
  }

  /**
   * 좌석 후보들 평가
   */
  private evaluateSeatCandidates(
    student: Student,
    currentSeating: SeatingArrangement,
    newPlacements: SeatingArrangement,
    config: RandomizationConfig
  ): SeatCandidate[] {
    
    const allSeating = { ...currentSeating, ...newPlacements };
    const availablePositions = this.availableSeats.filter(pos => {
      const posKey = `${pos.row}-${pos.col}`;
      return !allSeating[posKey];
    });

    const candidates: SeatCandidate[] = availablePositions.map(position => {
      // 제약조건 점수
      const constraintScore = this.evaluateConstraintScore(student, position, allSeating);
      
      // 휴리스틱 점수 (거리, 성별 분포 등)
      const heuristicScore = this.evaluateHeuristicScore(student, position, allSeating);
      
      // 랜덤 요소
      const randomFactor = this.rng() * config.seatSelectionRandomness;
      
      // 다양성 점수
      const diversityScore = this.evaluateSeatDiversityScore(position, student) * config.diversityBoost / 100;
      
      // 위험도 평가
      const riskLevel = this.evaluateRiskLevel(constraintScore, heuristicScore);
      
      // 최종 점수 계산 (모드에 따라 가중치 조정)
      const finalScore = this.calculateFinalSeatScore(
        constraintScore,
        heuristicScore,
        randomFactor,
        diversityScore,
        config
      );

      return {
        position,
        constraintScore,
        heuristicScore,
        randomFactor,
        diversityScore,
        finalScore,
        riskLevel
      };
    });

    // 기본적으로 유효한 후보들만 반환 (제약조건 위반하지 않는)
    return candidates.filter(candidate => 
      candidate.constraintScore >= 0 && // 제약조건 위반하지 않음
      (config.mode === 'chaos' || candidate.riskLevel !== 'risky') // chaos 모드가 아니면 위험한 선택 제외
    );
  }

  /**
   * 랜덤성을 고려한 좌석 선택
   */
  private selectSeatWithRandomness(
    candidates: SeatCandidate[],
    config: RandomizationConfig
  ): SeatCandidate {
    
    if (candidates.length === 1) return candidates[0];

    // 모드별 선택 전략
    switch (config.mode) {
      case 'conservative':
        // 보수적: 안전한 선택 위주, 랜덤성 최소
        return this.selectConservatively(candidates);
        
      case 'balanced':
        // 균형: 좋은 선택과 다양성의 균형
        return this.selectBalanced(candidates, config);
        
      case 'exploratory':
        // 탐험적: 새로운 패턴 시도
        return this.selectExploratory(candidates, config);
        
      case 'chaos':
        // 카오스: 최대 랜덤성
        return this.selectChaotic(candidates);
        
      default:
        return candidates[0];
    }
  }

  /**
   * 보수적 선택
   */
  private selectConservatively(candidates: SeatCandidate[]): SeatCandidate {
    // 제약조건과 휴리스틱 점수가 높은 안전한 선택
    const safeCandidates = candidates.filter(c => c.riskLevel === 'safe');
    if (safeCandidates.length > 0) {
      return safeCandidates.reduce((best, current) => 
        current.constraintScore > best.constraintScore ? current : best
      );
    }
    return candidates.reduce((best, current) => 
      current.finalScore > best.finalScore ? current : best
    );
  }

  /**
   * 균형적 선택
   */
  private selectBalanced(candidates: SeatCandidate[], _config: RandomizationConfig): SeatCandidate {
    // 상위 50% 중에서 가중 랜덤 선택
    const sortedCandidates = candidates.sort((a, b) => b.finalScore - a.finalScore);
    const topHalf = sortedCandidates.slice(0, Math.max(1, Math.ceil(candidates.length * 0.5)));
    
    // 지수적 가중치 적용 (상위권일수록 높은 확률)
    const weights = topHalf.map((_, index) => Math.exp(-index * 0.5));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    const randomValue = this.rng() * totalWeight;
    let cumulativeWeight = 0;
    
    for (let i = 0; i < topHalf.length; i++) {
      cumulativeWeight += weights[i];
      if (randomValue <= cumulativeWeight) {
        return topHalf[i];
      }
    }
    
    return topHalf[0];
  }

  /**
   * 탐험적 선택
   */
  private selectExploratory(candidates: SeatCandidate[], _config: RandomizationConfig): SeatCandidate {
    // 다양성 점수가 높은 선택지를 선호
    const diversityWeightedCandidates = candidates.map(candidate => ({
      ...candidate,
      exploratoryScore: candidate.finalScore + candidate.diversityScore * 2
    }));
    
    const sortedByExploration = diversityWeightedCandidates
      .sort((a, b) => b.exploratoryScore - a.exploratoryScore);
    
    // 상위 70% 중에서 선택
    const explorationPool = sortedByExploration.slice(0, Math.ceil(candidates.length * 0.7));
    const randomIndex = Math.floor(this.rng() * explorationPool.length);
    
    return explorationPool[randomIndex];
  }

  /**
   * 카오스 선택
   */
  private selectChaotic(candidates: SeatCandidate[]): SeatCandidate {
    // 완전 랜덤 선택 (단, 기본 제약조건은 지킴)
    const randomIndex = Math.floor(this.rng() * candidates.length);
    return candidates[randomIndex];
  }

  // =================================================================
  // 유틸리티 메서드들
  // =================================================================

  private createRandomConfig(config?: Partial<RandomizationConfig>): RandomizationConfig {
    const defaultConfig: RandomizationConfig = {
      mode: 'balanced',
      studentSelectionRandomness: 30,
      seatSelectionRandomness: 25,
      constraintFlexibility: 10,
      diversityBoost: 40,
      explorationProbability: 20
    };

    return { ...defaultConfig, ...config };
  }

  private createSeededRandom(seed?: number): () => number {
    // Simple Linear Congruential Generator for consistent randomness
    let state = seed || Date.now() % 2147483647;
    return () => {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };
  }

  private initializeDiversityMap(): void {
    this.availableSeats.forEach(seat => {
      const key = `${seat.row}-${seat.col}`;
      this.diversityMap.set(key, 0);
    });
  }

  private calculateStudentHeuristicScore(student: Student, seating: SeatingArrangement): number {
    let score = 50; // 기본 점수

    // 제약조건이 많은 학생일수록 우선순위 높음
    const constraintCount = this.getStudentConstraintCount(student.id);
    score += constraintCount * 15;

    // 성별 기반 점수 조정
    const genderBalance = this.calculateGenderBalance(seating);
    if (student.gender === 'male' && genderBalance.maleRatio < 0.4) score += 10;
    if (student.gender === 'female' && genderBalance.femaleRatio < 0.4) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private calculateStudentDiversityBonus(student: Student, seating: SeatingArrangement): number {
    // 현재 배치된 학생들과의 다양성 점수
    let diversityBonus = 0;
    
    const placedStudentGenders = Object.values(seating).map(_studentId => {
      // 실제로는 학생 ID로 성별을 찾아야 함
      return 'unknown'; // 간단한 구현
    });

    // 성별 다양성 보너스
    const currentGenderCount = placedStudentGenders.filter(g => g === student.gender).length;
    if (currentGenderCount < Object.keys(seating).length * 0.4) {
      diversityBonus += 20;
    }

    return diversityBonus;
  }

  private evaluateConstraintScore(student: Student, position: Position, seating: SeatingArrangement): number {
    let score = 100; // 완벽한 상태에서 시작

    // 성별 제약조건 체크
    const genderConstraint = this.classroom.seatGenderConstraints?.find(
      c => c.position.row === position.row && c.position.col === position.col
    );
    if (genderConstraint?.requiredGender && student.gender !== genderConstraint.requiredGender) {
      return -100; // 완전 불가능
    }

    // 사용 불가 좌석 체크
    const usageConstraint = this.classroom.seatUsageConstraints?.find(
      c => c.position.row === position.row && c.position.col === position.col && c.isDisabled
    );
    if (usageConstraint) {
      return -100; // 완전 불가능
    }

    // 짝 제약조건 체크
    score -= this.evaluatePairConstraintViolations(student, position, seating) * 30;

    // 거리 제약조건 체크
    score -= this.evaluateDistanceConstraintViolations(student, position, seating) * 25;

    return Math.max(-100, Math.min(100, score));
  }

  private evaluateHeuristicScore(student: Student, position: Position, seating: SeatingArrangement): number {
    let score = 50;

    // 중앙 좌석 선호 (약간)
    const centerRow = (this.classroom.rows - 1) / 2;
    const centerCol = (this.classroom.cols - 1) / 2;
    const distanceFromCenter = Math.abs(position.row - centerRow) + Math.abs(position.col - centerCol);
    score += Math.max(0, 20 - distanceFromCenter * 2);

    // 성별 클러스터링 방지
    const nearbyGenderCount = this.countNearbyGender(student.gender, position, seating);
    if (nearbyGenderCount > 2) score -= 15; // 너무 몰리면 감점

    // 빈 공간 활용
    const nearbyEmptySeats = this.countNearbyEmptySeats(position, seating);
    score += nearbyEmptySeats * 3; // 확장 가능성

    return Math.max(0, Math.min(100, score));
  }

  private evaluateSeatDiversityScore(position: Position, _student: Student): number {
    const key = `${position.row}-${position.col}`;
    const currentDiversity = this.diversityMap.get(key) || 0;
    
    // 다양성이 낮은 위치일수록 높은 점수
    return Math.max(0, 100 - currentDiversity * 10);
  }

  private evaluateRiskLevel(constraintScore: number, heuristicScore: number): 'safe' | 'moderate' | 'risky' {
    const totalScore = constraintScore + heuristicScore;
    
    if (constraintScore < 0) return 'risky';
    if (totalScore > 120) return 'safe';
    if (totalScore > 80) return 'moderate';
    return 'risky';
  }

  private calculateFinalSeatScore(
    constraintScore: number,
    heuristicScore: number,
    randomFactor: number,
    diversityScore: number,
    config: RandomizationConfig
  ): number {
    
    // 모드별 가중치 조정
    let constraintWeight = 0.5;
    let heuristicWeight = 0.3;
    let randomWeight = 0.1;
    let diversityWeight = 0.1;

    switch (config.mode) {
      case 'conservative':
        constraintWeight = 0.7; heuristicWeight = 0.2; randomWeight = 0.05; diversityWeight = 0.05;
        break;
      case 'balanced':
        constraintWeight = 0.4; heuristicWeight = 0.3; randomWeight = 0.15; diversityWeight = 0.15;
        break;
      case 'exploratory':
        constraintWeight = 0.3; heuristicWeight = 0.2; randomWeight = 0.25; diversityWeight = 0.25;
        break;
      case 'chaos':
        constraintWeight = 0.2; heuristicWeight = 0.1; randomWeight = 0.5; diversityWeight = 0.2;
        break;
    }

    return constraintScore * constraintWeight +
           heuristicScore * heuristicWeight +
           randomFactor * randomWeight +
           diversityScore * diversityWeight;
  }

  // 추가 유틸리티 메서드들...
  private getStudentConstraintCount(studentId: string): number {
    return this.constraints.pairRequired.filter(c => c.students.includes(studentId)).length +
           this.constraints.pairProhibited.filter(c => c.students.includes(studentId)).length +
           this.constraints.distanceRules.filter(c => c.students.includes(studentId)).length;
  }

  private calculateGenderBalance(seating: SeatingArrangement): { maleRatio: number; femaleRatio: number } {
    const total = Object.keys(seating).length;
    if (total === 0) return { maleRatio: 0.5, femaleRatio: 0.5 };
    
    // 실제로는 학생 ID로 성별을 찾아야 함 (간단한 구현)
    return { maleRatio: 0.5, femaleRatio: 0.5 };
  }

  private evaluatePairConstraintViolations(student: Student, position: Position, seating: SeatingArrangement): number {
    let violations = 0;
    
    // 짝 강제 제약조건 체크
    this.constraints.pairRequired.forEach(constraint => {
      if (constraint.students.includes(student.id)) {
        const otherId = constraint.students.find(id => id !== student.id);
        if (otherId) {
          const otherPosition = findStudentPosition(otherId, seating);
          if (otherPosition && !isPairPosition(position, otherPosition)) {
            violations++;
          }
        }
      }
    });

    // 짝 방지 제약조건 체크
    this.constraints.pairProhibited.forEach(constraint => {
      if (constraint.students.includes(student.id)) {
        const otherId = constraint.students.find(id => id !== student.id);
        if (otherId) {
          const otherPosition = findStudentPosition(otherId, seating);
          if (otherPosition && isPairPosition(position, otherPosition)) {
            violations++;
          }
        }
      }
    });

    return violations;
  }

  private evaluateDistanceConstraintViolations(student: Student, position: Position, seating: SeatingArrangement): number {
    let violations = 0;

    this.constraints.distanceRules.forEach(constraint => {
      if (constraint.students.includes(student.id)) {
        const otherId = constraint.students.find(id => id !== student.id);
        if (otherId) {
          const otherPosition = findStudentPosition(otherId, seating);
          if (otherPosition) {
            const distance = calculateDistance(position, otherPosition);
            if (distance < constraint.minDistance) {
              violations++;
            }
          }
        }
      }
    });

    return violations;
  }

  private countNearbyGender(_gender: 'male' | 'female', position: Position, seating: SeatingArrangement): number {
    let count = 0;
    const adjacentPositions = [
      { row: position.row - 1, col: position.col - 1 }, // 좌상
      { row: position.row - 1, col: position.col },     // 상
      { row: position.row - 1, col: position.col + 1 }, // 우상
      { row: position.row, col: position.col - 1 },     // 좌
      { row: position.row, col: position.col + 1 },     // 우
      { row: position.row + 1, col: position.col - 1 }, // 좌하
      { row: position.row + 1, col: position.col },     // 하
      { row: position.row + 1, col: position.col + 1 }, // 우하
    ];

    adjacentPositions.forEach(pos => {
      if (pos.row >= 0 && pos.row < this.classroom.rows && 
          pos.col >= 0 && pos.col < this.classroom.cols) {
        const posKey = `${pos.row}-${pos.col}`;
        const studentId = seating[posKey];
        if (studentId) {
          // 실제로는 학생 ID로 성별을 찾아야 함 (간단한 구현)
          // const student = this.findStudentById(studentId);
          // if (student && student.gender === gender) count++;
        }
      }
    });

    return count;
  }

  private countNearbyEmptySeats(position: Position, seating: SeatingArrangement): number {
    let count = 0;
    const adjacentPositions = [
      { row: position.row - 1, col: position.col - 1 },
      { row: position.row - 1, col: position.col },
      { row: position.row - 1, col: position.col + 1 },
      { row: position.row, col: position.col - 1 },
      { row: position.row, col: position.col + 1 },
      { row: position.row + 1, col: position.col - 1 },
      { row: position.row + 1, col: position.col },
      { row: position.row + 1, col: position.col + 1 },
    ];

    adjacentPositions.forEach(pos => {
      if (pos.row >= 0 && pos.row < this.classroom.rows && 
          pos.col >= 0 && pos.col < this.classroom.cols) {
        const posKey = `${pos.row}-${pos.col}`;
        if (!seating[posKey]) {
          count++;
        }
      }
    });

    return count;
  }

  private calculatePlacementConfidence(_student: StudentCandidate, seat: SeatCandidate): number {
    // 제약조건 만족도가 높고, 대안이 적을수록 높은 신뢰도
    const constraintConfidence = Math.max(0, Math.min(100, seat.constraintScore));
    const alternativesPenalty = Math.min(20, seat.finalScore * 0.1); // 대안이 많으면 신뢰도 하락
    
    return Math.max(0, Math.min(100, constraintConfidence - alternativesPenalty));
  }

  private calculateRandomInfluence(
    _student: StudentCandidate, 
    seat: SeatCandidate, 
    _config: RandomizationConfig
  ): number {
    // 랜덤성이 최종 결정에 미친 영향도 계산
    // const randomWeight = config.seatSelectionRandomness / 100;
    const totalScore = seat.constraintScore + seat.heuristicScore + seat.randomFactor + seat.diversityScore;
    
    if (totalScore <= 0) return 0;
    
    return (seat.randomFactor / totalScore) * 100;
  }

  private generatePlacementReasoning(
    _student: StudentCandidate,
    seat: SeatCandidate,
    config: RandomizationConfig,
    phaseName: string
  ): string[] {
    const reasoning: string[] = [];
    
    reasoning.push(`${phaseName} 단계에서 선택`);
    
    if (seat.constraintScore > 50) {
      reasoning.push('제약조건 만족');
    } else if (seat.constraintScore > 0) {
      reasoning.push('제약조건 부분 만족');
    }
    
    if (seat.heuristicScore > 60) {
      reasoning.push('휴리스틱 점수 우수');
    }
    
    if (seat.randomFactor > config.seatSelectionRandomness * 0.7) {
      reasoning.push('랜덤성으로 선택');
    }
    
    if (seat.diversityScore > 70) {
      reasoning.push('다양성 증진');
    }
    
    reasoning.push(`위험도: ${seat.riskLevel}`);
    
    return reasoning;
  }

  private generateStudentSelectionReason(baseScore: number, randomBonus: number, diversityBonus: number): string {
    const reasons: string[] = [];
    
    if (baseScore > 70) reasons.push('높은 우선순위');
    if (randomBonus > 20) reasons.push('랜덤 선택');
    if (diversityBonus > 15) reasons.push('다양성 기여');
    
    return reasons.join(', ') || '기본 선택';
  }

  private updateDiversityMap(position: Position, _student: Student): void {
    const key = `${position.row}-${position.col}`;
    const currentValue = this.diversityMap.get(key) || 0;
    this.diversityMap.set(key, currentValue + 1);
    
    // 주변 좌석의 다양성도 업데이트
    const adjacentPositions = [
      { row: position.row - 1, col: position.col },
      { row: position.row + 1, col: position.col },
      { row: position.row, col: position.col - 1 },
      { row: position.row, col: position.col + 1 },
    ];
    
    adjacentPositions.forEach(pos => {
      if (pos.row >= 0 && pos.row < this.classroom.rows && 
          pos.col >= 0 && pos.col < this.classroom.cols) {
        const adjKey = `${pos.row}-${pos.col}`;
        const adjValue = this.diversityMap.get(adjKey) || 0;
        this.diversityMap.set(adjKey, adjValue + 0.5); // 간접 영향
      }
    });
  }

  private calculateDiversityScore(seating: SeatingArrangement): number {
    // 전체 배치의 다양성 점수 계산
    if (Object.keys(seating).length === 0) return 0;
    
    let totalDiversity = 0;
    let evaluatedPositions = 0;
    
    this.diversityMap.forEach((value, key) => {
      if (seating[key]) { // 학생이 배치된 좌석만 평가
        totalDiversity += value;
        evaluatedPositions++;
      }
    });
    
    return evaluatedPositions > 0 ? totalDiversity / evaluatedPositions : 0;
  }

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

  private generateResultMessage(stats: any, diversityScore: number, mode: string, fixedCount: number): string {
    const placementRate = stats.placedStudents > 0 ? 
      ((stats.placedStudents / (stats.placedStudents + stats.unplacedStudents)) * 100).toFixed(1) : '0';
    
    const modeDescriptions = {
      conservative: '안정적',
      balanced: '균형잡힌',
      exploratory: '탐험적',
      chaos: '창의적'
    };
    
    const modeDesc = modeDescriptions[mode as keyof typeof modeDescriptions] || mode;
    
    let message = `${modeDesc} 랜덤 휴리스틱 배치: ${stats.placedStudents}/${stats.placedStudents + stats.unplacedStudents}명 배치 (${placementRate}%)`;
    
    // 고정 학생 정보 추가
    if (fixedCount > 0) {
      message += ` (고정 ${fixedCount}명 포함)`;
    }
    
    if (diversityScore > 0) {
      message += ` | 다양성 점수: ${diversityScore.toFixed(1)}`;
    }
    
    // 배치 과정의 특징 추가
    const randomDecisions = this.placementHistory.filter(d => d.randomInfluence > 30).length;
    if (randomDecisions > 0) {
      message += ` | 랜덤 결정: ${randomDecisions}건`;
    }
    
    return message;
  }

  /**
   * 배치 과정 분석 정보 제공
   */
  public getPlacementAnalysis(): {
    totalDecisions: number;
    averageConfidence: number;
    averageRandomInfluence: number;
    riskDistribution: { safe: number; moderate: number; risky: number };
    phaseBreakdown: Record<string, number>;
  } {
    const totalDecisions = this.placementHistory.length;
    
    if (totalDecisions === 0) {
      return {
        totalDecisions: 0,
        averageConfidence: 0,
        averageRandomInfluence: 0,
        riskDistribution: { safe: 0, moderate: 0, risky: 0 },
        phaseBreakdown: {}
      };
    }
    
    const totalConfidence = this.placementHistory.reduce((sum, d) => sum + d.confidence, 0);
    const totalRandomInfluence = this.placementHistory.reduce((sum, d) => sum + d.randomInfluence, 0);
    
    const riskDistribution = { safe: 0, moderate: 0, risky: 0 };
    const phaseBreakdown: Record<string, number> = {};
    
    this.placementHistory.forEach(decision => {
      // 위험도는 신뢰도로 추정
      if (decision.confidence > 70) riskDistribution.safe++;
      else if (decision.confidence > 40) riskDistribution.moderate++;
      else riskDistribution.risky++;
      
      // 단계별 분석은 reasoning에서 추출
      const phase = decision.reasoning[0] || 'unknown';
      phaseBreakdown[phase] = (phaseBreakdown[phase] || 0) + 1;
    });
    
    return {
      totalDecisions,
      averageConfidence: totalConfidence / totalDecisions,
      averageRandomInfluence: totalRandomInfluence / totalDecisions,
      riskDistribution,
      phaseBreakdown
    };
  }

  /**
   * 다른 배치 결과 생성 (같은 조건에서 다른 랜덤 시드 사용)
   */
  public async generateAlternativePlacement(students: Student[], newSeed?: number): Promise<PlacementResult> {
    // 새로운 랜덤 시드로 재설정
    this.rng = this.createSeededRandom(newSeed || Date.now());
    this.placementHistory = [];
    this.initializeDiversityMap();
    
    return await this.generatePlacement(students);
  }
}

/**
 * 프리셋 랜덤 설정들
 */
export const RANDOMNESS_PRESETS: Record<string, RandomizationConfig> = {
  subtle: {
    mode: 'conservative',
    studentSelectionRandomness: 15,
    seatSelectionRandomness: 10,
    constraintFlexibility: 5,
    diversityBoost: 20,
    explorationProbability: 10
  },
  
  balanced: {
    mode: 'balanced',
    studentSelectionRandomness: 30,
    seatSelectionRandomness: 25,
    constraintFlexibility: 10,
    diversityBoost: 40,
    explorationProbability: 20
  },
  
  creative: {
    mode: 'exploratory',
    studentSelectionRandomness: 50,
    seatSelectionRandomness: 45,
    constraintFlexibility: 20,
    diversityBoost: 60,
    explorationProbability: 35
  },
  
  wild: {
    mode: 'chaos',
    studentSelectionRandomness: 80,
    seatSelectionRandomness: 75,
    constraintFlexibility: 40,
    diversityBoost: 30,
    explorationProbability: 60
  }
};

/**
 * 적응형 랜덤 휴리스틱 배치 함수
 */
export const generateAdaptiveRandomPlacement = async (
  students: Student[], 
  classroom: ClassroomConfig,
  constraints: Constraints = { pairRequired: [], pairProhibited: [], distanceRules: [], rowExclusions: [] },
  options: {
    preset?: keyof typeof RANDOMNESS_PRESETS;
    customConfig?: Partial<RandomizationConfig>;
    seed?: number;
    generateMultiple?: number; // 여러 개 생성 후 최고 선택
    fixedPlacements?: FixedStudentPlacement[]; // 새로 추가
  } = {}
): Promise<PlacementResult> => {
  
  const fixedPlacements = options.fixedPlacements || [];
  
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

  // 설정 준비
  let config: RandomizationConfig;
  if (options.preset) {
    config = { ...RANDOMNESS_PRESETS[options.preset], ...options.customConfig };
  } else {
    config = { ...RANDOMNESS_PRESETS.balanced, ...options.customConfig };
  }

  // 다중 생성 옵션
  if (options.generateMultiple && options.generateMultiple > 1) {
    console.log(`🎲 ${options.generateMultiple}개의 배치 후보 생성 중...`);
    
    const results: PlacementResult[] = [];
    
    for (let i = 0; i < options.generateMultiple; i++) {
      const engine = new AdaptiveRandomHeuristicEngine(
        classroom, 
        constraints, 
        config, 
        options.seed ? options.seed + i : undefined,
        fixedPlacements // 고정 배치 전달
      );
      
      const result = await engine.generatePlacement(students);
      results.push({
        ...result,
        message: `${result.message} (후보 ${i + 1}/${options.generateMultiple})`
      });
    }
    
    // 최고 결과 선택 (배치 성공률 + 제약조건 만족도 기준)
    const bestResult = results.reduce((best, current) => {
      const bestScore = best.stats.placedStudents * 100 - best.stats.constraintViolations * 10;
      const currentScore = current.stats.placedStudents * 100 - current.stats.constraintViolations * 10;
      return currentScore > bestScore ? current : best;
    });
    
    bestResult.message += ` | 최적 선택됨`;
    return bestResult;
  }

  // 단일 생성
  const engine = new AdaptiveRandomHeuristicEngine(
    classroom, 
    constraints, 
    config, 
    options.seed,
    fixedPlacements // 고정 배치 전달
  );
  const result = await engine.generatePlacement(students);
  
  // 분석 정보 추가 (개발 모드에서)
  if (process.env.NODE_ENV === 'development') {
    const analysis = engine.getPlacementAnalysis();
    console.log('🔍 배치 분석:', analysis);
  }
  
  return result;
};