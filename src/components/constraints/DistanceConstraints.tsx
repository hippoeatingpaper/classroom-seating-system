//src/components/constraints/DistanceConstraints.tsx
import React from 'react';
import { Trash2, MapPin, AlertCircle, Eye, Edit3 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { DistanceConstraint, Student } from '@/types';
import { useAppContext } from '@/context/AppContext';
import { getStudentsDistance } from '@/utils/constraintValidator';

interface DistanceConstraintsProps {
  constraints: DistanceConstraint[];
  students: Student[];
}

export const DistanceConstraints: React.FC<DistanceConstraintsProps> = ({
  constraints,
  students,
}) => {
  const { state, dispatch } = useAppContext();

  const handleRemove = (constraintId: string) => {
    const constraint = constraints.find(c => c.id === constraintId);
    if (!constraint) return;

    const student1 = students.find(s => s.id === constraint.students[0]);
    const student2 = students.find(s => s.id === constraint.students[1]);
    
    if (confirm(`${student1?.name}과 ${student2?.name}의 거리 유지 제약조건을 삭제하시겠습니까?`)) {
      dispatch({ type: 'REMOVE_DISTANCE_CONSTRAINT', payload: constraintId });
    }
  };

  const handleUpdateDistance = (constraintId: string, currentDistance: number) => {
    const newDistance = prompt(
      `새로운 최소 거리를 입력하세요 (현재: ${currentDistance}칸):`,
      currentDistance.toString()
    );
    
    if (newDistance !== null) {
      const distance = parseInt(newDistance);
      if (distance >= 1 && distance <= 10) {
        dispatch({ 
          type: 'UPDATE_DISTANCE_CONSTRAINT', 
          payload: { id: constraintId, distance } 
        });
      } else {
        alert('거리는 1~10 범위 내에서 설정해주세요.');
      }
    }
  };

  const getStudentName = (studentId: string): string => {
    const student = students.find(s => s.id === studentId);
    return student?.name || '(삭제된 학생)';
  };

  const getStudentGender = (studentId: string): 'male' | 'female' | null => {
    const student = students.find(s => s.id === studentId);
    return student?.gender || null;
  };

  const getConstraintStatus = (constraint: DistanceConstraint): {
    status: 'satisfied' | 'violated' | 'pending';
    message: string;
    color: string;
    currentDistance: number | null; // 선택적이 아닌 필수 속성으로 변경
  } => {
    const [student1Id, student2Id] = constraint.students;
    const student1Placed = Object.values(state.currentSeating).includes(student1Id);
    const student2Placed = Object.values(state.currentSeating).includes(student2Id);
    
    if (!student1Placed || !student2Placed) {
      return {
        status: 'pending',
        message: '배치 대기 중',
        color: 'text-gray-500',
        currentDistance: null // null 값 명시적으로 반환
      };
    }

    const currentDistance = getStudentsDistance(student1Id, student2Id, state.currentSeating);
    
    if (currentDistance === null) {
      return {
        status: 'pending',
        message: '거리 계산 불가',
        color: 'text-gray-500',
        currentDistance: null // null 값 명시적으로 반환
      };
    }

    if (currentDistance >= constraint.minDistance) {
      return {
        status: 'satisfied',
        message: `거리 ${currentDistance}칸 (충족)`,
        color: 'text-green-600',
        currentDistance
      };
    } else {
      return {
        status: 'violated',
        message: `거리 ${currentDistance}칸 (부족)`,
        color: 'text-red-600',
        currentDistance
      };
    }
  };

  const isConstraintViolated = (constraint: DistanceConstraint): boolean => {
    const status = getConstraintStatus(constraint);
    return status.status === 'violated';
  };

  const highlightStudents = (constraint: DistanceConstraint) => {
    // UI에서 해당 학생들을 하이라이트하는 기능
    dispatch({
      type: 'SET_UI_STATE',
      payload: { selectedStudents: constraint.students }
    });
    
    // 3초 후 하이라이트 해제
    setTimeout(() => {
      dispatch({
        type: 'SET_UI_STATE',
        payload: { selectedStudents: [] }
      });
    }, 3000);
  };

  const getDistanceDescription = (distance: number): string => {
    if (distance === 1) return '인접하지 않도록';
    if (distance === 2) return '1칸 이상 떨어뜨려';
    if (distance === 3) return '2칸 이상 떨어뜨려';
    return `${distance - 1}칸 이상 떨어뜨려`;
  };

  if (constraints.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>설정된 거리 유지 제약조건이 없습니다.</p>
        <p className="text-sm mt-1">위의 추가 버튼을 클릭하여 제약조건을 설정해보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {constraints.map((constraint) => {
        const student1Name = getStudentName(constraint.students[0]);
        const student2Name = getStudentName(constraint.students[1]);
        const student1Gender = getStudentGender(constraint.students[0]);
        const student2Gender = getStudentGender(constraint.students[1]);
        const status = getConstraintStatus(constraint);
        const isViolated = isConstraintViolated(constraint);

        return (
          <div
            key={constraint.id}
            className={`p-4 border rounded-lg transition-all ${
              isViolated 
                ? 'border-red-200 bg-red-50' 
                : 'border-gray-200 bg-white hover:shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* 학생 정보 */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{student1Name}</span>
                    {student1Gender && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        student1Gender === 'male' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-pink-100 text-pink-800'
                      }`}>
                        {student1Gender === 'male' ? '♂' : '♀'}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-orange-600" />
                    <span className="text-sm text-gray-600">
                      {constraint.minDistance}칸 이상
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{student2Name}</span>
                    {student2Gender && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        student2Gender === 'male' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-pink-100 text-pink-800'
                      }`}>
                        {student2Gender === 'male' ? '♂' : '♀'}
                      </span>
                    )}
                  </div>
                </div>

                {/* 상태 표시 */}
                <div className="flex items-center gap-2 text-sm">
                  <span className={`font-medium ${status.color}`}>
                    {status.message}
                  </span>
                  {isViolated && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>

                {/* 제약조건 설명 */}
                <div className="text-xs text-gray-500 mt-1">
                  {getDistanceDescription(constraint.minDistance)} 배치
                  {constraint.createdAt && (
                    <span className="ml-2">
                      • 생성: {new Date(constraint.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* 거리 시각화 */}
                {status.currentDistance !== null && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">필요:</span>
                      <div className="flex gap-1">
                        {Array.from({ length: constraint.minDistance }, (_, i) => (
                          <div 
                            key={i} 
                            className="w-2 h-2 bg-orange-300 rounded-full"
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">{constraint.minDistance}칸</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">현재:</span>
                      <div className="flex gap-1">
                        {Array.from({ length: Math.max(status.currentDistance, 1) }, (_, i) => (
                          <div 
                            key={i} 
                            className={`w-2 h-2 rounded-full ${
                              (i < constraint.minDistance) && status.currentDistance 
                                ? (status.currentDistance >= constraint.minDistance ? 'bg-green-400' : 'bg-red-400')
                                : 'bg-green-400'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">{status.currentDistance}칸</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 액션 버튼들 */}
              <div className="flex items-center gap-1 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => highlightStudents(constraint)}
                  className="p-1 border-none hover:bg-blue-50 text-blue-600"
                  title="좌석에서 강조 표시"
                >
                  <Eye className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateDistance(constraint.id, constraint.minDistance)}
                  className="p-1 border-none hover:bg-orange-50 text-orange-600"
                  title="거리 수정"
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemove(constraint.id)}
                  className="p-1 border-none hover:bg-red-50 text-red-600"
                  title="제약조건 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {/* 위반 사항 요약 */}
      {constraints.some(isConstraintViolated) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <div className="font-medium">거리 유지 제약조건 위반</div>
              <div className="mt-1">
                {constraints.filter(isConstraintViolated).length}개의 제약조건이 현재 배치에서 위반되고 있습니다.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 거리 설정 가이드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h4 className="font-medium text-blue-900 mb-2">💡 거리 설정 가이드</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <div>• <strong>1칸</strong>: 인접하지 않도록 (대각선 포함)</div>
          <div>• <strong>2칸</strong>: 1명 이상이 사이에 있도록</div>
          <div>• <strong>3칸</strong>: 2명 이상이 사이에 있도록</div>
          <div>• 거리가 클수록 배치가 어려워질 수 있습니다</div>
        </div>
      </div>
    </div>
  );
};