//src/components/placement/PlacementControls.tsx
import React, { useState, useEffect } from 'react';
import { 
  Shuffle, RotateCcw, Users, UserCheck, AlertTriangle, CheckCircle, 
  Zap, Target, Cpu, Layers, Gauge, Rocket, Brain, Settings2,
  Clock, TrendingUp, Activity, Sparkles, Rows
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useAppContext } from '@/context/AppContext';
import { 
  generateGenderBalancedPlacement, 
  getAvailableSeats,
  validateSeatingArrangement
} from '@/utils/seatingAlgorithm';
import { generateAdvancedHeuristicPlacement } from '@/utils/advancedBacktrackingAlgorithm';
import { generateAdaptiveRandomPlacement } from '@/utils/adaptiveRandomHeuristics';
import { generateBacktrackingPlacement } from '@/utils/backtrackingAlgorithm';
import { validateConstraintCompatibility } from '@/utils/constraintValidator';

type AlgorithmType = 
  | 'advanced_heuristic' // 고급 휴리스틱
  | 'backtrack'          // 백트래킹
  | 'gender'            // 남녀 구분
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

const getSelectedAlgorithmIcon = (selectedAlgorithm: AlgorithmType) => {
  const algorithm = ALGORITHM_OPTIONS.find(a => a.id === selectedAlgorithm);
  if (algorithm) {
    return algorithm.icon;
  }
  
  // 기본값 반환
  switch (selectedAlgorithm) {
    case 'advanced_heuristic': return Target;
    case 'backtrack': return Cpu;
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
    case 'advanced_heuristic': return '🎯 고급 휴리스틱';
    case 'backtrack': return '🔄 백트래킹';
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
    id: 'advanced_heuristic',
    name: '🎯 고급 휴리스틱',
    description: 'MRV, Degree, Forward Checking 등 고급 기법 활용',
    icon: Target as typeof Target,
    color: 'text-blue-600',
    timeComplexity: 'MEDIUM',
    accuracy: 'HIGH',
    bestFor: ['복잡한 제약조건', '중간 규모', '높은 정확도'],
    minConstraints: 3,
    maxStudents: 50,
    isRecommended: true,
  },
  {
    id: 'backtrack',
    name: '🔄 백트래킹',
    description: '체계적인 탐색으로 최적해를 찾는 전통적 방법',
    icon: Cpu as typeof Cpu,
    color: 'text-orange-600',
    timeComplexity: 'VERY_HIGH',
    accuracy: 'HIGH',
    bestFor: ['소규모', '완벽한 해 필요', '시간 여유'],
    maxStudents: 25,
  },
  {
    id: 'gender',
    name: '👫 남녀 구분',
    description: '남녀 성비를 고려한 균형 잡힌 배치',
    icon: Users as typeof Users,
    color: 'text-pink-600',
    timeComplexity: 'LOW',
    accuracy: 'MEDIUM',
    bestFor: ['성별 균형', '전통적 배치', '단순한 규칙'],
    isRecommended: true,
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
    isNew: true,
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
    isNew: true,
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
    isNew: true,
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
    isNew: true,
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
  const [hybridOptions, setHybridOptions] = useState({
    timeLimit: 30000,
    qualityTarget: 90,
    adaptiveStrategy: true,
  });
  const [adaptiveRandomOptions, setAdaptiveRandomOptions] = useState({
    generateMultiple: 3,  // 여러 후보 중 최고 선택
    seed: 0,             // 시드 값 (0이면 랜덤)
    customRandomness: 50, // 커스텀 랜덤성 (0-100)
  });

  // 통계 계산
  const availableSeats = getAvailableSeats(state.classroom);
  const totalSeats = state.classroom.rows * state.classroom.cols;
  const disabledSeats = totalSeats - availableSeats.length;
  const placedStudents = Object.keys(state.currentSeating).length;
  const canPlaceAll = state.students.length <= availableSeats.length;

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
    recommendations.push('advanced_heuristic', 'adaptive_random_balanced'); 
    
    // 제약조건 수에 따른 추천
    if (totalConstraints === 0) {
      recommendations.push('gender', 'adaptive_random_wild');
    } else if (totalConstraints < 3) {
      recommendations.push('adaptive_random_creative');
    } else {
      recommendations.push('backtrack');
    }
    
    return [...new Set(recommendations)];
  };

  const recommendedAlgorithms = getRecommendedAlgorithms();

  // 알고리즘 필터링 (조건에 맞지 않는 것들 비활성화)
  const getAlgorithmAvailability = (algorithm: AlgorithmOption): {
    available: boolean;
    reason?: string;
  } => {
    if (algorithm.minConstraints && totalConstraints < algorithm.minConstraints) {
      return {
        available: false,
        reason: `최소 ${algorithm.minConstraints}개의 제약조건 필요`
      };
    }
    
    if (algorithm.maxStudents && state.students.length > algorithm.maxStudents) {
      return {
        available: false,
        reason: `${algorithm.maxStudents}명 이하에서 권장`
      };
    }
    
    return { available: true };
  };

  const handleGeneratePlacement = async () => {
    if (state.students.length === 0) {
      alert('배치할 학생이 없습니다.');
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
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      await new Promise(resolve => setTimeout(resolve, 300));

      let result;
      console.log(`🎯 선택된 알고리즘: ${selectedAlgorithm}`);
      
      const startTime = Date.now();
      
      switch (selectedAlgorithm) {
        case 'advanced_heuristic':
          result = await generateAdvancedHeuristicPlacement(state.students, state.classroom, state.constraints);
          break;
        case 'backtrack':
          result = await generateBacktrackingPlacement(state.students, state.classroom, state.constraints);
          break;
        case 'gender':
          result = await generateGenderBalancedPlacement(state.students, state.classroom, state.constraints);
          break;
        case 'adaptive_random_subtle':
          result = await generateAdaptiveRandomPlacement(
            state.students, 
            state.classroom, 
            state.constraints,
            { 
              preset: 'subtle',
              generateMultiple: adaptiveRandomOptions.generateMultiple,
              seed: adaptiveRandomOptions.seed || undefined
            }
          );
          break;
          
        case 'adaptive_random_balanced':
          result = await generateAdaptiveRandomPlacement(
            state.students, 
            state.classroom, 
            state.constraints,
            { 
              preset: 'balanced',
              generateMultiple: adaptiveRandomOptions.generateMultiple,
              seed: adaptiveRandomOptions.seed || undefined
            }
          );
          break;
          
        case 'adaptive_random_creative':
          result = await generateAdaptiveRandomPlacement(
            state.students, 
            state.classroom, 
            state.constraints,
            { 
              preset: 'creative',
              generateMultiple: adaptiveRandomOptions.generateMultiple,
              seed: adaptiveRandomOptions.seed || undefined
            }
          );
          break;
          
        case 'adaptive_random_wild':
          result = await generateAdaptiveRandomPlacement(
            state.students, 
            state.classroom, 
            state.constraints,
            { 
              preset: 'wild',
              generateMultiple: adaptiveRandomOptions.generateMultiple,
              seed: adaptiveRandomOptions.seed || undefined
            }
          );
          break;

        default:
          result = await generateAdaptiveRandomPlacement(
            state.students, 
            state.classroom, 
            state.constraints,
            { 
              preset: 'balanced',
              generateMultiple: adaptiveRandomOptions.generateMultiple,
              seed: adaptiveRandomOptions.seed || undefined
            }
          );
      }

      const duration = Date.now() - startTime;

      // 품질 메트릭 계산
      const placementRate = (result.stats.placedStudents / state.students.length) * 100;
      const constraintSatisfaction = totalConstraints > 0 ? 
        ((totalConstraints - result.stats.constraintViolations) / totalConstraints) * 100 : 100;
      
      const qualityScore = (placementRate * 0.4 + constraintSatisfaction * 0.4 + 
        Math.max(0, 100 - duration / 100) * 0.2);

      let efficiency: QualityMetrics['efficiency'] = 'excellent';
      if (qualityScore < 60) efficiency = 'poor';
      else if (qualityScore < 75) efficiency = 'fair';
      else if (qualityScore < 90) efficiency = 'good';

      setQualityMetrics({
        placementRate,
        constraintSatisfaction,
        executionTime: duration,
        qualityScore,
        efficiency
      });

      if (result.success) {
        dispatch({ type: 'SET_SEATING', payload: result.seating });
        
        // 배치 완료 후 학생 목록을 번호순으로 정렬
        const sortedStudents = [...state.students].sort((a, b) => {
          // 번호가 있는 학생들을 먼저 정렬
          if (a.number && b.number) return a.number - b.number;
          if (a.number && !b.number) return -1;
          if (!a.number && b.number) return 1;
          // 번호가 없는 학생들은 이름순으로 정렬
          return a.name.localeCompare(b.name);
        });

        dispatch({ type: 'SET_STUDENTS', payload: sortedStudents });

        setLastResult({
          ...result,
          duration,
          algorithm: selectedAlgorithm
        });
        
        // 결과 메시지 생성
        let message = result.message;
        if (result.stats.unplacedStudents > 0) {
          message += `\n\n⚠️ ${result.stats.unplacedStudents}명이 배치되지 않았습니다.`;
        }
        if (result.violations && result.violations.length > 0) {
          const showAdvanced = localStorage.getItem('constraints_show_advanced') === 'true';
          let filteredViolations = result.violations;
          
          if (!showAdvanced) {
            // 거리 유지와 줄 제외 위반 필터링
            filteredViolations = result.violations.filter((v: any) => 
              v.type !== 'distance' && v.type !== 'row_exclusion'
            );
            
            // 고급 제약조건 위반이 있었다면 일반적인 메시지로 대체
            const hasAdvancedViolations = result.violations.some((v: any) => 
              v.type === 'distance' || v.type === 'row_exclusion'
            );
            
            if (hasAdvancedViolations && filteredViolations.length === 0) {
              // 고급 제약조건만 위반된 경우
              if (confirm('일부 조건을 만족하지 못했습니다.\n다시 배치를 시도하시겠습니까?')) {
                // 재시도 로직은 여기에 추가 가능
              }
              return;
            } else if (hasAdvancedViolations) {
              // 기본 + 고급 제약조건 모두 위반된 경우
              message += '\n\n일부 조건을 만족하지 못했습니다.';
            }
          }
          
          // 필터링된 위반 사항 표시
          if (filteredViolations.length > 0) {
            message += `\n\n제약조건 위반:\n${filteredViolations.slice(0, 3).map((v: any) => v.message).join('\n')}`;
            if (filteredViolations.length > 3) {
              message += `\n... 외 ${filteredViolations.length - 3}건 더`;
            }
          }
        }
        
        // 성공적으로 모든 학생이 배치된 경우
        if (result.stats.unplacedStudents === 0 && (!result.violations || result.violations.length === 0)) {
          message += '\n\n🎉 모든 학생이 제약조건을 만족하며 성공적으로 배치되었습니다!';
        }
        
        alert(message);
      } else {
        alert(`배치 실패: ${result.message}`);
        setLastResult(result);
      }
    } catch (error) {
      console.error('배치 생성 오류:', error);
      // 오류 발생 시 기본 알고리즘으로 폴백
      if (selectedAlgorithm !== 'advanced_heuristic') {
        console.log('🔄 고급 휴리스틱으로 폴백');
        return generateAdvancedHeuristicPlacement(state.students, state.classroom, state.constraints);
      }
    } finally {
      setIsGenerating(false);
      setPlacementProgress(null);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">배치 실행</h3>
        <div className="text-sm text-gray-500">
          {placedStudents}/{state.students.length}명 배치됨
        </div>
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
            
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <h5 className="text-sm font-medium text-yellow-900 mb-1">💡 랜덤성 모드 설명</h5>
              <div className="text-xs text-yellow-800 space-y-1">
                <div><strong>미묘:</strong> 95% 휴리스틱 + 5% 랜덤 (안정적)</div>
                <div><strong>균형:</strong> 70% 휴리스틱 + 30% 랜덤 (추천)</div>
                <div><strong>창의적:</strong> 50% 휴리스틱 + 50% 랜덤 (다양함)</div>
                <div><strong>와일드:</strong> 20% 휴리스틱 + 80% 랜덤 (파격적)</div>
              </div>
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
        
        {/* 추천 알고리즘 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm font-medium text-blue-900 mb-2">💡 상황별 추천</div>
          <div className="flex flex-wrap gap-2">
            {recommendedAlgorithms.slice(0, 3).map(algId => {
              const alg = ALGORITHM_OPTIONS.find(a => a.id === algId);
              if (!alg) return null;
              return (
                <button
                  key={algId}
                  onClick={() => setSelectedAlgorithm(algId)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    selectedAlgorithm === algId
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                  }`}
                >
                  {alg.name}
                </button>
              );
            })}
          </div>
        </div>

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

      {/* 배치 결과 정보 (개선됨) */}
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
            
            {lastResult.violations && lastResult.violations.length > 0 && (
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
          {totalConstraints === 0 && (
            <div className="font-medium text-green-700">💡 제약조건이 없습니다 → 성별 구분 또는 적응형 랜덤 추천</div>
          )}
          {totalConstraints > 0 && totalConstraints < 3 && (
            <div className="font-medium text-blue-700">💡 간단한 제약조건 → 고급 휴리스틱 추천</div>
          )}
          {totalConstraints >= 3 && (
            <div className="font-medium text-red-700">💡 복잡한 제약조건 → 백트래킹 추천</div>
          )}
          <div className="text-xs mt-2 pt-2 border-t border-blue-200">
            <strong>⭐ 추천:</strong> 기본적인 상황에서는 적응형 랜덤(창의적)을 추천합니다. 
          </div>
        </div>
      </div>

      {/* 적응형 랜덤 알고리즘 소개 */}
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-lg p-4">
        <h4 className="font-medium text-pink-900 mb-2">🎲 새로운 적응형 랜덤 알고리즘</h4>
        <div className="text-sm text-pink-800 space-y-2">
          <p>
            <strong>혁신적인 랜덤성:</strong> 제약조건을 지키면서도 예측 불가능한 흥미로운 배치를 생성합니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div>🎯 <strong>미묘한 랜덤성:</strong> 안정적이면서 약간의 변화</div>
            <div>⚖️ <strong>균형잡힌 랜덤성:</strong> 최적의 랜덤성 비율</div>
            <div>🎨 <strong>창의적 랜덤성:</strong> 다양하고 창의적인 패턴</div>
            <div>🌪️ <strong>와일드 랜덤성:</strong> 완전히 예측 불가능한 배치</div>
          </div>
          <div className="bg-white bg-opacity-50 rounded p-2 text-xs">
            <strong>💡 언제 사용할까요?</strong> 기존 패턴에서 벗어나고 싶을 때, 학생들에게 새로운 경험을 주고 싶을 때, 
            또는 단순히 재미있는 배치를 원할 때 사용하세요!
          </div>
        </div>
      </div>
    </div>
  );
};