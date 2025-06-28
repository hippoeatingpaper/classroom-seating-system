//src/components/placement/PlacementControls.tsx
import React, { useState } from 'react';
import { 
  Shuffle, RotateCcw, Users, UserCheck, AlertTriangle, CheckCircle, 
  Target, Brain, Settings2,
  Clock, TrendingUp, Activity, Sparkles, Rows,
  Pin, PinOff
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useAppContext } from '@/context/AppContext';
import { 
  getAvailableSeats,
  validateSeatingArrangement,
  getAvailableSeatsExcludingFixed
} from '@/utils/seatingAlgorithm';
import { validateConstraintCompatibility } from '@/utils/constraintValidator';
import { FixedStudentPlacement, Student } from '@/types';

type AlgorithmType = 
  | 'gender'
  | 'adaptive_random_subtle'
  | 'adaptive_random_balanced'
  | 'adaptive_random_creative'
  | 'adaptive_random_wild';

interface AlgorithmOption {
  id: AlgorithmType;
  name: string;
  description: string;
  icon: typeof Brain;
  color: string;
  timeComplexity: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  accuracy: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  bestFor: string[];
  minConstraints?: number;
  maxStudents?: number;
  isRecommended?: boolean; // 추천 알고리즘 표시
  isNew?: boolean;        // 새로운 알고리즘 표시
}

interface PlacementProgress {
  phase: string;
  progress: number; // 0-100
  message: string;
  estimatedRemaining: number; // ms
}

interface QualityMetrics {
  placementRate: number;      // 배치 성공률
  constraintSatisfaction: number; // 제약조건 준수율
  executionTime: number;      // 실행 시간
  qualityScore: number;       // 종합 품질 점수
  efficiency: 'excellent' | 'good' | 'fair' | 'poor';
}

interface FixedStudentItem extends FixedStudentPlacement {
  student: Student;
  positionText: string;
}

const categorizeViolations = (violations: any[]) => {
  const publicViolations = violations.filter(v => 
    v.type === 'pair_required' || v.type === 'pair_prohibited'
  );
  const hiddenViolations = violations.filter(v => 
    v.type === 'distance' || v.type === 'row_exclusion'
  );

  return { publicViolations, hiddenViolations };
};

const getSelectedAlgorithmIcon = (selectedAlgorithm: AlgorithmType) => {
  const algorithm = ALGORITHM_OPTIONS.find(a => a.id === selectedAlgorithm);
  if (algorithm) {
    return algorithm.icon;
  }
  
  // 기본값 반환
  switch (selectedAlgorithm) {
    case 'gender': return Users;
    case 'adaptive_random_subtle': return Target;
    case 'adaptive_random_balanced': return Activity;
    case 'adaptive_random_creative': return Sparkles;
    case 'adaptive_random_wild': return Shuffle;
    default: return Activity;
  }
};

const getSelectedAlgorithmName = (selectedAlgorithm: AlgorithmType) => {
  const algorithm = ALGORITHM_OPTIONS.find(a => a.id === selectedAlgorithm);
  if (algorithm) {
    return algorithm.name;
  }
  
  // 기본값 반환
  switch (selectedAlgorithm) {
    case 'gender': return '👫 남녀 구분';
    case 'adaptive_random_subtle': return '🎯 적응형 랜덤 (미묘)';
    case 'adaptive_random_balanced': return '⚖️ 적응형 랜덤 (균형)';
    case 'adaptive_random_creative': return '🎨 적응형 랜덤 (창의적)';
    case 'adaptive_random_wild': return '🌪️ 적응형 랜덤 (와일드)';
    default: return '🎨 적응형 랜덤 (균형)';
  }
};

