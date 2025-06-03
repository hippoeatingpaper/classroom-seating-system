//src/components/student/StudentManagement.tsx
import React, { useState } from 'react';
import { Upload, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { StudentForm } from './StudentForm';
import { StudentList } from './StudentList';
import { ExcelUploader } from './ExcelUploader';
import { useAppContext } from '@/context/AppContext';

export const StudentManagement: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [showExcelUploader, setShowExcelUploader] = useState(false);

  const handleImportFromExcel = (students: any[]) => {
    let addedCount = 0;
    let duplicateCount = 0;
    
    students.forEach(student => {
      // 기존 학생과 이름 중복 체크
      if (state.students.some(s => s.name === student.name)) {
        duplicateCount++;
      } else {
        dispatch({ type: 'ADD_STUDENT', payload: student });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      let message = `${addedCount}명의 학생이 추가되었습니다.`;
      if (duplicateCount > 0) {
        message += `\n(${duplicateCount}명은 이름이 중복되어 제외되었습니다.)`;
      }
      alert(message);
    } else if (duplicateCount > 0) {
      alert(`모든 학생이 이름 중복으로 제외되었습니다. (${duplicateCount}명)`);
    }
  };

  const handleClearAll = () => {
    if (state.students.length === 0) return;
    
    if (confirm(`모든 학생(${state.students.length}명)을 삭제하시겠습니까?`)) {
      dispatch({ type: 'SET_STUDENTS', payload: [] });
      dispatch({ type: 'SET_SEATING', payload: {} });
    }
  };

const handleImportExample = () => {

    // 추가 예시 학생 데이터 (기본 25명 외 추가용)
    const additionalStudents = [
      { name: '홍길동', gender: 'male' as const, number: 26 },
      { name: '김영희', gender: 'female' as const, number: 27 },
      { name: '박철수', gender: 'male' as const, number: 28 },
      { name: '이순신', gender: 'male' as const, number: 29 },
      { name: '신사임당', gender: 'female' as const, number: 30 },
    ];

    let addedCount = 0;
    additionalStudents.forEach(studentData => {
      // 중복 체크
      if (!state.students.some(s => s.name === studentData.name)) {
        const newStudent = {
          id: Date.now().toString() + Math.random().toString(),
          name: studentData.name,
          gender: studentData.gender,
          number: studentData.number,
          createdAt: new Date(),
        };
        dispatch({ type: 'ADD_STUDENT', payload: newStudent });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      alert(`${addedCount}명의 추가 학생이 등록되었습니다.`);
    } else {
      alert('모든 예시 학생이 이미 존재합니다.');
    }
  };

  const handleReplaceWithExcel = () => {
    if (state.students.length === 0) {
      setShowExcelUploader(true);
      return;
    }

    if (confirm('기존 학생 목록을 모두 삭제하고 엑셀 파일로 교체하시겠습니까?')) {
      dispatch({ type: 'SET_STUDENTS', payload: [] });
      dispatch({ type: 'SET_SEATING', payload: {} });
      setShowExcelUploader(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">학생 관리</h3>
        <div className="text-sm text-gray-500">
          총 {state.students.length}명
        </div>
      </div>

      <StudentForm />

      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExcelUploader(true)}
            icon={Upload}
            className="flex-1"
          >
            엑셀 추가
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportExample}
            className="flex-1"
          >
            예시 데이터
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReplaceWithExcel}
            icon={AlertTriangle}
            className="flex-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
          >
            엑셀로 교체
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            icon={Trash2}
            disabled={state.students.length === 0}
            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            전체 삭제
          </Button>
        </div>
      </div>

      <StudentList />

      <ExcelUploader
        isOpen={showExcelUploader}
        onClose={() => setShowExcelUploader(false)}
        onImport={handleImportFromExcel}
      />
    </div>
  );
};