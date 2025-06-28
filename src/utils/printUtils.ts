//src/utils/printUtils.ts

export interface PrintOptions {
  scale?: number;
  showStudentNumbers?: boolean;
  paperSize?: 'A4' | 'A3';
  orientation?: 'portrait' | 'landscape';
}

export const defaultPrintOptions: PrintOptions = {
  scale: 1.2,
  showStudentNumbers: true,
  paperSize: 'A4',
  orientation: 'landscape'
};

/**
 * 인쇄 실행 함수
 */
export const executePrint = (options: PrintOptions = defaultPrintOptions) => {
  // 인쇄 전용 스타일을 동적으로 추가
  const printStyle = document.createElement('style');
  printStyle.innerHTML = `
    @media print {
      body * {
        visibility: hidden;
      }
      
      .print-container,
      .print-container * {
        visibility: visible;
      }
      
      .print-container {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        transform: scale(${options.scale || 1.2});
        transform-origin: top left;
      }

      @page {
        margin: 0.5in;
        size: ${options.paperSize} ${options.orientation};
      }
    }
  `;
  
  document.head.appendChild(printStyle);
  
  // 인쇄 실행
  window.print();
  
  // 인쇄 후 스타일 제거
  setTimeout(() => {
    document.head.removeChild(printStyle);
  }, 1000);
};

/**
 * 교실 크기에 따른 최적 스케일 계산
 */
export const calculateOptimalScale = (rows: number, cols: number): number => {
  const totalSeats = rows * cols;
  const baseScale = 1.44;

  if (totalSeats <= 20) return 1.5 * baseScale;
  if (totalSeats <= 35) return 1.3 * baseScale;
  if (totalSeats <= 50) return 1.1 * baseScale;
  return 1.0 * baseScale;
};

/**
 * 인쇄 미리보기 생성
 */
export const generatePrintPreview = (containerId: string): string => {
  const container = document.getElementById(containerId);
  if (!container) return '';
  
  return container.innerHTML;
};

/**
 * 인쇄 가능 여부 확인
 */
export const validatePrintConditions = (seatingData: Record<string, string>): {
  canPrint: boolean;
  message?: string;
} => {
  if (Object.keys(seatingData).length === 0) {
    return {
      canPrint: false,
      message: '인쇄할 배치가 없습니다. 먼저 좌석 배치를 완료해주세요.'
    };
  }
  
  return { canPrint: true };
};

/**
 * 좌표 변환: 학생 시점 → 교탁 시점 (180도 회전)
 */
export const transformCoordinatesForTeacherView = (
  row: number, 
  col: number, 
  totalRows: number, 
  totalCols: number
): { row: number; col: number } => {
  return {
    row: totalRows - 1 - row,
    col: totalCols - 1 - col
  };
};