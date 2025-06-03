//src/components/classroom/ClassroomGrid.tsx
import React from 'react';
import { Seat } from './Seat';
import { SeatContextMenu } from './SeatContextMenu';
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
        
        const seatNumber = row * classroom.cols + col + 1;

        seats.push(
          <Seat
            key={positionKey}
            row={row}
            col={col}
            student={student}
            genderConstraint={genderConstraint}
            usageConstraint={usageConstraint}
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

  return (
    <div className="flex flex-col items-center space-y-6">
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
          <span>빈 좌석</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-seat-male rounded"></div>
          <span>남학생</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-seat-female rounded"></div>
          <span>여학생</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-300 rounded disabled-seat-pattern"></div>
          <span>사용 안함</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 border-2 border-blue-600 rounded"></div>
          <span>남학생 전용</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 border-2 border-pink-600 rounded"></div>
          <span>여학생 전용</span>
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