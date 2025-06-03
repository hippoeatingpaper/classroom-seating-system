//src/utils/excelProcessor.ts
import * as XLSX from 'xlsx';
import { Student, ExcelImportResult, ExcelColumnMapping } from '@/types';
import { generateId } from './idGenerator';

export const parseExcelFile = async (file: File): Promise<Omit<ExcelImportResult, 'previewData' | 'columnMapping'>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 첫 번째 시트 사용
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          throw new Error('워크시트를 찾을 수 없습니다.');
        }

        const worksheet = workbook.Sheets[sheetName];
        
        // JSON 형태로 변환
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '', // 빈 셀을 빈 문자열로 처리
          raw: false // 숫자도 문자열로 변환
        });
        
        if (jsonData.length === 0) {
          throw new Error('빈 파일입니다.');
        }

        // 헤더 추출 및 정리
        const rawHeaders = jsonData[0] as any[];
        const headers = rawHeaders
          .map((h: any) => (h || '').toString().trim())
          .filter((h: string) => h !== '');

        if (headers.length === 0) {
          throw new Error('헤더를 찾을 수 없습니다.');
        }

        // 데이터 행 추출 및 정리
        const dataRows = jsonData.slice(1)
          .map((row: any) => {
            // 헤더 개수만큼만 데이터 추출
            return headers.map((_, index) => {
              const cell = row[index];
              return cell !== undefined && cell !== null ? cell.toString().trim() : '';
            });
          })
          .filter((row: any[]) => row.some((cell: any) => cell !== '')); // 완전히 빈 행 제거

        if (dataRows.length === 0) {
          throw new Error('데이터가 없습니다.');
        }

        resolve({
          headers,
          data: dataRows,
        });
      } catch (error) {
        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new Error('파일을 읽는 중 알 수 없는 오류가 발생했습니다.'));
        }
      }
    };

    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * 자동 컬럼 감지
 */
export const autoDetectColumns = (headers: string[]): ExcelColumnMapping => {
  const mapping: ExcelColumnMapping = {
    nameColumn: '',
    genderColumn: '',
    numberColumn: '',
  };

  // 이름 컬럼 자동 감지 (우선순위 순)
  const nameKeywords = [
    '이름', 'name', '성명', '학생명', '학생이름', 'student_name', 'studentname',
    '성함', '이름)', '(이름', 'full_name', 'fullname'
  ];
  
  for (const keyword of nameKeywords) {
    const found = headers.find(h => 
      h.toLowerCase().includes(keyword.toLowerCase())
    );
    if (found) {
      mapping.nameColumn = found;
      break;
    }
  }

  // 성별 컬럼 자동 감지
  const genderKeywords = [
    '성별', 'gender', '남녀', 'sex', '성', 'gender)', '(성별',
    '성별구분', '남/여', 'male/female'
  ];
  
  for (const keyword of genderKeywords) {
    const found = headers.find(h => 
      h.toLowerCase().includes(keyword.toLowerCase())
    );
    if (found) {
      mapping.genderColumn = found;
      break;
    }
  }

  // 번호 컬럼 자동 감지
  const numberKeywords = [
    '번호', 'number', 'no', '학번', '출석번호', 'student_number', 'studentnumber',
    '순번', '출석', 'roll_number', 'rollnumber', 'id', '아이디', 'num'
  ];
  
  for (const keyword of numberKeywords) {
    const found = headers.find(h => 
      h.toLowerCase().includes(keyword.toLowerCase())
    );
    if (found) {
      mapping.numberColumn = found;
      break;
    }
  }

  // 첫 번째 컬럼을 이름으로 추정 (다른 감지가 실패한 경우)
  if (!mapping.nameColumn && headers.length > 0) {
    mapping.nameColumn = headers[0];
  }

  return mapping;
};

/**
 * 성별 값 정규화
 */
