//src/components/constraints/ConstraintsPanel.tsx
import React, { useState } from 'react';
import { Users, UserX, MapPin, Plus, AlertTriangle, CheckCircle, Rows } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { PairConstraints } from './PairConstraints';
import { DistanceConstraints } from './DistanceConstraints';
import { RowExclusionConstraints } from './RowExclusionConstraints';
import { ConstraintModal } from './ConstraintModal';
import { useAppContext } from '@/context/AppContext';
import { validateConstraintCompatibility } from '@/utils/constraintValidator';

type ConstraintTab = 'pair_required' | 'pair_prohibited' | 'distance' | 'row_exclusion';

export const ConstraintsPanel: React.FC = () => {
  const { state } = useAppContext();
  const [activeTab, setActiveTab] = useState<ConstraintTab>('pair_required');
  const [showModal, setShowModal] = useState<ConstraintTab | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(() => {
    return localStorage.getItem('constraints_show_advanced') === 'true';
  });

  // 제약조건 호환성 검사
  const compatibility = validateConstraintCompatibility(
    state.constraints,
    state.students,
    state.classroom
  );

  const tabs = [
    {
      id: 'pair_required' as ConstraintTab,
      label: '짝 강제',
      icon: Users,
      count: state.constraints.pairRequired.length,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: '지정된 두 학생이 반드시 짝이 되도록 설정'
    },
    {
      id: 'pair_prohibited' as ConstraintTab,
      label: '짝 방지',
      icon: UserX,
      count: state.constraints.pairProhibited.length,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      description: '지정된 두 학생이 짝이 되지 않도록 설정'
    },
    // 고급 모드일 때만 표시
    ...(showAdvanced ? [
      {
        id: 'distance' as ConstraintTab,
        label: '거리 유지',
        icon: MapPin,
        count: state.constraints.distanceRules.length,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        description: '지정된 두 학생이 일정 거리 이상 떨어져 앉도록 설정'
      },
      {
        id: 'row_exclusion' as ConstraintTab,
        label: '줄 제외',
        icon: Rows,
        count: state.constraints.rowExclusions.length,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        description: '지정된 학생이 뒤에서부터 특정 줄에 앉지 않도록 설정'
      },
    ] : [])
  ];

  const activeTabInfo = tabs.find(tab => tab.id === activeTab)!;
  
  // 고급 모드 상태 저장
  const handleToggleAdvanced = () => {
    const newValue = !showAdvanced;
    setShowAdvanced(newValue);
    localStorage.setItem('constraints_show_advanced', newValue.toString());
    
    // 고급 탭이 숨겨지면서 현재 활성 탭이 고급 탭이라면 기본 탭으로 변경
    if (!newValue && (activeTab === 'distance' || activeTab === 'row_exclusion')) {
      setActiveTab('pair_required');
    }
  };

  const handleAddConstraint = () => {
    if (state.students.length < 2) {
      alert('제약조건을 설정하려면 최소 2명의 학생이 필요합니다.');
      return;
    }
    setShowModal(activeTab);
  };

  const getTotalConstraints = () => {
    const basicConstraints = state.constraints.pairRequired.length + 
                            state.constraints.pairProhibited.length;
    
    if (showAdvanced) {
      return basicConstraints + 
            state.constraints.distanceRules.length +
            state.constraints.rowExclusions.length;
    }
    
    return basicConstraints;
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">제약조건</h3>
        </div>
        <div className="text-sm text-gray-500">
          총 {state.constraints.pairRequired.length + state.constraints.pairProhibited.length}개
        </div>
      </div>

      {/* 호환성 경고 */}
      {!compatibility.isValid && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <div className="font-medium">제약조건 충돌 감지</div>
              <div className="mt-1 space-y-1">
                {compatibility.conflicts.slice(0, 3).map((conflict, index) => (
                  <div key={index}>• {conflict}</div>
                ))}
                {compatibility.conflicts.length > 3 && (
                  <div>... 외 {compatibility.conflicts.length - 3}건 더</div>
                )}
              </div>
              <div className="text-xs mt-2 text-red-600">
                충돌하는 제약조건들을 수정하거나 제거해 주세요.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 학생 부족 경고 */}
      {state.students.length < 2 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-700">
              제약조건을 설정하려면 최소 2명의 학생이 필요합니다.
            </div>
          </div>
        </div>
      )}

      {/* 탭 버튼들 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-11 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors flex-shrink-0 min-w-[100px] whitespace-nowrap ${
                  isActive
                    ? `border-current ${tab.color}`
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-bold rounded-full ${
                    isActive ? `text-white ${tab.color.replace('text-', 'bg-')}` : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 현재 탭 설명 */}
      <div className={`p-3 rounded-lg ${activeTabInfo.bgColor}`}>
        <div className="flex items-start gap-2">
          <activeTabInfo.icon className={`w-5 h-5 ${activeTabInfo.color} flex-shrink-0 mt-0.5`} />
          <div className="text-sm">
            <div className={`font-medium ${activeTabInfo.color}`}>{activeTabInfo.label}</div>
            <div className="text-gray-600 mt-1">{activeTabInfo.description}</div>
          </div>
        </div>
      </div>

      {/* 추가 버튼 */}
      <Button
        variant="outline"
        onClick={handleAddConstraint}
        disabled={state.students.length < 2}
        icon={Plus}
        className="w-full"
      >
        {activeTabInfo.label} 제약조건 추가
      </Button>

      {/* 탭 콘텐츠 */}
      <div className="space-y-4">
        {activeTab === 'pair_required' && (
          <PairConstraints
            type="required"
            constraints={state.constraints.pairRequired}
            students={state.students}
          />
        )}
        
        {activeTab === 'pair_prohibited' && (
          <PairConstraints
            type="prohibited"
            constraints={state.constraints.pairProhibited}
            students={state.students}
          />
        )}
        
        {activeTab === 'distance' && (
          <DistanceConstraints
            constraints={state.constraints.distanceRules}
            students={state.students}
          />
        )}

        {activeTab === 'row_exclusion' && (
          <RowExclusionConstraints
            constraints={state.constraints.rowExclusions}
            students={state.students}
            classroom={state.classroom}
          />
        )}
      </div>

      {/* 요약 통계 */}
      {getTotalConstraints() > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">제약조건 요약</h4>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {state.constraints.pairRequired.length > 0 && (
              <div className="flex justify-between">
                <span className="text-green-600">짝 강제:</span>
                <span className="font-medium">{state.constraints.pairRequired.length}쌍</span>
              </div>
            )}
            {state.constraints.pairProhibited.length > 0 && (
              <div className="flex justify-between">
                <span className="text-red-600">짝 방지:</span>
                <span className="font-medium">{state.constraints.pairProhibited.length}쌍</span>
              </div>
            )}
            {/* {state.constraints.distanceRules.length > 0 && showAdvanced && (
              <div className="flex justify-between">
                <span className="text-orange-600">거리 유지:</span>
                <span className="font-medium">{state.constraints.distanceRules.length}쌍</span>
              </div>
            )}
            {showAdvanced && state.constraints.rowExclusions.length > 0 && (
              <div className="flex justify-between">
                <span className="text-purple-600">줄 제외:</span>
                <span className="font-medium">{state.constraints.rowExclusions.length}개</span>
              </div>
            )} */}
            <div className="pt-2 border-t border-gray-200 flex justify-between">
              <span className="text-gray-700">상태:</span>
              <span className={`font-medium flex items-center gap-1 ${
                compatibility.isValid ? 'text-green-600' : 'text-red-600'
              }`}>
                {compatibility.isValid ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    정상
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    충돌 있음
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 제약조건 추가 모달 */}
      {showModal && (
        <ConstraintModal
          isOpen={true}
          type={showModal}
          students={state.students}
          onClose={() => setShowModal(null)}
          classroom={state.classroom}
        />
      )}

      {/* 은밀한 고급 버튼 - 맨 아래 배치 */}
      <div className="pt-8 flex justify-start">
        <button
          onClick={handleToggleAdvanced}
          className="text-xs text-gray-300 hover:text-gray-400 transition-colors px-2 py-1 bg-transparent border-none outline-none focus:outline-none"
          style={{ opacity: 0.3 }}
        >
          {showAdvanced ? '●●●' : '○○○'}
        </button>
      </div>
    </div>
  )
};