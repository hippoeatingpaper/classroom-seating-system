//src/components/constraints/PairConstraints.tsx
import React from 'react';
import { Trash2, Users, UserX, AlertCircle, Eye } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { PairConstraint, Student } from '@/types';
import { useAppContext } from '@/context/AppContext';
import { areStudentsPaired } from '@/utils/constraintValidator';

interface PairConstraintsProps {
  type: 'required' | 'prohibited';
  constraints: PairConstraint[];
  students: Student[];
}

export const PairConstraints: React.FC<PairConstraintsProps> = ({
  type,
  constraints,
  students,
}) => {
  const { state, dispatch } = useAppContext();

  // 핸들러 삭제
  const handleRemove = (constraintId: string) => {
    const constraint = constraints.find(c => c.id === constraintId);
    if (!constraint) return;

    const student1 = students.find(s => s.id === constraint.students[0]);
    const student2 = students.find(s => s.id === constraint.students[1]);
    const actionText = type === 'required' ? '짝 강제' : '짝 방지';
    
    if (confirm(`${student1?.name}과 ${student2?.name}의 ${actionText} 제약조건을 삭제하시겠습니까?`)) {
      dispatch({ type: 'REMOVE_PAIR_CONSTRAINT', payload: constraintId });
    }
  };

  // 일괄 삭제 핸들러 함수
  const handleClearAllProhibited = () => {
    if (type !== 'prohibited') return;
    
    const confirmMessage = `모든 짝 방지 제약조건(${constraints.length}개)을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`;
    
    if (confirm(confirmMessage)) {
      // 모든 짝 방지 제약조건 삭제
      constraints.forEach(constraint => {
        dispatch({ type: 'REMOVE_PAIR_CONSTRAINT', payload: constraint.id });
      });
      
      // 성공 메시지 (선택사항)
      setTimeout(() => {
        alert(`${constraints.length}개의 짝 방지 제약조건이 삭제되었습니다.`);
      }, 100);
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

  const isConstraintViolated = (constraint: PairConstraint): boolean => {
    const [student1Id, student2Id] = constraint.students;
    const isPaired = areStudentsPaired(student1Id, student2Id, state.currentSeating);
    
    if (type === 'required') {
      // 짝 강제: 둘 다 배치되어 있는데 짝이 아니면 위반
      const student1Placed = Object.values(state.currentSeating).includes(student1Id);
      const student2Placed = Object.values(state.currentSeating).includes(student2Id);
      return student1Placed && student2Placed && !isPaired;
    } else {
      // 짝 방지: 둘이 짝으로 배치되어 있으면 위반
      return isPaired;
    }
  };

  const getConstraintStatus = (constraint: PairConstraint): {
    status: 'satisfied' | 'violated' | 'pending';
    message: string;
    color: string;
  } => {
    const [student1Id, student2Id] = constraint.students;
    const student1Placed = Object.values(state.currentSeating).includes(student1Id);
    const student2Placed = Object.values(state.currentSeating).includes(student2Id);
    const isPaired = areStudentsPaired(student1Id, student2Id, state.currentSeating);

    if (type === 'required') {
      if (!student1Placed || !student2Placed) {
        return {
          status: 'pending',
          message: '배치 대기 중',
          color: 'text-gray-500'
        };
      }
      if (isPaired) {
        return {
          status: 'satisfied',
          message: '짝으로 배치됨',
          color: 'text-green-600'
        };
      } else {
        return {
          status: 'violated',
          message: '짝이 아님',
          color: 'text-red-600'
        };
      }
    } else {
      if (!student1Placed || !student2Placed) {
        return {
          status: 'satisfied',
          message: '배치 안됨',
          color: 'text-gray-500'
        };
      }
      if (isPaired) {
        return {
          status: 'violated',
          message: '짝으로 배치됨',
          color: 'text-red-600'
        };
      } else {
        return {
          status: 'satisfied',
          message: '짝이 아님',
          color: 'text-green-600'
        };
      }
    }
  };

  const highlightStudents = (constraint: PairConstraint) => {
    // UI에서 해당 학생들을 하이라이트하는 기능 (향후 구현)
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

  if (constraints.length === 0) {
    const emptyMessage = type === 'required' 
      ? '설정된 짝 강제 제약조건이 없습니다.'
      : '설정된 짝 방지 제약조건이 없습니다.';
    
    const emptyIcon = type === 'required' ? Users : UserX;
    const EmptyIcon = emptyIcon;
    
    return (
      <div className="text-center py-8 text-gray-500">
        <EmptyIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>{emptyMessage}</p>
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
                    {type === 'required' ? (
                      <Users className="w-4 h-4 text-green-600" />
                    ) : (
                      <UserX className="w-4 h-4 text-red-600" />
                    )}
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
                  {type === 'required' 
                    ? '이 두 학생은 반드시 짝이 되어야 합니다' 
                    : '이 두 학생은 짝이 되면 안 됩니다'
                  }
                  {constraint.createdAt && (
                    <span className="ml-2">
                      • 생성: {new Date(constraint.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
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
                  onClick={() => handleRemove(constraint.id)}
                  className="p-1 border-none hover:bg-red-50 text-red-600"
                  title="제약조건 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* 색상 표시 (선택사항) */}
            {constraint.color && (
              <div className="mt-3 flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: constraint.color }}
                />
                <span className="text-xs text-gray-500">시각화 색상</span>
              </div>
            )}
          </div>
        );
      })}

      {/* 일괄 삭제 버튼 (짝 방지 제약조건에만 표시) */}
      {type === 'prohibited' && constraints.length > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <Button
            variant="outline"
            onClick={handleClearAllProhibited}
            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            icon={Trash2}
          >
            모든 짝 방지 제약조건 삭제 ({constraints.length}개)
          </Button>
        </div>
      )}

      {/* 위반 사항 요약 */}
      {constraints.some(isConstraintViolated) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <div className="font-medium">
                {type === 'required' ? '짝 강제' : '짝 방지'} 제약조건 위반
              </div>
              <div className="mt-1">
                {constraints.filter(isConstraintViolated).length}개의 제약조건이 현재 배치에서 위반되고 있습니다.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};