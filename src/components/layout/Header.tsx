//src/components/layout/Header.tsx
import React from 'react';
import { Menu, Save, FolderOpen, Printer, RotateCcw } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useAppContext } from '@/context/AppContext';
import { exportData, resetAllData, confirmResetWithBackup, saveToStorage } from '@/utils/storageManager';
import { createInitialState } from '@/context/AppReducer';
import { exportSeatingToExcel } from '@/utils/excelExporter';
import { FileDown } from 'lucide-react';
import { validatePrintConditions, executePrint, calculateOptimalScale } from '@/utils/printUtils';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { state, dispatch } = useAppContext();

  const handleSave = () => {
    try {
      exportData(state);
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleLoad = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          
          // 데이터 유효성 확인
          if (!data.version || !data.students) {
            throw new Error('올바르지 않은 파일 형식입니다.');
          }
          
          // 기존 데이터 초기화 후 복원
          dispatch({ type: 'RESET_ALL' });
          
          if (data.students) {
            dispatch({ type: 'SET_STUDENTS', payload: data.students });
          }
          if (data.classroom) {
            dispatch({ type: 'UPDATE_CLASSROOM', payload: data.classroom });
          }
          if (data.currentSeating) {
            dispatch({ type: 'SET_SEATING', payload: data.currentSeating });
          }
          if (data.constraints) {
            dispatch({ type: 'SET_CONSTRAINTS', payload: data.constraints });
          }
          
          alert('데이터를 성공적으로 불러왔습니다.');
        } catch (error) {
          console.error('불러오기 실패:', error);
          alert('파일을 불러오는 중 오류가 발생했습니다.');
        }
      }
    };
    input.click();
  };

  const handleExportExcel = () => {
    try {
      exportSeatingToExcel(state);
    } catch (error) {
      console.error('엑셀 내보내기 실패:', error);
      alert('엑셀 파일 내보내기 중 오류가 발생했습니다.');
    }
  };

  const handlePrint = () => {
    const validation = validatePrintConditions(state.currentSeating);
    
    if (!validation.canPrint) {
      alert(validation.message);
      return;
    }

    // 교실 크기에 따른 최적 스케일 계산
    const optimalScale = calculateOptimalScale(state.classroom.rows, state.classroom.cols);
    
    executePrint({
      scale: optimalScale,
      showStudentNumbers: true,
      paperSize: 'A4',
      orientation: 'landscape'
    });
  };

  const handleReset = () => {
    try {
      const shouldReset = confirmResetWithBackup(state);
      
      if (shouldReset) {
        // 1. LocalStorage 완전 삭제
        resetAllData();
        
        // 2. 새로운 초기 상태 생성
        const newInitialState = createInitialState();
        
        // 3. LocalStorage에 새로운 상태 저장
        saveToStorage(newInitialState);
        
        // 4. 애플리케이션 상태 초기화 (기본 학생들 포함)
        dispatch({ type: 'RESET_ALL' });
        
        alert('✅ 모든 데이터가 초기화되었습니다.\n🎓 기본 학생 명단 25명이 다시 설정되었습니다.');
      }
    } catch (error) {
      console.error('초기화 실패:', error);
      alert('초기화 중 오류가 발생했습니다.');
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 no-print">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleSidebar}
              icon={Menu}
              className="border-none"
            />
            <h1 className="text-xl font-semibold text-gray-900">
              교실 자리 배치 시스템
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              icon={RotateCcw}
            >
              초기화
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              icon={FileDown}
              disabled={Object.keys(state.currentSeating).length === 0}
            >
              엑셀 내보내기
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              icon={Save}
            >
              저장
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoad}
              icon={FolderOpen}
            >
              불러오기
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              icon={Printer}
            >
              인쇄
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};