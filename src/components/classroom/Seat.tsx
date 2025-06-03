//src/components/classroom/Seat.tsx
import React from 'react';
import { Student, SeatGenderConstraint, SeatUsageConstraint } from '@/types';
import { useAppContext } from '@/context/AppContext';
import { Ban } from 'lucide-react';

interface SeatProps {
  row: number;
  col: number;
  student?: Student;
  genderConstraint?: SeatGenderConstraint;
  usageConstraint?: SeatUsageConstraint;
  number: number;
  onContextMenu: (e: React.MouseEvent, row: number, col: number) => void;
}

export const Seat: React.FC<SeatProps> = ({
  row,
  col,
  student,
  genderConstraint,
  usageConstraint,
  number,
  onContextMenu,
}) => {
  const { state, dispatch } = useAppContext();

  const isDisabled = usageConstraint?.isDisabled || false;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isDisabled) {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    if (isDisabled) {
      // 사용 불가 좌석에는 드롭 불가
      return;
    }

    const studentId = e.dataTransfer.getData('text/plain');
    if (studentId) {
      handleStudentDrop(studentId, row, col);
    }
  };

  const handleStudentDrop = (studentId: string, targetRow: number, targetCol: number) => {
    const positionKey = `${targetRow}-${targetCol}`;
    
    // 이미 다른 학생이 있는지 확인
    if (state.currentSeating[positionKey] && state.currentSeating[positionKey] !== studentId) {
      alert('이미 다른 학생이 배치되어 있습니다.');
      return;
    }

    // 성별 제약조건 확인
    if (genderConstraint && genderConstraint.requiredGender) {
      const student = state.students.find(s => s.id === studentId);
      if (student && student.gender !== genderConstraint.requiredGender) {
        alert(`이 좌석은 ${genderConstraint.requiredGender === 'male' ? '남학생' : '여학생'}만 앉을 수 있습니다.`);
        return;
      }
    }

    dispatch({
      type: 'MOVE_STUDENT',
      payload: { studentId, position: { row: targetRow, col: targetCol } }
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(e, row, col);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (student && !isDisabled) {
      e.dataTransfer.setData('text/plain', student.id);
      dispatch({ type: 'SET_UI_STATE', payload: { draggedStudent: student.id } });
    }
  };

  const getSeatClassName = () => {
    let baseClass = 'w-20 h-16 border-2 rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all duration-200 relative';
    
    if (isDisabled) {
      // 사용 불가 좌석 스타일
      baseClass += ' bg-gray-300 border-gray-400 cursor-not-allowed';
      baseClass += ' bg-gradient-to-br from-gray-300 to-gray-400';
      // 사선 패턴을 위한 클래스는 CSS에서 정의
      baseClass += ' disabled-seat-pattern';
    } else if (student) {
      // 학생이 배치된 좌석
      baseClass += ' cursor-grab hover:shadow-md';
      if (student.gender === 'male') {
        baseClass += ' bg-seat-male text-white border-blue-600';
      } else {
        baseClass += ' bg-seat-female text-white border-pink-600';
      }
    } else {
      // 빈 좌석
      baseClass += ' bg-seat-empty border-gray-300 border-dashed hover:border-gray-400 cursor-pointer hover:shadow-md';
    }

    // 성별 제약조건 표시 (사용 가능한 좌석에만)
    if (!isDisabled && genderConstraint && genderConstraint.requiredGender) {
      if (genderConstraint.requiredGender === 'male') {
        baseClass += ' ring-2 ring-seat-restricted-male';
      } else {
        baseClass += ' ring-2 ring-seat-restricted-female';
      }
    }

    return baseClass;
  };

  return (
    <div
      className={getSeatClassName()}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
      draggable={!!student && !isDisabled}
      onDragStart={handleDragStart}
      title={isDisabled ? `사용 안함${usageConstraint?.reason ? `: ${usageConstraint.reason}` : ''}` : ''}
    >
      <div className="absolute top-1 left-1 text-xs text-gray-500 opacity-70">
        {number}
      </div>
      
      {isDisabled ? (
        <div className="text-center">
          <Ban className="w-6 h-6 text-gray-600 mx-auto mb-1" />
          <div className="text-xs text-gray-600 font-semibold">사용안함</div>
        </div>
      ) : student ? (
        <div className="text-center">
          <div className="font-semibold text-xs">{student.name}</div>
          <div className="text-xs opacity-80 mt-0.5">
            {student.gender === 'male' ? '♂' : '♀'}
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-400">빈 좌석</div>
      )}
      
      {!isDisabled && genderConstraint && genderConstraint.requiredGender && (
        <div className="absolute top-1 right-1 text-sm">
          {genderConstraint.requiredGender === 'male' ? '♂' : '♀'}
        </div>
      )}
    </div>
  );
};