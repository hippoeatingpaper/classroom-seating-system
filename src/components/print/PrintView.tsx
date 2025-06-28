//src/components/print/PrintView.tsx
import React from 'react';
import { useAppContext } from '@/context/AppContext';

interface PrintViewProps {
  scale?: number;
  showStudentNumbers?: boolean;
}

export const PrintView: React.FC<PrintViewProps> = ({ 
  scale = 1.2, 
  showStudentNumbers = true 
}) => {
  const { state } = useAppContext();
  const { classroom, students, currentSeating } = state;

  // 학생 ID로 학생 정보 찾기
  const getStudentInfo = (studentId: string) => {
    return students.find(s => s.id === studentId);
  };

  // 학생들을 번호순으로 정렬
  const getSortedStudents = () => {
    return [...students].sort((a, b) => {
      const numA = a.number || 999;
      const numB = b.number || 999;
      return numA - numB;
    });
  };

  // 짝 좌석인지 확인하는 함수
  const isPairSeat = (row: number, col: number): { 
    isPair: boolean; 
    pairType: 'left' | 'right' | null; 
    pairIndex: number | null;
  } => {
    if (!classroom.pairColumns) return { isPair: false, pairType: null, pairIndex: null };
    
    for (let i = 0; i < classroom.pairColumns.length; i++) {
      const [leftCol, rightCol] = classroom.pairColumns[i];
      if (col === leftCol) {
        return { isPair: true, pairType: 'left', pairIndex: i };
      }
      if (col === rightCol) {
        return { isPair: true, pairType: 'right', pairIndex: i };
      }
    }
    row;
    
    return { isPair: false, pairType: null, pairIndex: null };
  };

  // 짝으로 배치된 학생들인지 확인
  const areStudentsPaired = (row: number, col: number): boolean => {
    const pairInfo = isPairSeat(row, col);
    if (!pairInfo.isPair || pairInfo.pairIndex === null) return false;
    
    const [leftCol, rightCol] = classroom.pairColumns[pairInfo.pairIndex];
    const leftPositionKey = `${row}-${leftCol}`;
    const rightPositionKey = `${row}-${rightCol}`;
    
    const leftStudentId = currentSeating[leftPositionKey];
    const rightStudentId = currentSeating[rightPositionKey];
    
    // 양쪽 모두 학생이 배치되어 있어야 짝으로 간주
    return !!(leftStudentId && rightStudentId);
  };

  // 학생 명렬표 렌더링
  const renderStudentList = () => {
    const sortedStudents = getSortedStudents();
    
    return (
      <div className="print-student-list">
        <h3 className="print-student-list-title">학생 명단</h3>
        <table className="print-student-table">
          <thead>
            <tr>
              <th>번호</th>
              <th>이름</th>
            </tr>
          </thead>
          <tbody>
            {sortedStudents.map((student, index) => (
              <tr key={student.id} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                <td>{student.number || '-'}</td>
                <td>{student.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="print-student-summary">
          총 {students.length}명 (남: {students.filter(s => s.gender === 'male').length}명, 
          여: {students.filter(s => s.gender === 'female').length}명)
        </div>
      </div>
    );
  };

  // 좌석 렌더링 (교탁에서 바라보는 형태로 180도 회전)
  const renderPrintSeats = () => {
    const seats = [];
    
    // 180도 회전: 맨 뒤 행부터 시작하고, 오른쪽 열부터 시작
    for (let row = classroom.rows - 1; row >= 0; row--) {
      for (let col = classroom.cols - 1; col >= 0; col--) {
        const positionKey = `${row}-${col}`;
        const studentId = currentSeating[positionKey];
        const student = studentId ? getStudentInfo(studentId) : undefined;
        
        // 사용 불가 좌석 확인
        const isDisabled = classroom.seatUsageConstraints?.some(
          c => c.position.row === row && c.position.col === col && c.isDisabled
        );

        // 성별 제약 확인
        const genderConstraint = classroom.seatGenderConstraints?.find(
          c => c.position.row === row && c.position.col === col
        );

        const pairInfo = isPairSeat(row, col);
        const isPaired = areStudentsPaired(row, col);

        let seatContent = '';
        let seatClass = 'print-seat';

        // 짝 좌석 스타일 추가
        if (pairInfo.isPair) {
          seatClass += ` print-seat-pair-${pairInfo.pairType}`;
          if (isPaired) {
            seatClass += ' print-seat-paired';
          }
        }

        if (isDisabled) {
          seatClass += ' print-seat-disabled';
        } else if (student) {
          seatContent = showStudentNumbers && student.number 
            ? `${student.number}\n${student.name}`
            : student.name;
          // 성별에 관계없이 동일한 스타일 적용
          seatClass += ' print-seat-occupied';
        } else {
          // 빈 좌석 처리
          if (genderConstraint?.requiredGender) {
            // 성별 제약이 있는 빈 좌석도 일반 빈 좌석과 동일하게 처리
            seatClass += ' print-seat-empty';
          } else {
            seatClass += ' print-seat-empty';
          }
        }

        seats.push(
          <div key={positionKey} className={seatClass}>
            {seatContent}
          </div>
        );
      }
    }
    
    return seats;
  };

  return (
    <div className="print-container" style={{ transform: `scale(${scale})` }}>
      {/* 메인 콘텐츠 영역 */}
      <div className="print-main-content">
        {/* 학생 명렬표 */}
        {renderStudentList()}
        
        {/* 교실 그리드 영역 */}
        <div className="print-classroom-section">
          {/* 인쇄용 정보 */}
          <div className="print-info">
            <div className="print-title">
              {classroom.name || '교실 자리 배치도'}
              </div>
              <div className="print-details">
              인쇄일: {new Date().toLocaleDateString('ko-KR')}
              </div>
            </div>
          {/* 교실 그리드 (교탁에서 바라보는 형태) */}
          <div 
            className="print-classroom-grid"
            style={{
              gridTemplateColumns: `repeat(${classroom.cols}, 1fr)`,
              gridTemplateRows: `repeat(${classroom.rows}, 1fr)`,
            }}
          >
            {renderPrintSeats()}
          </div>    
          {/* 교탁 (아래쪽으로 이동) */}
          <div className="print-podium">
            교탁
          </div>
        </div>
      </div>
    </div>
  );
};