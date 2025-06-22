//src/utils/storageManager.ts
import { AppState, Student, ClassroomConfig, SeatingArrangement, Constraints } from '@/types';
import { generateId } from './idGenerator';

const STORAGE_KEYS = {
  STUDENTS: 'classroom_seating_students',
  CLASSROOM: 'classroom_seating_classroom',
  SEATING: 'classroom_seating_current',
  CONSTRAINTS: 'classroom_seating_constraints',
} as const;

const STORAGE_VERSION = '2.1'; // 좌석 사용 제외 기능 추가로 버전 업
const STORAGE_EXPIRY_DAYS = 90; // 3개월

// 만료된 데이터인지 확인하는 함수
const isDataExpired = (timestamp: string): boolean => {
  const dataDate = new Date(timestamp);
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() - STORAGE_EXPIRY_DAYS);
  return dataDate < expiryDate;
};

export const saveToStorage = (state: Partial<AppState>) => {
  try {
    const timestamp = new Date().toISOString();
    
    if (state.students) {
      const dataWithTimestamp = {
        data: state.students,
        timestamp,
        version: STORAGE_VERSION
      };
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(dataWithTimestamp));
    }
    if (state.classroom) {
      const dataWithTimestamp = {
        data: state.classroom,
        timestamp,
        version: STORAGE_VERSION
      };
      localStorage.setItem(STORAGE_KEYS.CLASSROOM, JSON.stringify(dataWithTimestamp));
    }
    if (state.currentSeating) {
      const dataWithTimestamp = {
        data: state.currentSeating,
        timestamp,
        version: STORAGE_VERSION
      };
      localStorage.setItem(STORAGE_KEYS.SEATING, JSON.stringify(dataWithTimestamp));
    }
    if (state.constraints) {
      const dataWithTimestamp = {
        data: state.constraints,
        timestamp,
        version: STORAGE_VERSION
      };
      localStorage.setItem(STORAGE_KEYS.CONSTRAINTS, JSON.stringify(dataWithTimestamp));
    }
    
    // 마지막 저장 시간 기록
    localStorage.setItem('classroom_seating_last_save', timestamp);
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
};

/**
 * 이전 버전 데이터를 현재 버전으로 마이그레이션
 */
const migrateClassroomData = (classroom: any): ClassroomConfig => {
  // 기본 구조 보장
  const migratedClassroom: ClassroomConfig = {
    rows: classroom.rows || 5,
    cols: classroom.cols || 5,
    name: classroom.name || '',
    pairColumns: classroom.pairColumns || [[0, 1], [2, 3]],
    seatGenderConstraints: classroom.seatGenderConstraints || [],
    seatUsageConstraints: classroom.seatUsageConstraints || [], // 새로 추가된 필드
    createdAt: classroom.createdAt ? new Date(classroom.createdAt) : new Date(),
  };

  // seatGenderConstraints 데이터 검증 및 마이그레이션
  if (Array.isArray(migratedClassroom.seatGenderConstraints)) {
    migratedClassroom.seatGenderConstraints = migratedClassroom.seatGenderConstraints.filter(constraint => 
      constraint && 
      typeof constraint.position === 'object' &&
      typeof constraint.position.row === 'number' &&
      typeof constraint.position.col === 'number'
    );
  }

  // seatUsageConstraints 데이터 검증 (새로 추가된 필드)
  if (Array.isArray(migratedClassroom.seatUsageConstraints)) {
    migratedClassroom.seatUsageConstraints = migratedClassroom.seatUsageConstraints.filter(constraint =>
      constraint &&
      typeof constraint.position === 'object' &&
      typeof constraint.position.row === 'number' &&
      typeof constraint.position.col === 'number' &&
      typeof constraint.isDisabled === 'boolean'
    ).map(constraint => ({
      ...constraint,
      createdAt: constraint.createdAt ? new Date(constraint.createdAt) : new Date(),
    }));
  }

  return migratedClassroom;
};

