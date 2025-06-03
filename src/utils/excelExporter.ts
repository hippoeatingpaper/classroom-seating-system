//src/utils/excelExporter.ts
import * as XLSX from 'xlsx';
import { AppState, Student, ClassroomConfig, SeatingArrangement } from '@/types';

interface ExportData {
  names: (string | null)[][];
  numbers: (string | number | null)[][];
}

/**
 * 좌석 배치를 2차원 배열로 변환
 */
const convertSeatingToMatrix = (
  seating: SeatingArrangement,
  students: Student[],
  classroom: ClassroomConfig
): ExportData => {
  // 교탁 행 + 좌석 행들로 구성 (총 rows + 1행)
  const totalRows = classroom.rows + 1;
  const totalCols = classroom.cols;

  // 이름과 번호를 위한 2차원 배열 초기화
  const names: (string | null)[][] = Array(totalRows).fill(null).map(() => 
    Array(totalCols).fill(null)
  );
  const numbers: (string | number | null)[][] = Array(totalRows).fill(null).map(() => 
    Array(totalCols).fill(null)
  );

  // 첫 번째 행 첫 번째 열에 교탁 설정
  names[0][0] = '교탁';
  numbers[0][0] = '교탁';

  // 학생 ID로 학생 정보 빠르게 찾기 위한 맵 생성
  const studentMap = new Map<string, Student>();
  students.forEach(student => {
    studentMap.set(student.id, student);
  });

  // 좌석 배치 데이터를 2차원 배열에 매핑
  Object.entries(seating).forEach(([positionKey, studentId]) => {
    const [row, col] = positionKey.split('-').map(Number);
    
    // 유효한 위치인지 확인
    if (row >= 0 && row < classroom.rows && col >= 0 && col < classroom.cols) {
      const student = studentMap.get(studentId);
      if (student) {
        // 배치 행은 교탁 행(0) 다음부터 시작하므로 row + 1
        const excelRow = row + 1;
        names[excelRow][col] = student.name;
        numbers[excelRow][col] = student.number || ''; // 번호가 없으면 빈 문자열
      }
    }
  });

  return { names, numbers };
};

/**
 * 워크시트에 스타일 적용
 */
const applyWorksheetStyles = (worksheet: XLSX.WorkSheet, rows: number, cols: number) => {
  const range = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: cols - 1, r: rows } });
  worksheet['!ref'] = range;

  // 컬럼 너비 설정 (한글 이름을 고려하여 넓게)
  const colWidths = Array(cols).fill(null).map(() => ({ width: 12 }));
  worksheet['!cols'] = colWidths;

  // 행 높이 설정
  const rowHeights = Array(rows + 1).fill(null).map(() => ({ hpt: 25 }));
  worksheet['!rows'] = rowHeights;

  // 교탁 셀 스타일링 (A1)
  const teacherCell = worksheet['A1'];
  if (teacherCell) {
    teacherCell.s = {
      fill: { fgColor: { rgb: "4F46E5" } }, // 파란색 배경
      font: { bold: true, color: { rgb: "FFFFFF" } }, // 흰색 볼드
      alignment: { horizontal: "center", vertical: "center" }
    };
  }

  // 각 셀에 테두리 추가
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      
      if (cell) {
        cell.s = {
          ...cell.s,
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          },
          alignment: { horizontal: "center", vertical: "center" }
        };

        // 교탁이 아닌 셀의 배경색 설정
        if (!(row === 0 && col === 0)) {
          if (cell.v) {
            // 학생이 배치된 셀
            cell.s.fill = { fgColor: { rgb: "F3F4F6" } }; // 연한 회색
          }
        }
      }
    }
  }
};

/**
 * 좌석 배치를 엑셀 파일로 내보내기
 */
export const exportSeatingToExcel = (state: AppState): void => {
  try {
    // 배치된 학생이 없으면 경고
    if (Object.keys(state.currentSeating).length === 0) {
      alert('내보낼 좌석 배치가 없습니다.');
      return;
    }

    // 좌석 데이터를 2차원 배열로 변환
    const exportData = convertSeatingToMatrix(
      state.currentSeating,
      state.students,
      state.classroom
    );

    // 새 워크북 생성
    const workbook = XLSX.utils.book_new();

    // Sheet1: 학생 이름
    const nameWorksheet = XLSX.utils.aoa_to_sheet(exportData.names);
    applyWorksheetStyles(nameWorksheet, state.classroom.rows, state.classroom.cols);
    XLSX.utils.book_append_sheet(workbook, nameWorksheet, '학생명');

    // Sheet2: 학생 번호
    const numberWorksheet = XLSX.utils.aoa_to_sheet(exportData.numbers);
    applyWorksheetStyles(numberWorksheet, state.classroom.rows, state.classroom.cols);
    XLSX.utils.book_append_sheet(workbook, numberWorksheet, '학생번호');

    // 파일명 생성
    const now = new Date();
    const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const classroomName = state.classroom.name || '교실';
    const fileName = `좌석배치_${classroomName}_${dateString}.xlsx`;

    // 파일 다운로드
    XLSX.writeFile(workbook, fileName);

    // 성공 메시지
    const placedCount = Object.keys(state.currentSeating).length;
    const totalStudents = state.students.length;
    alert(
      `✅ 좌석 배치가 성공적으로 내보내졌습니다!\n\n` +
      `📄 파일명: ${fileName}\n` +
      `👥 배치된 학생: ${placedCount}/${totalStudents}명\n` +
      `📏 교실 크기: ${state.classroom.rows}행 × ${state.classroom.cols}열`
    );

  } catch (error) {
    console.error('엑셀 내보내기 실패:', error);
    alert('엑셀 파일 내보내기 중 오류가 발생했습니다.');
  }
};

/**
 * 빈 좌석 배치 템플릿 내보내기 (선택적 기능)
 */
export const exportEmptyTemplate = (classroom: ClassroomConfig): void => {
  try {
    const totalRows = classroom.rows + 1;
    const totalCols = classroom.cols;

    // 빈 템플릿 생성 (교탁만 있음)
    const template: (string | null)[][] = Array(totalRows).fill(null).map(() => 
      Array(totalCols).fill(null)
    );
    template[0][0] = '교탁';

    // 워크북 생성
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(template);
    
    applyWorksheetStyles(worksheet, classroom.rows, classroom.cols);
    XLSX.utils.book_append_sheet(workbook, worksheet, '좌석배치템플릿');

    // 파일 다운로드
    const fileName = `좌석배치템플릿_${classroom.rows}x${classroom.cols}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    alert(`📋 빈 좌석 템플릿이 생성되었습니다: ${fileName}`);

  } catch (error) {
    console.error('템플릿 내보내기 실패:', error);
    alert('템플릿 내보내기 중 오류가 발생했습니다.');
  }
};