//src/components/classroom/ClassroomGrid.tsx
import React from 'react';
import { Seat } from './Seat';
import { SeatContextMenu } from './SeatContextMenu';
import { Pin } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';

export const ClassroomGrid: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { classroom, students, currentSeating, ui } = state;

  const handleContextMenu = (e: React.MouseEvent, row: number, col: number) => {
    dispatch({
      type: 'SHOW_CONTEXT_MENU',
      payload: {
        position: { x: e.clientX, y: e.clientY },
        seatPosition: { row, col },
      },
    });
  };

  const handleCloseContextMenu = () => {
    dispatch({ type: 'HIDE_CONTEXT_MENU' });
  };

  // 고정된 학생인지 확인하는 함수
  const isStudentFixed = (row: number, col: number): boolean => {
    return state.fixedPlacements.some(
      fp => fp.position.row === row && fp.position.col === col
    );
  };

  // 좌석 스타일을 결정하는 함수 수정
  // const getSeatStyle = (row: number, col: number) => {
  //   const positionKey = `${row}-${col}`;
  //   const studentId = state.currentSeating[positionKey];
  //   const student = studentId ? state.students.find(s => s.id === studentId) : null;
  //   const isFixed = isStudentFixed(row, col);
    
  //   // 사용 불가 좌석 확인
  //   const isDisabled = state.classroom.seatUsageConstraints.some(
  //     c => c.position.row === row && c.position.col === col && c.isDisabled
  //   );

  //   if (isDisabled) {
  //     return 'bg-gray-300 disabled-seat-pattern cursor-not-allowed';
  //   }

  //   // 성별 제약 확인
  //   const genderConstraint = state.classroom.seatGenderConstraints.find(
  //     c => c.position.row === row && c.position.col === col
  //   );

  //   if (student) {
  //     // 학생이 있는 경우
  //     const baseClass = student.gender === 'male' ? 'bg-seat-male' : 'bg-seat-female';
  //     const fixedClass = isFixed ? 'ring-4 ring-orange-400 ring-opacity-70 shadow-lg' : '';
  //     return `${baseClass} ${fixedClass} cursor-pointer hover:shadow-md transition-all duration-200`;
  //   } else {
  //     // 빈 좌석인 경우
  //     if (genderConstraint && genderConstraint.requiredGender) {
  //       const constraintClass = genderConstraint.requiredGender === 'male' 
  //         ? 'bg-gray-200 border-2 border-blue-600' 
  //         : 'bg-gray-200 border-2 border-pink-600';
  //       return `${constraintClass} cursor-pointer hover:bg-gray-100`;
  //     }
  //     return 'bg-seat-empty border border-gray-300 border-dashed cursor-pointer hover:bg-gray-50';
  //   }
  // };

  const renderSeats = () => {
    const seats = [];
    
    for (let row = 0; row < classroom.rows; row++) {
      for (let col = 0; col < classroom.cols; col++) {
        const positionKey = `${row}-${col}`;
        const studentId = currentSeating[positionKey];
        const student = studentId ? students.find(s => s.id === studentId) : undefined;
        
        const genderConstraint = classroom.seatGenderConstraints.find(
          c => c.position.row === row && c.position.col === col
        );
        
        const usageConstraint = classroom.seatUsageConstraints.find(
          c => c.position.row === row && c.position.col === col
        );
        
        const isFixed = isStudentFixed(row, col); // 고정 상태 확인
        const seatNumber = row * classroom.cols + col + 1;

        seats.push(
          <Seat
            key={positionKey}
            row={row}
            col={col}
            student={student}
            genderConstraint={genderConstraint}
            usageConstraint={usageConstraint}
            isFixed={isFixed} // 고정 상태 props 추가
            number={seatNumber}
            onContextMenu={handleContextMenu}
          />
        );
      }
    }
    
    return seats;
  };

  // 통계 계산
  const totalSeats = classroom.rows * classroom.cols;
  const disabledSeats = classroom.seatUsageConstraints.filter(c => c.isDisabled).length;
  const availableSeats = totalSeats - disabledSeats;
  const placedStudents = Object.keys(currentSeating).length;

  const calculateSeatTypeCounts = () => {
    const totalSeats = classroom.rows * classroom.cols;
    const disabledCount = classroom.seatUsageConstraints.filter(c => c.isDisabled).length;
   
    // 성별 전용 좌석 개수
    const maleOnlySeats = classroom.seatGenderConstraints.filter(c => c.requiredGender === 'male').length;
    const femaleOnlySeats = classroom.seatGenderConstraints.filter(c => c.requiredGender === 'female').length;
    
    // 전체 학생 목록에서 성별별 개수
    const maleStudents = students.filter(student => student.gender === 'male').length;
    const femaleStudents = students.filter(student => student.gender === 'female').length;
    
    // 빈 좌석 개수 (전체 - 사용안함 - 배치된 학생)
    const emptySeats = totalSeats - disabledCount - Object.keys(currentSeating).length;
    
    // 고정된 학생 수 추가
    const fixedStudents = state.fixedPlacements.length;
    
    return {
      empty: emptySeats,
      disabled: disabledCount,
      maleStudents: maleStudents,
      femaleStudents: femaleStudents,
      maleOnly: maleOnlySeats,
      femaleOnly: femaleOnlySeats,
      fixed: fixedStudents // 새로 추가
    };
  };
  const seatCounts = calculateSeatTypeCounts();



  return (
    <div className="flex flex-col items-center space-y-6">
      {/* 기존 교탁과 그리드 */}
      <div className="bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold">
        교탁
      </div>
      
      <div
        className="grid gap-2 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
        style={{
          gridTemplateColumns: `repeat(${classroom.cols}, 1fr)`,
          gridTemplateRows: `repeat(${classroom.rows}, 1fr)`,
        }}
      >
        {renderSeats()}
      </div>

      {/* 통계 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-[300px]">
        <h4 className="text-sm font-medium text-gray-900 mb-3">좌석 현황</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">총 좌석:</span>
            <span className="ml-2 font-medium">{totalSeats}개</span>
          </div>
          <div>
            <span className="text-gray-600">사용 가능:</span>
            <span className="ml-2 font-medium text-green-600">{availableSeats}개</span>
          </div>
          <div>
            <span className="text-gray-600">사용 안함:</span>
            <span className="ml-2 font-medium text-red-600">{disabledSeats}개</span>
          </div>
          <div>
            <span className="text-gray-600">배치됨:</span>
            <span className="ml-2 font-medium text-blue-600">{placedStudents}개</span>
          </div>
        </div>
        
        {/* 경고 메시지 */}
        {state.students.length > availableSeats && (
          <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
            ⚠️ 학생 수({state.students.length}명)가 사용 가능한 좌석({availableSeats}개)보다 많습니다.
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-seat-empty border border-gray-300 border-dashed rounded"></div>
          <span>빈 좌석 {seatCounts.empty}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-seat-male rounded"></div>
          <span>남학생 {seatCounts.maleStudents}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-seat-female rounded"></div>
          <span>여학생 {seatCounts.femaleStudents}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-300 rounded disabled-seat-pattern"></div>
          <span>사용 안함 {seatCounts.disabled}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 border-2 border-blue-600 rounded"></div>
          <span>남학생 전용 {seatCounts.maleOnly}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 border-2 border-pink-600 rounded"></div>
          <span>여학생 전용 {seatCounts.femaleOnly}</span>
        </div>
        {/* 고정 학생 범례 추가 */}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-seat-empty ring-2 ring-orange-400 rounded relative">
            <Pin className="w-2 h-2 text-orange-600 absolute -top-0.5 -right-0.5" />
          </div>
          <span>고정 학생 {seatCounts.fixed}</span>
        </div>
      </div>

      <SeatContextMenu
        visible={ui.contextMenu.visible}
        position={ui.contextMenu.position}
        seatPosition={ui.contextMenu.seatPosition}
        onClose={handleCloseContextMenu}
      />
    </div>
  );
};