/**
 * 학생 데이터 마이그레이션
 */
const migrateStudentData = (students: any[]): Student[] => {
  if (!Array.isArray(students)) return [];
  
  return students.filter(student => 
    student && 
    typeof student.id === 'string' && 
    typeof student.name === 'string' &&
    ['male', 'female'].includes(student.gender)
  ).map(student => ({
    ...student,
    createdAt: student.createdAt ? new Date(student.createdAt) : new Date(),
  }));
};

/**
 * 좌석 배치 데이터 마이그레이션
 */
const migrateSeatingData = (seating: any, classroom: ClassroomConfig): SeatingArrangement => {
  if (!seating || typeof seating !== 'object') return {};
  
  const migratedSeating: SeatingArrangement = {};
  
  Object.entries(seating).forEach(([positionKey, studentId]) => {
    if (typeof positionKey === 'string' && typeof studentId === 'string') {
      const [row, col] = positionKey.split('-').map(Number);
      
      // 유효한 위치인지 확인
      if (!isNaN(row) && !isNaN(col) && 
          row >= 0 && row < classroom.rows && 
          col >= 0 && col < classroom.cols) {
        
        // 사용 불가 좌석이 아닌지 확인
        const isDisabledSeat = classroom.seatUsageConstraints?.some(
          c => c.position.row === row && c.position.col === col && c.isDisabled
        );
        
        if (!isDisabledSeat) {
          migratedSeating[positionKey] = studentId;
        }
      }
    }
  });
  
  return migratedSeating;
};

export const loadFromStorage = (): Partial<AppState> | null => {
  try {
    const loadDataWithExpiry = (key: string) => {
      const item = localStorage.getItem(key);
      if (!item) return null;
      
      try {
        const parsed = JSON.parse(item);
        
        // 기존 형식 호환성 확인
        if (parsed.timestamp) {
          if (isDataExpired(parsed.timestamp)) {
            localStorage.removeItem(key);
            return null;
          }
          return parsed.data;
        } else {
          // 기존 형식 데이터는 그대로 반환하되 다음 저장 시 새 형식으로 변환
          return parsed;
        }
      } catch {
        localStorage.removeItem(key);
        return null;
      }
    };

    const studentsData = loadDataWithExpiry(STORAGE_KEYS.STUDENTS);
    const classroomData = loadDataWithExpiry(STORAGE_KEYS.CLASSROOM);
    const seatingData = loadDataWithExpiry(STORAGE_KEYS.SEATING);
    const constraintsData = loadDataWithExpiry(STORAGE_KEYS.CONSTRAINTS);

    // 데이터가 없으면 null 반환
    if (!studentsData && !classroomData && !seatingData && !constraintsData) {
      return null;
    }

    // 각 데이터 마이그레이션 및 처리
    let students: Student[] = [];
    if (studentsData) {
      students = migrateStudentData(studentsData);
    }

    let classroom: ClassroomConfig | undefined;
    if (classroomData) {
      classroom = migrateClassroomData(classroomData);
    }

    let currentSeating: SeatingArrangement = {};
    if (seatingData && classroom) {
      currentSeating = migrateSeatingData(seatingData, classroom);
    }

    let constraints: Constraints | undefined;
    if (constraintsData) {
      try {
        constraints = migrateConstraintsData(constraintsData);
      } catch (e) {
        console.warn('Failed to parse constraints data:', e);
        constraints = {
          pairRequired: [],
          pairProhibited: [],
          distanceRules: [],
          rowExclusions: [],
        };
      }
    }

    return {
      students,
      classroom,
      currentSeating,
      constraints,
    };
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return null;
  }
};

/**
 * 제약조건 데이터 마이그레이션
 */