const ALGORITHM_OPTIONS: AlgorithmOption[] = [
  {
    id: 'gender',
    name: '👫 남녀 구분',
    description: 'N쌍의 남녀 짝 우선 배치 후 나머지 랜덤 배치',
    icon: Users as typeof Users,
    color: 'text-pink-600',
    timeComplexity: 'LOW',
    accuracy: 'MEDIUM',
    bestFor: ['남녀 짝 배치', '성별 균형', '간단한 규칙'],
    isRecommended: false,
  },
  {
    id: 'adaptive_random_subtle',
    name: '🎯 적응형 랜덤 (미묘)',
    description: '제약조건을 우선하되 약간의 랜덤성으로 예측 불가능성 추가',
    icon: Target as typeof Target,
    color: 'text-green-600',
    timeComplexity: 'LOW',
    accuracy: 'HIGH',
    bestFor: ['안정적 랜덤성', '약간의 변화', '예측 가능한 결과'],
    isNew: false,
  },
  {
    id: 'adaptive_random_balanced',
    name: '⚖️ 적응형 랜덤 (균형)',
    description: '휴리스틱과 랜덤성의 완벽한 균형으로 흥미로운 배치 생성',
    icon: Activity as typeof Activity,
    color: 'text-blue-600',
    timeComplexity: 'MEDIUM',
    accuracy: 'HIGH',
    bestFor: ['균형잡힌 랜덤성', '다양한 결과', '흥미로운 패턴'],
    isRecommended: true,
    isNew: false,
  },
  {
    id: 'adaptive_random_creative',
    name: '🎨 적응형 랜덤 (창의적)',
    description: '높은 다양성과 탐험적 선택으로 창의적인 배치 패턴 생성',
    icon: Sparkles as typeof Sparkles,
    color: 'text-purple-600',
    timeComplexity: 'MEDIUM',
    accuracy: 'MEDIUM',
    bestFor: ['창의적 배치', '다양성 추구', '새로운 패턴'],
    isRecommended: true,
    isNew: false,
  },
  {
    id: 'adaptive_random_wild',
    name: '🌪️ 적응형 랜덤 (와일드)',
    description: '최대 랜덤성으로 완전히 예측 불가능한 독특한 배치 생성',
    icon: Shuffle as typeof Shuffle,
    color: 'text-red-600',
    timeComplexity: 'LOW',
    accuracy: 'LOW',
    bestFor: ['최대 다양성', '파격적 배치', '실험적 시도'],
    isNew: false,
  },
];

