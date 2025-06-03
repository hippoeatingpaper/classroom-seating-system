import React from 'react';
import { Trash2, Rows, AlertCircle, Eye, Edit3 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { RowExclusionConstraint, Student, ClassroomConfig } from '@/types';
import { useAppContext } from '@/context/AppContext';
import { findStudentPosition } from '@/utils/constraintValidator';

interface RowExclusionConstraintsProps {
  constraints: RowExclusionConstraint[];
  students: Student[];
  classroom: ClassroomConfig;
}

export const RowExclusionConstraints: React.FC<RowExclusionConstraintsProps> = ({
  constraints,
  students,
  classroom,
}) => {
  const { state, dispatch } = useAppContext();

  const handleRemove = (constraintId: string) => {
    const constraint = constraints.find(c => c.id === constraintId);
    if (!constraint) return;

    const student = students.find(s => s.id === constraint.studentId);
    
    if (confirm(`${student?.name}의 줄 제외 제약조건을 삭제하시겠습니까?`)) {
      dispatch({ type: 'REMOVE_ROW_EXCLUSION_CONSTRAINT', payload: constraintId });
    }
  };

  const handleUpdateRows = (constraintId: string, currentRows: number) => {
    const newRows = prompt(
      `뒤에서부터 제외할 줄 수를 입력하세요 (현재: ${currentRows}줄):`,
      currentRows.toString()
    );
    
    if (newRows !== null) {
      const rows = parseInt(newRows);
      if (rows >= 1 && rows <= classroom.rows - 1) {
        dispatch({ 
          type: 'UPDATE_ROW_EXCLUSION_CONSTRAINT', 
          payload: { id: constraintId, excludedRowsFromBack: rows } 
        });
      } else {
        alert(`줄 수는 1~${classroom.rows - 1} 범위 내에서 설정해주세요.`);
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

  const getConstraintStatus = (constraint: RowExclusionConstraint): {
    status: 'satisfied' | 'violated' | 'pending';
    message: string;
    color: string;
    currentRow: number | null;
  } => {
    const studentPosition = findStudentPosition(constraint.studentId, state.currentSeating);
    
    if (!studentPosition) {
      return {
        status: 'pending',
        message: '배치 대기 중',
        color: 'text-gray-500',
        currentRow: null
      };
    }

    // 제외된 줄들 계산
    const excludedRows = [];
    for (let i = 0; i < constraint.excludedRowsFromBack; i++) {
      excludedRows.push(classroom.rows - 1 - i);
    }

    const isViolated = excludedRows.includes(studentPosition.row);
    const currentRow = studentPosition.row + 1; // 1-based

    if (isViolated) {
      return {
        status: 'violated',
        message: `${currentRow}번 줄 (제외 대상)`,
        color: 'text-red-600',
        currentRow
      };
    } else {
      return {
        status: 'satisfied',
        message: `${currentRow}번 줄 (정상)`,
        color: 'text-green-600',
        currentRow
      };
    }
  };

  const highlightStudent = (constraint: RowExclusionConstraint) => {
    dispatch({
      type: 'SET_UI_STATE',
      payload: { selectedStudents: [constraint.studentId] }
    });
    
    setTimeout(() => {
      dispatch({
        type: 'SET_UI_STATE',
        payload: { selectedStudents: [] }
      });
    }, 3000);
  };

  const getExcludedRowNumbers = (constraint: RowExclusionConstraint): number[] => {
    const rows = [];
    for (let i = 0; i < constraint.excludedRowsFromBack; i++) {
      rows.push(classroom.rows - i); // 1-based
    }
    return rows.sort((a, b) => b - a);
  };

  if (constraints.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Rows className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>설정된 줄 제외 제약조건이 없습니다.</p>
        <p className="text-sm mt-1">위의 추가 버튼을 클릭하여 제약조건을 설정해보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {constraints.map((constraint) => {
        const studentName = getStudentName(constraint.studentId);
        const studentGender = getStudentGender(constraint.studentId);
        const status = getConstraintStatus(constraint);
        const excludedRows = getExcludedRowNumbers(constraint);
        const isViolated = status.status === 'violated';

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
                    <span className="font-medium text-gray-900">{studentName}</span>
                    {studentGender && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        studentGender === 'male' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-pink-100 text-pink-800'
                      }`}>
                        {studentGender === 'male' ? '♂' : '♀'}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Rows className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-gray-600">
                      뒤 {constraint.excludedRowsFromBack}줄 제외
                    </span>
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
                  제외 대상: {excludedRows.join(', ')}번 줄
                  {constraint.createdAt && (
                    <span className="ml-2">
                      • 생성: {new Date(constraint.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* 시각화 */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">교실 배치:</span>
                  <div className="flex gap-1">
                    {Array.from({ length: classroom.rows }, (_, i) => {
                      const rowNumber = i + 1;
                      const isExcluded = excludedRows.includes(rowNumber);
                      const isCurrent = status.currentRow === rowNumber;
                      
                      return (
                        <div 
                          key={i} 
                          className={`w-6 h-3 text-xs flex items-center justify-center rounded ${
                            isCurrent 
                              ? (isViolated ? 'bg-red-500 text-white' : 'bg-green-500 text-white')
                              : isExcluded 
                              ? 'bg-purple-200 text-purple-800' 
                              : 'bg-gray-100 text-gray-600'
                          }`}
                          title={`${rowNumber}번 줄${isExcluded ? ' (제외)' : ''}${isCurrent ? ' (현재 위치)' : ''}`}
                        >
                          {rowNumber}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 액션 버튼들 */}
              <div className="flex items-center gap-1 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => highlightStudent(constraint)}
                  className="p-1 border-none hover:bg-blue-50 text-blue-600"
                  title="좌석에서 강조 표시"
                >
                  <Eye className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateRows(constraint.id, constraint.excludedRowsFromBack)}
                  className="p-1 border-none hover:bg-purple-50 text-purple-600"
                  title="제외 줄 수 수정"
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
      {constraints.some(c => getConstraintStatus(c).status === 'violated') && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <div className="font-medium">줄 제외 제약조건 위반</div>
              <div className="mt-1">
                {constraints.filter(c => getConstraintStatus(c).status === 'violated').length}개의 제약조건이 현재 배치에서 위반되고 있습니다.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 가이드 */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
        <h4 className="font-medium text-purple-900 mb-2">💡 줄 제외 가이드</h4>
        <div className="text-sm text-purple-800 space-y-1">
          <div>• <strong>뒤 1줄 제외</strong>: 맨 뒤 줄에 앉지 않음</div>
          <div>• <strong>뒤 2줄 제외</strong>: 뒤에서 1, 2번째 줄에 앉지 않음</div>
          <div>• 시력이 나쁘거나 집중이 필요한 학생에게 유용합니다</div>
          <div>• 최대 {classroom.rows - 1}줄까지 제외할 수 있습니다</div>
        </div>
      </div>
    </div>
  );
};