const migrateConstraintsData = (constraints: any): Constraints => {
  const defaultConstraints: Constraints = {
    pairRequired: [],
    pairProhibited: [],
    distanceRules: [],
    rowExclusions: [],
  };

  if (!constraints || typeof constraints !== 'object') {
    return defaultConstraints;
  }

  // pairRequired 마이그레이션
  if (Array.isArray(constraints.pairRequired)) {
    defaultConstraints.pairRequired = constraints.pairRequired
      .filter((c: any) => c && Array.isArray(c.students) && c.students.length === 2)
      .map((c: any) => ({
        ...c,
        id: c.id || generateId(),
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        type: 'required' as const
      }));
  }

  // pairProhibited 마이그레이션
  if (Array.isArray(constraints.pairProhibited)) {
    defaultConstraints.pairProhibited = constraints.pairProhibited
      .filter((c: any) => c && Array.isArray(c.students) && c.students.length === 2)
      .map((c: any) => ({
        ...c,
        id: c.id || generateId(),
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        type: 'prohibited' as const
      }));
  }

  // distanceRules 마이그레이션
  if (Array.isArray(constraints.distanceRules)) {
    defaultConstraints.distanceRules = constraints.distanceRules
      .filter((c: any) => c && Array.isArray(c.students) && c.students.length === 2 && typeof c.minDistance === 'number')
      .map((c: any) => ({
        ...c,
        id: c.id || generateId(),
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        minDistance: Math.max(1, Math.min(10, c.minDistance))
      }));
  }

  // rowExclusions 마이그레이션
  if (Array.isArray(constraints.rowExclusions)) {
    defaultConstraints.rowExclusions = constraints.rowExclusions
      .filter((c: any) => c && 
        typeof c.studentId === 'string' && 
        typeof c.excludedRowsFromBack === 'number' &&
        c.excludedRowsFromBack >= 1
      )
      .map((c: any) => ({
        ...c,
        id: c.id || generateId(),
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        excludedRowsFromBack: Math.max(1, Math.min(10, c.excludedRowsFromBack))
      }));
  }

  return defaultConstraints;
};

export const clearStorage = () => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};

/**
 * 전체 데이터 완전 초기화 (LocalStorage 포함)
 */
export const resetAllData = (): void => {
  try {
    // 1. 모든 관련 localStorage 키 삭제
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    // 2. 기타 관련 키들도 삭제
    localStorage.removeItem('classroom_seating_last_save');
    localStorage.removeItem('classroom_seating_error_backup');
    localStorage.removeItem('constraints_show_advanced');
    
    console.log('✅ 모든 저장된 데이터가 삭제되었습니다.');
  } catch (error) {
    console.error('❌ 데이터 초기화 중 오류 발생:', error);
    throw error;
  }
};

/**
 * 초기화 전 백업 권장 확인
 */
export const confirmResetWithBackup = (currentState: AppState): boolean => {
  const hasData = currentState.students.length > 0 || 
                  Object.keys(currentState.currentSeating).length > 0 ||
                  (currentState.constraints.pairRequired.length + 
                   currentState.constraints.pairProhibited.length + 
                   currentState.constraints.distanceRules.length + 
                   currentState.constraints.rowExclusions.length) > 0;

  if (!hasData) {
    return confirm('모든 설정을 초기화하시겠습니까?');
  }

  const firstConfirm = confirm(
    `⚠️ 전체 초기화를 진행하면 다음 데이터가 모두 삭제됩니다:\n\n` +
    `• 학생 목록 (${currentState.students.length}명)\n` +
    `• 교실 설정 및 좌석 제약조건\n` +
    `• 현재 배치 (${Object.keys(currentState.currentSeating).length}명 배치됨)\n` +
    `• 모든 제약조건\n\n` +
    `계속하기 전에 현재 데이터를 백업하시겠습니까?\n\n` +
    `"확인" = 백업 후 초기화\n` +
    `"취소" = 초기화 중단`
  );

  if (!firstConfirm) {
    return false;
  }

  // 백업 제안
  const shouldBackup = confirm(
    `💾 현재 데이터를 JSON 파일로 백업하시겠습니까?\n\n` +
    `백업하지 않으면 데이터를 복구할 수 없습니다.`
  );

  if (shouldBackup) {
    try {
      exportData(currentState);
      // 백업 완료 후 최종 확인
      return confirm(
        `백업이 완료되었습니다.\n\n` +
        `이제 모든 데이터를 초기화하시겠습니까?\n` +
        `이 작업은 되돌릴 수 없습니다.`
      );
    } catch (error) {
      alert('백업 중 오류가 발생했습니다. 초기화를 중단합니다.');
      return false;
    }
  } else {
    // 백업 없이 진행하는 경우 최종 경고
    return confirm(
      `🚨 정말로 백업 없이 모든 데이터를 삭제하시겠습니까?\n\n` +
      `이 작업은 되돌릴 수 없으며, 모든 설정과 데이터가 영구적으로 삭제됩니다.\n\n` +
      `"확인"을 누르면 즉시 초기화됩니다.`
    );
  }
};