const normalizeGenderValue = (value: string): 'male' | 'female' | null => {
  const normalized = value.toLowerCase().trim();
  
  // 남성 패턴
  const malePatterns = [
    '남', '남자', 'male', 'm', '1', 'boy', 'man', '남성', 'male)',
    '(남', '남)', 'male)', '남자)', 'man)'
  ];
  
  // 여성 패턴
  const femalePatterns = [
    '여', '여자', 'female', 'f', '2', 'girl', 'woman', '여성', 'female)',
    '(여', '여)', 'female)', '여자)', 'woman)'
  ];

  if (malePatterns.some(pattern => normalized.includes(pattern))) {
    return 'male';
  }
  
  if (femalePatterns.some(pattern => normalized.includes(pattern))) {
    return 'female';
  }

  return null;
};

/**
 * 번호 값 정규화
 */
const normalizeNumberValue = (value: string): number | undefined => {
  if (!value || value.trim() === '') return undefined;
  
  // 숫자만 추출
  const numberOnly = value.replace(/[^\d]/g, '');
  if (numberOnly === '') return undefined;
  
  const parsed = parseInt(numberOnly, 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
};

export const mapColumnsToStudents = (
  data: any[][],
  headers: string[],
  mapping: ExcelColumnMapping
): Student[] => {
  const nameIndex = headers.indexOf(mapping.nameColumn);
  const genderIndex = headers.indexOf(mapping.genderColumn);
  const numberIndex = mapping.numberColumn ? headers.indexOf(mapping.numberColumn) : -1;

  if (nameIndex === -1) {
    throw new Error('이름 컬럼을 찾을 수 없습니다.');
  }

  if (genderIndex === -1) {
    throw new Error('성별 컬럼을 찾을 수 없습니다.');
  }

  const students: Student[] = [];
  const errors: string[] = [];
  const duplicateNames = new Set<string>();

  // 데이터 처리
  data.forEach((row, index) => {
    const rowNumber = index + 2; // 헤더를 제외한 실제 행 번호
    
    try {
      // 이름 추출
      const nameValue = row[nameIndex];
      if (!nameValue || nameValue.toString().trim() === '') {
        errors.push(`${rowNumber}행: 이름이 비어있습니다.`);
        return;
      }
      
      const name = nameValue.toString().trim();
      if (name.length > 50) {
        errors.push(`${rowNumber}행: 이름이 너무 깁니다. (최대 50자)`);
        return;
      }

      // 성별 추출
      const genderValue = row[genderIndex];
      if (!genderValue || genderValue.toString().trim() === '') {
        errors.push(`${rowNumber}행: 성별이 비어있습니다.`);
        return;
      }

      const gender = normalizeGenderValue(genderValue.toString());
      if (!gender) {
        errors.push(`${rowNumber}행: 성별이 올바르지 않습니다. ('${genderValue}' - 남/여 또는 male/female로 입력해주세요)`);
        return;
      }

      // 번호 추출 (선택사항)
      let number: number | undefined;
      if (numberIndex !== -1 && row[numberIndex]) {
        number = normalizeNumberValue(row[numberIndex].toString());
        if (number !== undefined && number > 999) {
          errors.push(`${rowNumber}행: 번호가 너무 큽니다. (999 이하로 입력해주세요)`);
          return;
        }
      }

      // 중복 이름 체크
      if (students.some(s => s.name === name)) {
        if (!duplicateNames.has(name)) {
          duplicateNames.add(name);
          errors.push(`중복된 이름: ${name}`);
        }
        return;
      }

      // 중복 번호 체크 (번호가 있는 경우)
      if (number !== undefined && students.some(s => s.number === number)) {
        errors.push(`${rowNumber}행: 중복된 번호입니다. (${number})`);
        return;
      }

      // 학생 생성
      students.push({
        id: generateId(),
        name,
        gender,
        number,
        createdAt: new Date(),
      });

    } catch (error) {
      errors.push(`${rowNumber}행: 데이터 처리 중 오류 발생`);
    }
  });

  if (errors.length > 0) {
    const maxErrors = 10; // 최대 10개 오류만 표시
    const displayErrors = errors.slice(0, maxErrors);
    if (errors.length > maxErrors) {
      displayErrors.push(`... 외 ${errors.length - maxErrors}개 오류 더`);
    }
    throw new Error('데이터 오류:\n' + displayErrors.join('\n'));
  }

  if (students.length === 0) {
    throw new Error('유효한 학생 데이터가 없습니다.');
  }

  return students;
};

export const validateExcelFile = (file: File): string | null => {
  const validExtensions = ['.xlsx', '.xls', '.csv'];
  const fileName = file.name.toLowerCase();
  
  if (!validExtensions.some(ext => fileName.endsWith(ext))) {
    return '엑셀 파일(.xlsx, .xls) 또는 CSV 파일(.csv)만 업로드 가능합니다.';
  }

  if (file.size > 10 * 1024 * 1024) { // 10MB
    return '파일 크기는 10MB 이하여야 합니다.';
  }

  if (file.size === 0) {
    return '빈 파일은 업로드할 수 없습니다.';
  }

  return null;
};

/**
 * 엑셀 템플릿 다운로드
 */
export const downloadExcelTemplate = () => {
  // 템플릿 데이터
  const templateData = [
    ['이름', '성별', '번호'], // 헤더
    ['김민수', '남', '1'],
    ['이영희', '여', '2'],
    ['박철수', '남', '3'],
    ['최지은', '여', '4'],
    ['정현우', '남', '5'],
    ['손미래', '여', '6'],
  ];

  // 워크북 생성
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(templateData);

  // 컬럼 너비 설정
  worksheet['!cols'] = [
    { width: 15 }, // 이름
    { width: 10 }, // 성별
    { width: 10 }, // 번호
  ];

  // 헤더 스타일링을 위한 셀 범위 설정
  worksheet['!ref'] = 'A1:C7';

  // 워크시트를 워크북에 추가
  XLSX.utils.book_append_sheet(workbook, worksheet, '학생목록');

  // 파일 다운로드
  XLSX.writeFile(workbook, '학생목록_템플릿.xlsx');
};

/**
 * 데이터 미리보기 생성
 */
export const generatePreviewData = (
  data: any[][],
  headers: string[],
  mapping: ExcelColumnMapping,
  maxRows: number = 5
): Student[] => {
  try {
    const previewData = data.slice(0, maxRows);
    return mapColumnsToStudents(previewData, headers, mapping);
  } catch (error) {
    // 미리보기 오류는 무시하고 빈 배열 반환
    return [];
  }
};

/**
 * 컬럼 매핑 유효성 검사
 */
export const validateColumnMapping = (
  headers: string[],
  mapping: ExcelColumnMapping
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!mapping.nameColumn) {
    errors.push('이름 컬럼을 선택해주세요.');
  } else if (!headers.includes(mapping.nameColumn)) {
    errors.push('선택한 이름 컬럼이 존재하지 않습니다.');
  }

  if (!mapping.genderColumn) {
    errors.push('성별 컬럼을 선택해주세요.');
  } else if (!headers.includes(mapping.genderColumn)) {
    errors.push('선택한 성별 컬럼이 존재하지 않습니다.');
  }

  if (mapping.numberColumn && !headers.includes(mapping.numberColumn)) {
    errors.push('선택한 번호 컬럼이 존재하지 않습니다.');
  }

  // 같은 컬럼을 중복 선택했는지 확인
  const selectedColumns = [mapping.nameColumn, mapping.genderColumn, mapping.numberColumn]
    .filter(Boolean);
  const uniqueColumns = new Set(selectedColumns);
  
  if (selectedColumns.length !== uniqueColumns.size) {
    errors.push('같은 컬럼을 중복해서 선택할 수 없습니다.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};