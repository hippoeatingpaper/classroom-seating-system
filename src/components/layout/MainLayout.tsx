//src/components/layout/MainLayout.tsx
import React, { useState } from 'react';
import { Header } from './Header';
import { ControlPanel } from './ControlPanel';
import { ClassroomGrid } from '@/components/classroom/ClassroomGrid';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useAppContext } from '@/context/AppContext';

export const MainLayout: React.FC = () => {
  const { state } = useAppContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex">
        <ControlPanel 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)}
        />
        
        <main className="flex-1 p-6">
          <div className="max-w-full mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {state.classroom.name || '교실 배치도'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {state.classroom.rows} × {state.classroom.cols} | 
                  배치됨: {Object.keys(state.currentSeating).length}/{state.students.length}명
                </p>
              </div>
              
              <ClassroomGrid />
            </div>
          </div>
        </main>
      </div>
      
      {/* 로딩 오버레이 */}
      {state.ui.loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <LoadingSpinner />
            <span className="text-gray-700">처리 중...</span>
          </div>
        </div>
      )}
    </div>
  );
};