export const exportData = (state: AppState) => {
  const exportData = {
    version: STORAGE_VERSION,
    students: state.students,
    classroom: state.classroom,
    constraints: state.constraints,
    currentSeating: state.currentSeating,
    exportedAt: new Date().toISOString(),
    metadata: {
      totalStudents: state.students.length,
      totalSeats: state.classroom.rows * state.classroom.cols,
      disabledSeats: state.classroom.seatUsageConstraints?.filter(c => c.isDisabled).length || 0,
      genderConstraints: state.classroom.seatGenderConstraints?.length || 0,
      placedStudents: Object.keys(state.currentSeating).length,
    }
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `classroom-seating-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * 가져온 데이터의 유효성 검증
 */
export const validateImportData = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('올바르지 않은 파일 형식입니다.');
    return { isValid: false, errors };
  }

  // 버전 확인
  if (!data.version) {
    console.warn('Version info missing in import data');
  }

  // 학생 데이터 검증
  if (data.students) {
    if (!Array.isArray(data.students)) {
      errors.push('학생 데이터가 올바르지 않습니다.');
    } else {
      const invalidStudents = data.students.filter((s: any) => 
        !s || typeof s.id !== 'string' || typeof s.name !== 'string' || 
        !['male', 'female'].includes(s.gender)
      );
      if (invalidStudents.length > 0) {
        errors.push(`${invalidStudents.length}명의 학생 데이터가 올바르지 않습니다.`);
      }
    }
  }

  // 교실 데이터 검증
  if (data.classroom) {
    const c = data.classroom;
    if (typeof c.rows !== 'number' || typeof c.cols !== 'number' ||
        c.rows < 3 || c.rows > 10 || c.cols < 3 || c.cols > 10) {
      errors.push('교실 크기가 올바르지 않습니다. (3-10 범위)');
    }
  }

  // 좌석 배치 데이터 검증
  if (data.currentSeating && data.classroom) {
    const invalidSeats = Object.keys(data.currentSeating).filter(posKey => {
      const [row, col] = posKey.split('-').map(Number);
      return isNaN(row) || isNaN(col) || 
             row < 0 || row >= data.classroom.rows ||
             col < 0 || col >= data.classroom.cols;
    });
    
    if (invalidSeats.length > 0) {
      errors.push(`${invalidSeats.length}개의 좌석 배치가 유효하지 않습니다.`);
    }
  }

  // 제약조건 데이터 검증
  if (data.constraints) {
    const c = data.constraints;
    
    if (c.pairRequired && Array.isArray(c.pairRequired)) {
      const invalidPairs = c.pairRequired.filter((p: any) => 
        !p || !Array.isArray(p.students) || p.students.length !== 2
      );
      if (invalidPairs.length > 0) {
        errors.push(`${invalidPairs.length}개의 짝 강제 제약조건이 올바르지 않습니다.`);
      }
    }

    if (c.distanceRules && Array.isArray(c.distanceRules)) {
      const invalidRules = c.distanceRules.filter((r: any) => 
        !r || !Array.isArray(r.students) || r.students.length !== 2 || 
        typeof r.minDistance !== 'number' || r.minDistance < 1 || r.minDistance > 10
      );
      if (invalidRules.length > 0) {
        errors.push(`${invalidRules.length}개의 거리 제약조건이 올바르지 않습니다.`);
      }
    }

    if (c.rowExclusions && Array.isArray(c.rowExclusions)) {
      const invalidRules = c.rowExclusions.filter((r: any) => 
        !r || typeof r.studentId !== 'string' || 
        typeof r.excludedRowsFromBack !== 'number' || 
        r.excludedRowsFromBack < 1 || r.excludedRowsFromBack > 10
      );
      if (invalidRules.length > 0) {
        errors.push(`${invalidRules.length}개의 줄 제외 제약조건이 올바르지 않습니다.`);
      }
    }
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * 데이터 가져오기 (파일에서)
 */
export const importData = async (file: File): Promise<{ success: boolean; data?: any; errors?: string[] }> => {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    const validation = validateImportData(data);
    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    // 데이터 마이그레이션
    const migratedData: Partial<AppState> = {};
    
    if (data.students) {
      migratedData.students = migrateStudentData(data.students);
    }
    
    if (data.classroom) {
      migratedData.classroom = migrateClassroomData(data.classroom);
    }
    
    if (data.currentSeating && migratedData.classroom) {
      migratedData.currentSeating = migrateSeatingData(data.currentSeating, migratedData.classroom);
    }
    
    if (data.constraints) {
      migratedData.constraints = data.constraints;
    }

    return { success: true, data: migratedData };
  } catch (error) {
    return { 
      success: false, 
      errors: ['파일을 읽는 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : 'Unknown error')] 
    };
  }
};

/**
 * 저장소 용량 확인
 */
export const getStorageInfo = () => {
  try {
    const data = {
      students: localStorage.getItem(STORAGE_KEYS.STUDENTS),
      classroom: localStorage.getItem(STORAGE_KEYS.CLASSROOM),
      seating: localStorage.getItem(STORAGE_KEYS.SEATING),
      constraints: localStorage.getItem(STORAGE_KEYS.CONSTRAINTS),
    };

    const totalSize = Object.values(data).reduce((sum, item) => {
      return sum + (item ? new Blob([item]).size : 0);
    }, 0);

    return {
      totalSize,
      formattedSize: formatBytes(totalSize),
      itemCount: Object.values(data).filter(Boolean).length,
      lastUpdated: localStorage.getItem('classroom_seating_last_save') || 'Unknown',
    };
  } catch (error) {
    console.error('Failed to get storage info:', error);
    return null;
  }
};

/**
 * 바이트를 읽기 쉬운 형태로 변환
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 저장소 정리 (오래된 백업 데이터 등 제거)
 */
export const cleanupStorage = () => {
  try {
    // 만료된 메인 데이터 정리
    Object.values(STORAGE_KEYS).forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        try {
          const parsed = JSON.parse(item);
          if (parsed.timestamp && isDataExpired(parsed.timestamp)) {
            localStorage.removeItem(key);
            console.log(`Expired data removed: ${key}`);
          }
        } catch {
          // 파싱 실패한 데이터 제거
          localStorage.removeItem(key);
        }
      }
    });

    // 오래된 에러 백업 제거 (7일 이상)
    const errorBackup = localStorage.getItem('classroom_seating_error_backup');
    if (errorBackup) {
      const backup = JSON.parse(errorBackup);
      const backupDate = new Date(backup.timestamp);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      if (backupDate < weekAgo) {
        localStorage.removeItem('classroom_seating_error_backup');
      }
    }

    console.log('Storage cleanup completed');
  } catch (error) {
    console.error('Failed to cleanup storage:', error);
  }
};

// 자동 정리 (페이지 로드 시 실행)
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(cleanupStorage, 1000); // 1초 후 실행
  });
}