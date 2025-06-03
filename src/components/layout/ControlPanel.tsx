//src/components/layout/ControlPanel.tsx
import React, { useState } from 'react';
import { Users, Settings, Shuffle, Target, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { StudentManagement } from '@/components/student/StudentManagement';
import { ClassroomSettings } from '@/components/classroom/ClassroomSettings';
import { PlacementControls } from '@/components/placement/PlacementControls';
import { ConstraintsPanel } from '@/components/constraints/ConstraintsPanel';

interface ControlPanelProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'students' | 'settings' | 'constraints' | 'placement'>('students');

  const tabs = [
    { id: 'students', label: '학생 관리', icon: Users },
    { id: 'settings', label: '교실 설정', icon: Settings },
    { id: 'constraints', label: '제약조건', icon: Target },
    { id: 'placement', label: '배치 실행', icon: Shuffle },
  ] as const;

  if (!isOpen) return null;

  return (
    <>
      {/* 모바일 오버레이 */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
        onClick={onClose}
      />
      
      {/* 사이드바 */}
      <div className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-80 bg-white shadow-lg border-r border-gray-200 overflow-hidden z-50 lg:relative lg:top-0 lg:h-[calc(100vh-4rem)] no-print">
        {/* 모바일 닫기 버튼 */}
        <div className="flex justify-end p-2 lg:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            icon={X}
            className="border-none"
          />
        </div>

        {/* 탭 버튼들 */}
        <div className="flex border-b border-gray-200">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4 mx-auto mb-1" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="p-4 overflow-y-auto h-[calc(100vh-8rem)] lg:h-[calc(100vh-8rem)]">
          {activeTab === 'students' && <StudentManagement />}
          {activeTab === 'settings' && <ClassroomSettings />}
          {activeTab === 'constraints' && <ConstraintsPanel />}
          {activeTab === 'placement' && <PlacementControls />}
        </div>
      </div>
    </>
  );
};