export const PlacementControls: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<AlgorithmType>('adaptive_random_balanced');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [placementProgress, setPlacementProgress] = useState<PlacementProgress | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [pairCount, setPairCount] = useState<number>(0);
  const [adaptiveRandomOptions, setAdaptiveRandomOptions] = useState({
    generateMultiple: 3,  // 여러 후보 중 최고 선택
    seed: 0,             // 시드 값 (0이면 랜덤)
    customRandomness: 50, // 커스텀 랜덤성 (0-100)
  });
  // 기존 state 변수들 아래에 추가
  const [enableRetry, setEnableRetry] = useState(false);
  const [retryProgress, setRetryProgress] = useState<{attempt: number, maxAttempts: number} | null>(null);

  // 통계 계산
  const availableSeats = getAvailableSeats(state.classroom);
  const totalSeats = state.classroom.rows * state.classroom.cols;
  const disabledSeats = totalSeats - availableSeats.length;
  const placedStudents = Object.keys(state.currentSeating).length;
  
  // 고정 학생 관련 계산 수정
  const fixedStudentCount = state.fixedPlacements.length;
  const availableStudentsForPlacement = state.students.length - fixedStudentCount;
  
  // 고정된 학생들이 차지하는 좌석을 제외한 실제 사용 가능한 좌석 수
  const availableSeatsForPlacement = getAvailableSeatsExcludingFixed(state.classroom, state.fixedPlacements).length;
  
  // 전체 배치 가능 여부 (고정 학생 고려)
  const canPlaceAll = availableStudentsForPlacement <= availableSeatsForPlacement;
  // 제약조건 통계
  const showAdvanced = localStorage.getItem('constraints_show_advanced') === 'true';
  const totalConstraints = state.constraints.pairRequired.length + 
                          state.constraints.pairProhibited.length + 
                          (showAdvanced ? (state.constraints.distanceRules.length + state.constraints.rowExclusions.length) : 0);
  
  // 제약조건 호환성 체크
  const constraintCompatibility = validateConstraintCompatibility(
    state.constraints,
    state.students,
    state.classroom
  );

  // 알고리즘 추천 시스템 
  const getRecommendedAlgorithms = (): AlgorithmType[] => {
    const recommendations: AlgorithmType[] = [];
    
    // 기본 추천 (항상)
    recommendations.push('adaptive_random_balanced'); 
    
    return [...new Set(recommendations)];
  };

  const recommendedAlgorithms = getRecommendedAlgorithms();

  // 알고리즘 필터링 (조건에 맞지 않는 것들 비활성화)
  const getAlgorithmAvailability = (algorithm: AlgorithmOption): {
    available: boolean;
    reason?: string;
  } => {
    // 고정되지 않은 학생 수 계산
    const fixedStudentIds = new Set(state.fixedPlacements.map(fp => fp.studentId));
    const studentsToPlace = state.students.filter(s => !fixedStudentIds.has(s.id));
    
    if (algorithm.maxStudents && studentsToPlace.length > algorithm.maxStudents) {
      return {
        available: false,
        reason: `배치할 학생 ${studentsToPlace.length}명이 권장 최대값 ${algorithm.maxStudents}명을 초과`
      };
    }
    
    // 남녀 구분 알고리즘 특별 조건 (고정되지 않은 학생만 고려)
    if (algorithm.id === 'gender') {
      const maleCount = studentsToPlace.filter(s => s.gender === 'male').length;
      const femaleCount = studentsToPlace.filter(s => s.gender === 'female').length;
      
      if (maleCount === 0 || femaleCount === 0) {
        return {
          available: false,
          reason: '배치할 남학생과 여학생이 모두 필요합니다'
        };
      }
    }
    
    return { available: true };
  };

  const handleGeneratePlacement = async () => {
    if (state.students.length === 0) {
      alert('배치할 학생이 없습니다.');
      return;
    }

    // 고정되지 않은 학생 수 확인 추가
    const fixedStudentIds = new Set(state.fixedPlacements.map(fp => fp.studentId));
    const studentsToPlace = state.students.filter(s => !fixedStudentIds.has(s.id));
    
    if (studentsToPlace.length === 0) {
      alert('모든 학생이 이미 고정되어 있습니다. 배치할 학생이 없습니다.');
      return;
    }

    // 제약조건 충돌 체크
    if (!constraintCompatibility.isValid) {
      const conflicts = constraintCompatibility.conflicts.slice(0, 3).join('\n');
      const remaining = constraintCompatibility.conflicts.length > 3 ? 
        `\n... 외 ${constraintCompatibility.conflicts.length - 3}건 더` : '';
      
      if (!confirm(`제약조건 충돌이 감지되었습니다:\n\n${conflicts}${remaining}\n\n그래도 배치를 진행하시겠습니까?`)) {
        return;
      }
    }

    setIsGenerating(true);
    setPlacementProgress(null);
    setQualityMetrics(null);
    setRetryProgress(null);
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      await new Promise(resolve => setTimeout(resolve, 300));

      console.log(`🎯 선택된 알고리즘: ${selectedAlgorithm}`);
      console.log(`📌 고정된 학생 수: ${state.fixedPlacements.length}`);
      console.log(`🎒 배치할 학생 수: ${studentsToPlace.length}`);
      
      const startTime = Date.now();
      
      // 재시도 로직이 포함된 함수 사용
      const { generatePlacementWithRetry } = await import('@/utils/seatingAlgorithm');
      
      const result = await generatePlacementWithRetry(
        selectedAlgorithm,
        state.students,
        state.classroom,
        state.constraints,
        {
          enableRetry,
          maxRetries: 10,
          onProgress: (attempt, maxAttempts) => {
            setRetryProgress({ attempt, maxAttempts });
          },
          algorithmOptions: {
            pairCount,
            ...adaptiveRandomOptions
          },
          fixedPlacements: state.fixedPlacements // 🔥 여기가 핵심 수정사항!
        }
      );

      const duration = Date.now() - startTime;

      if (result.success) {
        // 실제 위반 개수 계산 (배열 길이 기준)
        const actualViolations = result.violations || [];
        const { publicViolations, hiddenViolations } = categorizeViolations(actualViolations);
        const hasPublicViolations = publicViolations.length > 0;
        const hasHiddenViolations = hiddenViolations.length > 0;
        
        // 숨겨진 제약조건만 위반된 경우 - 배치 결과 숨기고 오류 메시지
        if (hasHiddenViolations && !hasPublicViolations) {
          alert('배치 중 오류가 발생했습니다. 다시 시도해주세요.');
          setLastResult(null); // 결과 숨김
          return;
        }
        
        // 정상적인 경우 - 배치 결과 표시
        dispatch({ type: 'SET_SEATING', payload: result.seating });
        setLastResult({
          ...result,
          violations: publicViolations, // 공개 위반사항만 저장
          stats: {
            ...result.stats,
            constraintViolations: publicViolations.length // 공개 위반 개수로 수정
          }
        });
        
        // 알림 메시지 생성
        let message = `배치 완료! ${result.stats.placedStudents}/${state.students.length}명 배치됨`;
        
        // 고정 학생 정보 추가
        if (fixedStudentCount > 0) {
          message += ` (고정 ${fixedStudentCount}명 포함)`;
        }
        
        // 재시도 정보 추가
        if (enableRetry && retryProgress && retryProgress.attempt > 1) {
          message += `\n(${retryProgress.attempt - 1}회 재시도 후 최적 결과)`;
        }
        
        // 공개 제약조건 위반 상태에 따른 메시지
        if (hasPublicViolations) {
          message += `\n⚠️ 제약조건 ${publicViolations.length}건 위반`;
          
          // 공개 위반 세부사항 추가 (최대 3개)
          const violationDetails = publicViolations.slice(0, 3).map(v => v.message).join('\n');
          const remainingCount = publicViolations.length > 3 ? publicViolations.length - 3 : 0;
          
          message += `\n\n위반 내용:\n${violationDetails}`;
          if (remainingCount > 0) {
            message += `\n... 외 ${remainingCount}건 더`;
          }
        } else if (totalConstraints > 0) {
          // 표시 가능한 제약조건만 계산 (거리유지, 줄제외 제외)
          const visibleConstraints = state.constraints.pairRequired.length + 
                                    state.constraints.pairProhibited.length;
          if (visibleConstraints > 0) {
            message += `\n✅ 모든 제약조건 만족`;
          }
        }
        // 품질 메트릭 계산
        const placementRate = (result.stats.placedStudents / state.students.length) * 100;
        const visibleConstraints = state.constraints.pairRequired.length + 
                                  state.constraints.pairProhibited.length;
        const constraintSatisfaction = visibleConstraints > 0 ? 
          ((visibleConstraints - publicViolations.length) / visibleConstraints) * 100 : 100;

        setQualityMetrics({
          placementRate,
          constraintSatisfaction,
          executionTime: duration,
          qualityScore: (placementRate + constraintSatisfaction) / 2,
          efficiency: duration < 1000 ? 'excellent' : duration < 3000 ? 'good' : duration < 5000 ? 'fair' : 'poor'
        });
        alert(message);
      } else {
        alert(`배치 실패: ${result.message}`);
        setLastResult(result);
      }

      

    } catch (error) {
      console.error('배치 생성 오류:', error);
      alert('배치 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
      setPlacementProgress(null);
      setRetryProgress(null);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleResetPlacement = () => {
    if (Object.keys(state.currentSeating).length === 0) {
      alert('초기화할 배치가 없습니다.');
      return;
    }

    if (confirm('현재 배치를 모두 초기화하시겠습니까?')) {
      dispatch({ type: 'CLEAR_SEATING' });
      setLastResult(null);
      setQualityMetrics(null);
    }
  };

  const handleValidatePlacement = () => {
    if (Object.keys(state.currentSeating).length === 0) {
      alert('검증할 배치가 없습니다.');
      return;
    }

    const validation = validateSeatingArrangement(
      state.currentSeating,
      state.students,
      state.classroom,
      state.constraints
    );

    if (validation.isValid) {
      alert('✅ 현재 배치에 문제가 없습니다!');
    } else {
      const violations = validation.violations.slice(0, 5);
      let message = `❌ 배치 문제 발견:\n\n${violations.join('\n')}`;
      if (validation.violations.length > 5) {
        message += `\n... 외 ${validation.violations.length - 5}건 더`;
      }
      alert(message);
    }
  };

  const getComplexityBadge = (complexity: string) => {
    const colors = {
      LOW: 'bg-green-100 text-green-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      HIGH: 'bg-orange-100 text-orange-800',
      VERY_HIGH: 'bg-red-100 text-red-800'
    };
    return colors[complexity as keyof typeof colors] || colors.MEDIUM;
  };

  const getAccuracyBadge = (accuracy: string) => {
    const colors = {
      LOW: 'bg-red-100 text-red-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      HIGH: 'bg-blue-100 text-blue-800',
      VERY_HIGH: 'bg-purple-100 text-purple-800'
    };
    return colors[accuracy as keyof typeof colors] || colors.MEDIUM;
  };


  const getEfficiencyColor = (efficiency: QualityMetrics['efficiency']) => {
    const colors = {
      excellent: 'text-green-600',
      good: 'text-blue-600',
      fair: 'text-yellow-600',
      poor: 'text-red-600'
    };
    return colors[efficiency];
  };

  const getEfficiencyLabel = (efficiency: QualityMetrics['efficiency']) => {
    const labels = {
      excellent: '탁월',
      good: '우수',
      fair: '보통',
      poor: '개선 필요'
    };
    return labels[efficiency];
  };
  
  // 모든 고정 해제 핸들러
  const handleClearAllFixed = () => {
    if (fixedStudentCount === 0) return;
    
    const confirmed = confirm(
      `고정된 모든 학생(${fixedStudentCount}명)의 고정을 해제하시겠습니까?\n\n` +
      `해제 후에는 다음 배치 실행 시 이동할 수 있습니다.`
    );
    
    if (confirmed) {
      dispatch({ type: 'CLEAR_ALL_FIXED_PLACEMENTS' });
    }
  };
  
  // 고정 학생 목록 표시
  const getFixedStudentsList = (): FixedStudentItem[] => {
    return state.fixedPlacements
      .map(fp => {
        const student = state.students.find(s => s.id === fp.studentId);
        if (!student) return null;
        
        return {
          ...fp,
          student,
          positionText: `${fp.position.row + 1}-${fp.position.col + 1}`
        };
      })
      .filter((item): item is FixedStudentItem => item !== null); // 타입 가드 사용
  };

  return (
    <div className="space-y-4">
      {/* 기존 배치 정보 카드 수정 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          배치 현황
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-blue-700">전체 학생:</span>
            <span className="font-medium">{state.students.length}명</span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-700">배치됨:</span>
            <span className="font-medium">{placedStudents}명</span>
          </div>
          <div className="flex justify-between">
            <span className="text-purple-700">고정됨:</span>
            <span className="font-medium">{fixedStudentCount}명</span>
          </div>
          <div className="flex justify-between">
            <span className="text-orange-700">배치 대상:</span>
            <span className="font-medium">{availableStudentsForPlacement}명</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">사용 가능한 좌석:</span>
            <span className="font-medium">{availableSeatsForPlacement}개</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">비활성화된 좌석:</span>
            <span className="font-medium">{disabledSeats}개</span>
          </div>
        </div>
        {fixedStudentCount > 0 && (
          <div className="mt-3 text-xs text-purple-700 bg-purple-100 rounded px-2 py-1">
            💡 {fixedStudentCount}명의 학생이 고정되어 있어 배치 시 이동하지 않습니다
          </div>
        )}

        {!canPlaceAll && availableStudentsForPlacement > 0 && (
          <div className="mt-2 text-xs text-orange-700 bg-orange-100 rounded px-2 py-1">
            ⚠️ 배치할 학생({availableStudentsForPlacement}명)이 사용 가능한 좌석({availableSeatsForPlacement}개)보다 많습니다
          </div>
        )}

      {/* 고정 학생 관리 섹션 */}
        {fixedStudentCount > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-800 flex items-center gap-2">
                <Pin className="w-4 h-4 text-orange-500" />
                고정된 학생 ({fixedStudentCount}명)
              </h4>
              <button
                onClick={handleClearAllFixed}
                className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded transition-colors"
              >
                <PinOff className="w-4 h-4" />
                전체 해제
              </button>
            </div>
            
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {getFixedStudentsList().map((item: FixedStudentItem) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-orange-50 rounded px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.student.name}</span>
                    <span className="text-gray-500">({item.positionText})</span>
                    <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded">
                      {item.student.gender === 'male' ? '남' : '여'}
                    </span>
                  </div>
                  <button
                    onClick={() => dispatch({
                      type: 'REMOVE_FIXED_PLACEMENT',
                      payload: { row: item.position.row, col: item.position.col }
                    })}
                    className="text-red-500 hover:text-red-700 hover:bg-red-100 p-1 rounded transition-colors"
                    title="고정 해제"
                  >
                    <PinOff className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="mt-3 text-xs text-gray-600 bg-blue-50 rounded px-3 py-2">
              💡 고정된 학생들은 배치 실행 시 현재 위치에서 이동하지 않습니다.
            </div>
          </div>
        )}
      </div>

      {/* 진행률 표시 */}
      {placementProgress && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
              <span className="font-medium text-gray-900">배치 진행 중</span>
            </div>
            <span className="text-sm text-gray-500">
              {Math.round(placementProgress.progress)}%
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div 
              className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${placementProgress.progress}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{placementProgress.message}</span>
            {placementProgress.estimatedRemaining > 0 && (
              <span className="text-gray-500">
                약 {Math.round(placementProgress.estimatedRemaining / 1000)}초 남음
              </span>
            )}
          </div>
        </div>
      )}

      {/* 품질 메트릭 */}
      {qualityMetrics && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            성능 분석
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">배치 성공률:</span>
                <span className="font-medium">{qualityMetrics.placementRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">제약조건 준수:</span>
                <span className="font-medium">{qualityMetrics.constraintSatisfaction.toFixed(1)}%</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">실행 시간:</span>
                <span className="font-medium">{qualityMetrics.executionTime}ms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">종합 평가:</span>
                <span className={`font-medium ${getEfficiencyColor(qualityMetrics.efficiency)}`}>
                  {getEfficiencyLabel(qualityMetrics.efficiency)}
                </span>
              </div>
            </div>
          </div>
          
          {/* 품질 점수 바 */}
          <div className="mt-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700">품질 점수</span>
              <span className="text-sm font-bold text-gray-900">
                {qualityMetrics.qualityScore.toFixed(1)}/100
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  qualityMetrics.qualityScore >= 90 ? 'bg-green-500' :
                  qualityMetrics.qualityScore >= 75 ? 'bg-blue-500' :
                  qualityMetrics.qualityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${qualityMetrics.qualityScore}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 제약조건 상태 체크 */}
      {totalConstraints > 0 && (
        <div className={`border rounded-lg p-3 ${
          constraintCompatibility.isValid 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start gap-2">
            {constraintCompatibility.isValid ? (
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="text-sm">
              <div className={`font-medium ${
                constraintCompatibility.isValid ? 'text-green-900' : 'text-red-900'
              }`}>
                {constraintCompatibility.isValid 
                  ? `제약조건 ${totalConstraints}개 설정됨` 
                  : '제약조건 충돌 감지'
                }
              </div>
              {!constraintCompatibility.isValid && (
                <div className="mt-1 text-red-800">
                  {constraintCompatibility.conflicts.slice(0, 2).map((conflict, index) => (
                    <div key={index}>• {conflict}</div>
                  ))}
                  {constraintCompatibility.conflicts.length > 2 && (
                    <div>... 외 {constraintCompatibility.conflicts.length - 2}건 더</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 가용성 체크 */}
      {!canPlaceAll && state.students.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-700">
              <div className="font-medium">좌석 부족 경고</div>
              <div>학생 {state.students.length}명 &gt; 사용 가능한 좌석 {availableSeats.length}개</div>
            </div>
          </div>
        </div>
      )}

      {/* 알고리즘 선택 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            배치 알고리즘 선택
          </label>
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <Settings2 className="w-3 h-3" />
            {showAdvancedOptions ? '간단히 보기' : '고급 설정'}
          </button>
        </div>

        {/* 고급 옵션 - showAdvancedOptions가 true일 때만 표시 */}
        {showAdvancedOptions && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              고급 옵션
            </h4>
            
            {/* 제약조건 재시도 옵션 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enable-retry"
                  checked={enableRetry}
                  onChange={(e) => setEnableRetry(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="enable-retry" className="text-sm font-medium text-gray-700 cursor-pointer">
                  제약조건 위반 시 재시도 (최대 10회)
                </label>
              </div>
              
              {enableRetry && (
                <div className="ml-7 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                  <div className="font-medium mb-1">📢 재시도 기능 안내</div>
                  <div>• 제약조건을 위반하면 자동으로 재시도합니다</div>
                  <div>• 최대 10번까지 시도하여 최적의 결과를 찾습니다</div>
                  <div>• 완벽한 결과를 찾으면 조기 종료됩니다</div>
                </div>
              )}
            </div>

            {/* 적응형 랜덤 옵션 설정 */}
            {selectedAlgorithm.includes('adaptive_random') && showAdvancedOptions && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-medium text-purple-900 mb-3">🎲 적응형 랜덤 배치 설정</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      후보 생성 수: {adaptiveRandomOptions.generateMultiple}개
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={adaptiveRandomOptions.generateMultiple}
                      onChange={(e) => setAdaptiveRandomOptions(prev => ({ 
                        ...prev, 
                        generateMultiple: parseInt(e.target.value) 
                      }))}
                      className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1개 (빠름)</span>
                      <span>5개 (균형)</span>
                      <span>10개 (최고품질)</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      여러 배치 후보를 생성한 후 가장 좋은 결과를 선택합니다
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      시드 값: {adaptiveRandomOptions.seed === 0 ? '랜덤' : adaptiveRandomOptions.seed}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="9999"
                      step="1"
                      value={adaptiveRandomOptions.seed}
                      onChange={(e) => setAdaptiveRandomOptions(prev => ({ 
                        ...prev, 
                        seed: parseInt(e.target.value) 
                      }))}
                      className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0 (랜덤)</span>
                      <span>5000</span>
                      <span>9999 (고정)</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      0이면 매번 다른 결과, 고정값이면 항상 같은 결과를 얻습니다
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 재시도 진행 상황 표시 */}
        {retryProgress && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <Shuffle className="w-4 h-4 animate-spin" />
              <span className="font-medium">재시도 중...</span>
            </div>
            <div className="text-sm text-yellow-700 mt-1">
              시도 {retryProgress.attempt}/{retryProgress.maxAttempts} - 더 나은 배치를 찾는 중입니다
            </div>
            <div className="w-full bg-yellow-200 rounded-full h-2 mt-2">
              <div 
                className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(retryProgress.attempt / retryProgress.maxAttempts) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* 알고리즘 목록 */}
        <div className="space-y-2">
          {ALGORITHM_OPTIONS.map(algorithm => {
            const availability = getAlgorithmAvailability(algorithm);
            const Icon = algorithm.icon;
            const isRecommended = recommendedAlgorithms.includes(algorithm.id);
            
            return (
              <div
                key={algorithm.id}
                className={`border rounded-lg p-3 transition-all ${
                  selectedAlgorithm === algorithm.id
                    ? 'border-blue-500 bg-blue-50'
                    : availability.available
                    ? 'border-gray-200 hover:border-gray-300'
                    : 'border-gray-100 bg-gray-50'
                } ${!availability.available ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    id={algorithm.id}
                    name="algorithm"
                    value={algorithm.id}
                    checked={selectedAlgorithm === algorithm.id}
                    onChange={(e) => setSelectedAlgorithm(e.target.value as AlgorithmType)}
                    disabled={!availability.available}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${algorithm.color}`} />
                      <label 
                        htmlFor={algorithm.id} 
                        className={`font-medium cursor-pointer ${
                          availability.available ? 'text-gray-900' : 'text-gray-500'
                        }`}
                      >
                        {algorithm.name}
                      </label>
                      {algorithm.isNew && (
                        <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full">
                          NEW
                        </span>
                      )}
                      {isRecommended && !algorithm.isNew && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                          추천
                        </span>
                      )}
                      {algorithm.isRecommended && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                          ⭐ 최고
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-2">
                      {algorithm.description}
                    </p>
                    
                    {showAdvancedOptions && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className="text-gray-500">시간:</span>
                            <span className={`px-2 py-0.5 rounded-full ${getComplexityBadge(algorithm.timeComplexity)}`}>
                              {algorithm.timeComplexity}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Target className="w-3 h-3 text-gray-400" />
                            <span className="text-gray-500">정확도:</span>
                            <span className={`px-2 py-0.5 rounded-full ${getAccuracyBadge(algorithm.accuracy)}`}>
                              {algorithm.accuracy}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">적합한 상황:</span> {algorithm.bestFor.join(', ')}
                        </div>
                      </div>
                    )}
                    
                    {!availability.available && (
                      <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {availability.reason}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedAlgorithm === 'gender' && (
        <div className="mt-4 p-4 bg-pink-50 border border-pink-200 rounded-lg">
          <h4 className="font-medium text-pink-900 mb-2">👫 남녀 짝 배치 설정</h4>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-pink-800">
              짝으로 배치할 남녀 쌍 수:
            </label>
            <input
              type="number"
              min="0"
              max={Math.min(
                state.students.filter(s => s.gender === 'male').length,
                state.students.filter(s => s.gender === 'female').length
              )}
              value={pairCount}
              onChange={(e) => setPairCount(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 px-2 py-1 border border-pink-300 rounded text-center"
            />
            <span className="text-xs text-pink-600">
              (최대 {Math.min(
                state.students.filter(s => s.gender === 'male').length,
                state.students.filter(s => s.gender === 'female').length
              )}쌍)
            </span>
          </div>
          <p className="text-xs text-pink-700 mt-2">
            • {pairCount}쌍({pairCount * 2}명)의 남녀가 짝으로 배치됩니다<br/>
            • 나머지 {state.students.length - (pairCount * 2)}명은 랜덤 배치됩니다<br/>
            • 기존 좌석 성별 제약은 초기화됩니다
          </p>
        </div>
      )}

      {/* 실행 버튼들 */}
      <div className="space-y-3">
        <Button
          variant="primary"
          size="lg"
          onClick={handleGeneratePlacement}
          disabled={isGenerating || state.students.length === 0}
          loading={isGenerating}
          icon={getSelectedAlgorithmIcon(selectedAlgorithm)}
          className={`w-full`}
        >
          {getSelectedAlgorithmName(selectedAlgorithm)}
        </Button>
        
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={handleResetPlacement}
            disabled={placedStudents === 0}
            icon={RotateCcw}
          >
            배치 초기화
          </Button>
          
          <Button
            variant="outline"
            onClick={handleValidatePlacement}
            disabled={placedStudents === 0}
            icon={CheckCircle}
          >
            배치 검증
          </Button>
        </div>
      </div>

      {/* 배치 결과 정보 */}
      {lastResult && (
        <div className={`border rounded-lg p-4 ${
          lastResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <h4 className={`font-medium mb-2 flex items-center gap-2 ${
            lastResult.success ? 'text-green-900' : 'text-red-900'
          }`}>
            {lastResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            배치 결과
          </h4>
          {/* 재시도 정보 표시 */}
          {enableRetry && lastResult.message && lastResult.message.includes('재시도') && (
            <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
              <div className="font-medium text-blue-800 flex items-center gap-1">
                <Shuffle className="w-3 h-3" />
                재시도 완료
              </div>
              <div className="text-blue-700">여러 시도 중 가장 좋은 결과를 선택했습니다</div>
            </div>
          )}
          {/* 배치 결과 */}
          <div className={`text-sm space-y-1 ${
            lastResult.success ? 'text-green-800' : 'text-red-800'
          }`}>
            <div>• {lastResult.message}</div>
            
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>실행 시간:</span>
                  <span className="font-medium">{lastResult.duration}ms</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>사용 알고리즘:</span>
                  <span className="font-medium">
                    {ALGORITHM_OPTIONS.find(a => a.id === lastResult.algorithm)?.name?.replace(/^[🎯🚀🤖⚡🔍🔄🧠👫🎲]+\s/, '') || lastResult.algorithm}
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>배치율:</span>
                  <span className="font-medium">
                    {lastResult.stats.placedStudents > 0 
                      ? ((lastResult.stats.placedStudents / state.students.length) * 100).toFixed(1)
                      : '0'
                    }%
                  </span>
                </div>
                {totalConstraints > 0 && (
                  <div className="flex justify-between text-xs">
                    <span>제약조건 준수율:</span>
                    <span className="font-medium">
                      {totalConstraints > 0 
                        ? (((totalConstraints - lastResult.stats.constraintViolations) / totalConstraints) * 100).toFixed(1)
                        : '100'
                      }%
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {lastResult.stats && (
              <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span>배치됨:</span>
                    <span className="font-medium">{lastResult.stats.placedStudents}명</span>
                  </div>
                  {lastResult.stats.unplacedStudents > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>미배치:</span>
                      <span className="font-medium">{lastResult.stats.unplacedStudents}명</span>
                    </div>
                  )}
                  {lastResult.stats.constraintViolations > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>제약조건 위반:</span>
                      <span className="font-medium">{lastResult.stats.constraintViolations}건</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>사용 가능 좌석:</span>
                    <span className="font-medium">{lastResult.stats.availableSeats}개</span>
                  </div>
                </div>
              </div>
            )}
            
            {lastResult && lastResult.violations && lastResult.violations.length > 0 && (
              <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                <div className="font-medium text-orange-800 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  주의사항:
                </div>
                {lastResult.violations.slice(0, 2).map((violation: any, index: number) => (
                  <div key={index} className="text-orange-700">• {violation.message}</div>
                ))}
                {lastResult.violations.length > 2 && (
                  <div className="text-orange-700">... 외 {lastResult.violations.length - 2}건 더</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 현재 상태 정보 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">현재 상태</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span>총 학생: {state.students.length}명</span>
          </div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-green-500" />
            <span>배치됨: {placedStudents}명</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span>사용 가능: {availableSeats.length}개</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-300 rounded disabled-seat-pattern"></div>
            <span>사용 안함: {disabledSeats}개</span>
          </div>
          {totalConstraints > 0 && (
            <>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" />
                <span>제약조건: {totalConstraints}개</span>
              </div>
              <div className="flex items-center gap-2">
                {constraintCompatibility.isValid ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
                <span>상태: {constraintCompatibility.isValid ? '정상' : '충돌'}</span>
              </div>
            </>
          )}
          {showAdvanced && state.constraints.rowExclusions.length > 0 && (
            <div className="flex items-center gap-2">
              <Rows className="w-4 h-4 text-purple-500" />
              <span>줄 제외: {state.constraints.rowExclusions.length}개</span>
            </div>
          )}
        </div>
        
        {/* 추가 정보 */}
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-1 text-xs text-gray-600">
          {state.classroom.seatGenderConstraints.length > 0 && (
            <div>성별 제약 좌석: {state.classroom.seatGenderConstraints.length}개</div>
          )}
          {state.classroom.pairColumns.length > 0 && (
            <div>짝 구성: {state.classroom.pairColumns.length}쌍</div>
          )}
          <div>배치 가능 여부: {canPlaceAll ? '✅ 모든 학생 배치 가능' : '❌ 좌석 부족'}</div>
          {placedStudents > 0 && (
            <div>
              현재 배치율: {((placedStudents / Math.max(state.students.length, 1)) * 100).toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      {/* 알고리즘 선택 가이드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">🧭 알고리즘 선택 가이드</h4>
        <div className="text-sm text-blue-800 space-y-1">
          {fixedStudentCount > 0 && (
            <div className="font-medium text-orange-700 mb-2">
              📌 {fixedStudentCount}명이 고정됨 → {availableStudentsForPlacement}명 대상 배치
            </div>
          )}
          {totalConstraints === 0 && (
            <div className="font-medium text-green-700">💡 제약조건이 없습니다 → 성별 구분 또는 적응형 랜덤 추천</div>
          )}
          {totalConstraints === 0 && (
            <div className="font-medium text-green-700">💡 제약조건이 없습니다 → 성별 구분 또는 적응형 랜덤 추천</div>
          )}
          {totalConstraints > 0 && totalConstraints < 5 && (
            <div className="font-medium text-blue-700">💡 제약조건이 적습니다 → 적응형 랜덤(창의적) 추천</div>
          )}
          {totalConstraints >= 5 && (
            <div className="font-medium text-orange-700">💡 복잡한 제약조건 → 적응형 랜덤(균형) 또는 (미묘) 추천</div>
          )}
          <div className="text-xs mt-2 pt-2 border-t border-blue-200">
            <strong>⭐ 추천:</strong> 기본적인 상황에서는 적응형 랜덤(창의적)을 추천합니다. 
            남녀 짝 배치가 필요한 경우 남녀 구분 알고리즘을 사용하세요.
          </div>
        </div>
      </div>

      {/* 알고리즘 소개 */}
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-lg p-4">
        <h4 className="font-medium text-pink-900 mb-2">🎲 알고리즘 소개</h4>
        <div className="text-sm text-pink-800 space-y-2">
          <p>
            <strong>적응형 랜덤:</strong> 제약조건을 지키면서도 예측 불가능한 흥미로운 배치를 생성합니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div>🎯 <strong>미묘한 랜덤성:</strong> 안정적이면서 약간의 변화</div>
            <div>⚖️ <strong>균형잡힌 랜덤성:</strong> 최적의 랜덤성 비율</div>
            <div>🎨 <strong>창의적 랜덤성:</strong> 다양하고 창의적인 패턴</div>
            <div>🌪️ <strong>와일드 랜덤성:</strong> 완전히 예측 불가능한 배치</div>
          </div>
          <p>
            <strong>남녀 구분 알고리즘:</strong> 지정된 수의 남녀 쌍을 우선 배치하고, 나머지는 랜덤으로 배치합니다.
          </p>
        </div>
      </div>
    </div>
  );
};