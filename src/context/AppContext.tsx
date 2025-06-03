//src/context/AppContext.tsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { AppState, AppAction } from '@/types';
import { appReducer, createInitialState } from './AppReducer';
import { loadFromStorage, saveToStorage } from '@/utils/storageManager';

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, createInitialState());

  // 초기 데이터 로드
  useEffect(() => {
    const loadedState = loadFromStorage();
    if (loadedState) {
      // 저장된 데이터가 있는 경우 복원
      if (loadedState.students) {
        dispatch({ type: 'SET_STUDENTS', payload: loadedState.students });
      }
      if (loadedState.classroom) {
        dispatch({ type: 'UPDATE_CLASSROOM', payload: loadedState.classroom });
      }
      if (loadedState.currentSeating) {
        dispatch({ type: 'SET_SEATING', payload: loadedState.currentSeating });
      }
      if (loadedState.constraints) {
        dispatch({ type: 'SET_CONSTRAINTS', payload: loadedState.constraints });
      }
    } else {
      // 저장된 데이터가 없는 경우 (첫 실행), 기본 학생들은 이미 createInitialState에서 설정됨
      console.log('🎓 기본 학생 명단 25명이 설정되었습니다.');
    }
  }, []);

  // 상태 변경 시 자동 저장 (디바운스 적용)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveToStorage(state);
    }, 1000); // 1초 디바운스

    return () => clearTimeout(timeoutId);
  }, [
    state.students, 
    state.classroom, 
    state.currentSeating, 
    state.constraints  // 제약조건 변경 감지 추가
  ]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};