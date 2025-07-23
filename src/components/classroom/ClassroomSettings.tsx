//src/components/classroom/ClassroomSettings.tsx
import React, { useState } from 'react';
import { Ban, RotateCw, AlertTriangle, Eye, User } from 'lucide-react';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { useAppContext } from '@/context/AppContext';
import { getAvailableSeats } from '@/utils/seatingAlgorithm';

export const ClassroomSettings: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [showDisabledSeatsModal, setShowDisabledSeatsModal] = useState(false);
  const [showBulkDisableModal, setShowBulkDisableModal] = useState(false);
  const [bulkDisableReason, setBulkDisableReason] = useState('');
  const [selectedSeats, setSelectedSeats] = useState<{row: number, col: number}[]>([]);
  const [showGenderConstraintsModal, setShowGenderConstraintsModal] = useState(false);
  const [showBulkGenderModal, setShowBulkGenderModal] = useState(false);
  const [selectedMaleSeats, setSelectedMaleSeats] = useState<{row: number, col: number}[]>([]);
  const [selectedFemaleSeats, setSelectedFemaleSeats] = useState<{row: number, col: number}[]>([]);
  const [selectedClearSeats, setSelectedClearSeats] = useState<{row: number, col: number}[]>([]);
  const [activeGenderTab, setActiveGenderTab] = useState<'male' | 'female' | 'clear'>('male');

  // 통계 계산
  const totalSeats = state.classroom.rows * state.classroom.cols;
  const availableSeats = getAvailableSeats(state.classroom);
  const disabledSeats = state.classroom.seatUsageConstraints.filter(c => c.isDisabled);
  const genderConstrainedSeats = state.classroom.seatGenderConstraints.length;
  const maleOnlySeats = state.classroom.seatGenderConstraints.filter(c => c.requiredGender === 'male');
  const femaleOnlySeats = state.classroom.seatGenderConstraints.filter(c => c.requiredGender === 'female');
  const placedStudents = Object.keys(state.currentSeating).length;

  const handleClassroomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: 'UPDATE_CLASSROOM',
      payload: { name: e.target.value }
    });
  };

  const handleRowsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rows = parseInt(e.target.value);
    if (rows >= 3 && rows <= 10) {
      dispatch({
        type: 'UPDATE_CLASSROOM',
        payload: { rows }
      });
    }
  };

  const handleColsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cols = parseInt(e.target.value);
    if (cols >= 3 && cols <= 10) {
      // 열 수 변경 시 기본 짝 구성도 업데이트
      const newPairColumns = [];
      for (let i = 0; i < cols - 1; i += 2) {
        newPairColumns.push([i, i + 1]);
      }
      
      dispatch({
        type: 'UPDATE_CLASSROOM',
        payload: { 
          cols,
          pairColumns: newPairColumns
        }
      });
    }
  };

  const handlePairColumnChange = (pairIndex: number, checked: boolean) => {
    const newPairColumns = [...state.classroom.pairColumns];
    const pair = [pairIndex * 2, pairIndex * 2 + 1];
    
    if (checked) {
      // 짝 추가
      if (!newPairColumns.some(p => p[0] === pair[0] && p[1] === pair[1])) {
        newPairColumns.push(pair);
      }
    } else {
      // 짝 제거
      const index = newPairColumns.findIndex(p => p[0] === pair[0] && p[1] === pair[1]);
      if (index !== -1) {
        newPairColumns.splice(index, 1);
      }
    }
    
    dispatch({
      type: 'UPDATE_CLASSROOM',
      payload: { pairColumns: newPairColumns }
    });
  };

  const handleRemoveDisabledSeat = (row: number, col: number) => {
    dispatch({
      type: 'REMOVE_SEAT_USAGE_CONSTRAINT',
      payload: { row, col }
    });
  };

  const handleClearAllDisabledSeats = () => {
    if (disabledSeats.length === 0) return;
    
    if (confirm(`모든 사용 불가 좌석(${disabledSeats.length}개)을 해제하시겠습니까?`)) {
      disabledSeats.forEach(constraint => {
        dispatch({
          type: 'REMOVE_SEAT_USAGE_CONSTRAINT',
          payload: constraint.position
        });
      });
    }
  };

  const handleSeatToggle = (row: number, col: number) => {
    const existingIndex = selectedSeats.findIndex(s => s.row === row && s.col === col);
    if (existingIndex >= 0) {
      setSelectedSeats(selectedSeats.filter((_, i) => i !== existingIndex));
    } else {
      setSelectedSeats([...selectedSeats, { row, col }]);
    }
  };

  const handleBulkDisable = () => {
    if (selectedSeats.length === 0) {
      alert('선택된 좌석이 없습니다.');
      return;
    }

    selectedSeats.forEach(position => {
      dispatch({
        type: 'SET_SEAT_USAGE_CONSTRAINT',
        payload: {
          position,
          isDisabled: true,
          reason: bulkDisableReason.trim() || undefined,
          createdAt: new Date(),
        }
      });
    });

    setSelectedSeats([]);
    setBulkDisableReason('');
    setShowBulkDisableModal(false);
    alert(`${selectedSeats.length}개 좌석을 사용 불가로 설정했습니다.`);
  };

  // 성별 제약 관련 handler 함수들
  const handleRemoveGenderConstraint = (row: number, col: number) => {
    dispatch({
      type: 'REMOVE_SEAT_GENDER_CONSTRAINT',
      payload: { row, col }
    });
  };

  const handleClearAllGenderConstraints = () => {
    if (genderConstrainedSeats === 0) return;
    
    if (confirm(`모든 성별 제약 좌석(${genderConstrainedSeats}개)을 해제하시겠습니까?`)) {
      state.classroom.seatGenderConstraints.forEach(constraint => {
        dispatch({
          type: 'REMOVE_SEAT_GENDER_CONSTRAINT',
          payload: constraint.position
        });
      });
    }
  };

  const handleGenderSeatToggle = (row: number, col: number) => {
    const position = { row, col };
    
    if (activeGenderTab === 'male') {
      const existingIndex = selectedMaleSeats.findIndex(s => s.row === row && s.col === col);
      if (existingIndex >= 0) {
        setSelectedMaleSeats(selectedMaleSeats.filter((_, i) => i !== existingIndex));
      } else {
        setSelectedMaleSeats([...selectedMaleSeats, position]);
        // 다른 탭에서 동일 좌석이 선택되어 있다면 해제
        setSelectedFemaleSeats(prev => prev.filter(s => !(s.row === row && s.col === col)));
        setSelectedClearSeats(prev => prev.filter(s => !(s.row === row && s.col === col)));
      }
    } else if (activeGenderTab === 'female') {
      const existingIndex = selectedFemaleSeats.findIndex(s => s.row === row && s.col === col);
      if (existingIndex >= 0) {
        setSelectedFemaleSeats(selectedFemaleSeats.filter((_, i) => i !== existingIndex));
      } else {
        setSelectedFemaleSeats([...selectedFemaleSeats, position]);
        // 다른 탭에서 동일 좌석이 선택되어 있다면 해제
        setSelectedMaleSeats(prev => prev.filter(s => !(s.row === row && s.col === col)));
        setSelectedClearSeats(prev => prev.filter(s => !(s.row === row && s.col === col)));
      }
    } else if (activeGenderTab === 'clear') {
      const existingIndex = selectedClearSeats.findIndex(s => s.row === row && s.col === col);
      if (existingIndex >= 0) {
        setSelectedClearSeats(selectedClearSeats.filter((_, i) => i !== existingIndex));
      } else {
        setSelectedClearSeats([...selectedClearSeats, position]);
        // 다른 탭에서 동일 좌석이 선택되어 있다면 해제
        setSelectedMaleSeats(prev => prev.filter(s => !(s.row === row && s.col === col)));
        setSelectedFemaleSeats(prev => prev.filter(s => !(s.row === row && s.col === col)));
      }
    }
  };

  const handleBulkGenderSet = () => {
    const totalSelected = selectedMaleSeats.length + selectedFemaleSeats.length + selectedClearSeats.length;
    
    if (totalSelected === 0) {
      alert('선택된 좌석이 없습니다.');
      return;
    }

    // 남학생 전용 좌석 설정
    selectedMaleSeats.forEach(position => {
      dispatch({
        type: 'SET_SEAT_GENDER_CONSTRAINT',
        payload: {
          position,
          requiredGender: 'male',
          isLocked: true,
        }
      });
    });

    // 여학생 전용 좌석 설정
    selectedFemaleSeats.forEach(position => {
      dispatch({
        type: 'SET_SEAT_GENDER_CONSTRAINT',
        payload: {
          position,
          requiredGender: 'female',
          isLocked: true,
        }
      });
    });

    // 제약 해제
    selectedClearSeats.forEach(position => {
      dispatch({
        type: 'REMOVE_SEAT_GENDER_CONSTRAINT',
        payload: position
      });
    });

    // 선택 상태 초기화
    setSelectedMaleSeats([]);
    setSelectedFemaleSeats([]);
    setSelectedClearSeats([]);
    setShowBulkGenderModal(false);
    
    const resultMessages = [];
    if (selectedMaleSeats.length > 0) resultMessages.push(`남학생 전용 ${selectedMaleSeats.length}개`);
    if (selectedFemaleSeats.length > 0) resultMessages.push(`여학생 전용 ${selectedFemaleSeats.length}개`);
    if (selectedClearSeats.length > 0) resultMessages.push(`제약 해제 ${selectedClearSeats.length}개`);
    
    alert(`좌석 설정을 완료했습니다: ${resultMessages.join(', ')}`);
  };

  const maxPairs = Math.floor(state.classroom.cols / 2);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">교실 설정</h3>
        <div className="text-sm text-gray-500">
          {state.classroom.rows} × {state.classroom.cols} ({totalSeats}석)
        </div>
      </div>

      {/* 기본 설정 */}
      <div className="space-y-4">
        <Input
          label="교실 이름"
          type="text"
          value={state.classroom.name}
          onChange={handleClassroomNameChange}
          placeholder="예: 3학년 1반"
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              행 수: {state.classroom.rows}
            </label>
            <input
              type="range"
              min="3"
              max="10"
              value={state.classroom.rows}
              onChange={handleRowsChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>3</span>
              <span>10</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              열 수: {state.classroom.cols}
            </label>
            <input
              type="range"
              min="3"
              max="10"
              value={state.classroom.cols}
              onChange={handleColsChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>3</span>
              <span>10</span>
            </div>
          </div>
        </div>

        {/* 짝 구성 설정 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            짝 구성 설정
          </label>
          <div className="space-y-2">
            {Array.from({ length: maxPairs }, (_, i) => {
              const isChecked = state.classroom.pairColumns.some(
                pair => pair[0] === i * 2 && pair[1] === i * 2 + 1
              );
              
              return (
                <div key={i} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`pair-${i}`}
                    checked={isChecked}
                    onChange={(e) => handlePairColumnChange(i, e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`pair-${i}`} className="ml-2 text-sm text-gray-700">
                    {i * 2 + 1}열 ↔ {i * 2 + 2}열
                  </label>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            체크된 열들이 짝을 이룹니다 (같은 책상에 앉는 관계)
          </p>
        </div>
      </div>

      {/* 좌석 현황 통계 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-3">좌석 현황</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-blue-700">총 좌석:</span>
            <span className="font-medium">{totalSeats}개</span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-700">사용 가능:</span>
            <span className="font-medium">{availableSeats.length}개</span>
          </div>
          <div className="flex justify-between">
            <span className="text-red-700">사용 안함:</span>
            <span className="font-medium">{disabledSeats.length}개</span>
          </div>
          <div className="flex justify-between">
            <span className="text-purple-700">성별 제약:</span>
            <span className="font-medium">{genderConstrainedSeats}개</span>
          </div>
          <div className="flex justify-between">
            <span className="text-orange-700">배치됨:</span>
            <span className="font-medium">{placedStudents}개</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">여유:</span>
            <span className="font-medium">{Math.max(0, availableSeats.length - placedStudents)}개</span>
          </div>
        </div>

        {/* 경고 메시지 */}
        {state.students.length > availableSeats.length && (
          <div className="mt-3 p-2 bg-orange-100 border border-orange-300 rounded text-xs text-orange-700">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            학생 수({state.students.length}명)가 사용 가능한 좌석({availableSeats.length}개)보다 많습니다.
          </div>
        )}
      </div>

      {/* 사용 불가 좌석 관리 */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">사용 불가 좌석 관리</h4>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDisabledSeatsModal(true)}
              icon={Eye}
            >
              목록 보기
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkDisableModal(true)}
              icon={Ban}
            >
              일괄 설정
            </Button>
          </div>
        </div>

        {disabledSeats.length > 0 ? (
          <div className="space-y-2">
            <div className="text-sm text-gray-600 mb-2">
              총 {disabledSeats.length}개의 좌석이 사용 불가로 설정되어 있습니다.
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllDisabledSeats}
                icon={RotateCw}
                className="text-green-600 hover:text-green-700"
              >
                전체 해제
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-4">
            사용 불가로 설정된 좌석이 없습니다.
            <br />
            좌석을 우클릭하거나 "일괄 설정" 버튼을 사용하세요.
          </div>
        )}
      </div>

      {/* 성별 제약 좌석 관리 */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">성별 제약 좌석 관리</h4>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGenderConstraintsModal(true)}
              icon={Eye}
            >
              목록 보기
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkGenderModal(true)}
              icon={User}
            >
              일괄 설정
            </Button>
          </div>
        </div>

        {genderConstrainedSeats > 0 ? (
          <div className="space-y-2">
            <div className="text-sm text-gray-600 mb-2">
              남학생 전용 {maleOnlySeats.length}개, 여학생 전용 {femaleOnlySeats.length}개
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllGenderConstraints}
                icon={RotateCw}
                className="text-gray-600 hover:text-gray-700"
              >
                전체 해제
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-4">
            성별 제약이 설정된 좌석이 없습니다.
            <br />
            좌석을 우클릭하거나 "일괄 설정" 버튼을 사용하세요.
          </div>
        )}
      </div>

      {/* 사용 불가 좌석 목록 모달 */}
      <Modal
        isOpen={showDisabledSeatsModal}
        onClose={() => setShowDisabledSeatsModal(false)}
        title="사용 불가 좌석 목록"
        size="md"
      >
        <div className="space-y-4">
          {disabledSeats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              사용 불가로 설정된 좌석이 없습니다.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {disabledSeats.map((constraint, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      좌석 {constraint.position.row + 1}-{constraint.position.col + 1}
                    </div>
                    {constraint.reason && (
                      <div className="text-sm text-gray-600">
                        사유: {constraint.reason}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      설정일: {constraint.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveDisabledSeat(constraint.position.row, constraint.position.col)}
                    icon={RotateCw}
                    className="text-green-600 hover:text-green-700"
                  >
                    해제
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* 일괄 설정 모달 */}
      <Modal
        isOpen={showBulkDisableModal}
        onClose={() => {
          setShowBulkDisableModal(false);
          setSelectedSeats([]);
          setBulkDisableReason('');
        }}
        title="좌석 일괄 사용 불가 설정"
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkDisableModal(false);
                setSelectedSeats([]);
                setBulkDisableReason('');
              }}
            >
              취소
            </Button>
            <Button
              variant="danger"
              onClick={handleBulkDisable}
              disabled={selectedSeats.length === 0}
            >
              설정 ({selectedSeats.length}개)
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-700">
            사용하지 않을 좌석들을 클릭하여 선택하세요.
          </div>

          {/* 좌석 선택 그리드 */}
          <div
            className="grid gap-1 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 max-w-fit mx-auto"
            style={{
              gridTemplateColumns: `repeat(${state.classroom.cols}, 1fr)`,
            }}
          >
            {Array.from({ length: state.classroom.rows }, (_, row) =>
              Array.from({ length: state.classroom.cols }, (_, col) => {
                const isSelected = selectedSeats.some(s => s.row === row && s.col === col);
                const isAlreadyDisabled = disabledSeats.some(c => 
                  c.position.row === row && c.position.col === col
                );
                const seatNumber = row * state.classroom.cols + col + 1;

                return (
                  <button
                    key={`${row}-${col}`}
                    onClick={() => !isAlreadyDisabled && handleSeatToggle(row, col)}
                    disabled={isAlreadyDisabled}
                    className={`w-12 h-10 text-xs font-medium rounded border-2 transition-all ${
                      isAlreadyDisabled
                        ? 'bg-gray-300 border-gray-400 cursor-not-allowed disabled-seat-pattern'
                        : isSelected
                        ? 'bg-red-200 border-red-400 text-red-800'
                        : 'bg-white border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                    title={isAlreadyDisabled ? '이미 사용 불가로 설정됨' : `좌석 ${row + 1}-${col + 1}`}
                  >
                    {seatNumber}
                  </button>
                );
              })
            )}
          </div>

          <div className="text-sm text-gray-600 text-center">
            선택된 좌석: {selectedSeats.length}개
            {selectedSeats.length > 0 && (
              <div className="mt-1">
                {selectedSeats.map(s => `${s.row + 1}-${s.col + 1}`).join(', ')}
              </div>
            )}
          </div>

          <Input
            label="사용 불가 사유 (선택사항)"
            type="text"
            value={bulkDisableReason}
            onChange={(e) => setBulkDisableReason(e.target.value)}
            placeholder="예: 기둥, 출입구, 교사 책상 등"
            maxLength={50}
          />

          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
            <div className="font-medium mb-1">💡 참고사항</div>
            <div>• 회색으로 표시된 좌석은 이미 사용 불가로 설정된 좌석입니다</div>
            <div>• 선택된 좌석에 학생이 배치되어 있다면 자동으로 제거됩니다</div>
            <div>• 우클릭 메뉴를 통해 개별 좌석도 설정할 수 있습니다</div>
          </div>
        </div>
      </Modal>

      {/* 성별 제약 좌석 목록 모달 */}
      <Modal
        isOpen={showGenderConstraintsModal}
        onClose={() => setShowGenderConstraintsModal(false)}
        title="성별 제약 좌석 목록"
        size="md"
      >
        <div className="space-y-4">
          {genderConstrainedSeats === 0 ? (
            <div className="text-center py-8 text-gray-500">
              성별 제약이 설정된 좌석이 없습니다.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {state.classroom.seatGenderConstraints.map((constraint, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      좌석 {constraint.position.row + 1}-{constraint.position.col + 1}
                    </div>
                    <div className={`text-sm ${
                      constraint.requiredGender === 'male' ? 'text-blue-600' : 'text-pink-600'
                    }`}>
                      {constraint.requiredGender === 'male' ? '♂ 남학생 전용' : '♀ 여학생 전용'}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveGenderConstraint(constraint.position.row, constraint.position.col)}
                    icon={RotateCw}
                    className="text-gray-600 hover:text-gray-700"
                  >
                    해제
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* 성별 제약 일괄 설정 모달 */}
      <Modal
        isOpen={showBulkGenderModal}
        onClose={() => {
          setShowBulkGenderModal(false);
          setSelectedMaleSeats([]);
          setSelectedFemaleSeats([]);
          setSelectedClearSeats([]);
          setActiveGenderTab('male');
        }}
        title="성별 제약 좌석 일괄 설정"
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkGenderModal(false);
                setSelectedMaleSeats([]);
                setSelectedFemaleSeats([]);
                setSelectedClearSeats([]);
                setActiveGenderTab('male');
              }}
            >
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleBulkGenderSet}
              disabled={selectedMaleSeats.length + selectedFemaleSeats.length + selectedClearSeats.length === 0}
            >
              적용 (남:{selectedMaleSeats.length} 여:{selectedFemaleSeats.length} 해제:{selectedClearSeats.length})
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 모드 선택 */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveGenderTab('male')}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 transition-colors ${
                activeGenderTab === 'male'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              ♂ 남학생 전용 ({selectedMaleSeats.length})
            </button>
            <button
              onClick={() => setActiveGenderTab('female')}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 transition-colors ${
                activeGenderTab === 'female'
                  ? 'border-pink-500 bg-pink-50 text-pink-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              ♀ 여학생 전용 ({selectedFemaleSeats.length})
            </button>
            <button
              onClick={() => setActiveGenderTab('clear')}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 transition-colors ${
                activeGenderTab === 'clear'
                  ? 'border-gray-500 bg-gray-50 text-gray-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              🚫 제약 해제 ({selectedClearSeats.length})
            </button>
          </div>

          <div className="text-sm text-gray-700">
            {activeGenderTab === 'male' && '남학생만 앉을 수 있는 좌석을 선택하세요. 다른 탭에서 선택한 좌석도 적용할 때 함께 처리됩니다.'}
            {activeGenderTab === 'female' && '여학생만 앉을 수 있는 좌석을 선택하세요. 다른 탭에서 선택한 좌석도 적용할 때 함께 처리됩니다.'}
            {activeGenderTab === 'clear' && '성별 제약을 해제할 좌석을 선택하세요. 다른 탭에서 선택한 좌석도 적용할 때 함께 처리됩니다.'}
          </div>

          {/* 좌석 선택 그리드 */}
          <div
            className="grid gap-1 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 max-w-fit mx-auto"
            style={{
              gridTemplateColumns: `repeat(${state.classroom.cols}, 1fr)`,
            }}
          >
            {Array.from({ length: state.classroom.rows }, (_, row) =>
              Array.from({ length: state.classroom.cols }, (_, col) => {
                const isMaleSelected = selectedMaleSeats.some(s => s.row === row && s.col === col);
                const isFemaleSelected = selectedFemaleSeats.some(s => s.row === row && s.col === col);
                const isClearSelected = selectedClearSeats.some(s => s.row === row && s.col === col);
                const isDisabled = disabledSeats.some(c => 
                  c.position.row === row && c.position.col === col
                );
                const currentGenderConstraint = state.classroom.seatGenderConstraints.find(
                  c => c.position.row === row && c.position.col === col
                );
                const seatNumber = row * state.classroom.cols + col + 1;

                return (
                  <button
                    key={`${row}-${col}`}
                    onClick={() => !isDisabled && handleGenderSeatToggle(row, col)}
                    disabled={isDisabled}
                    className={`w-12 h-10 text-xs font-medium rounded border-2 transition-all ${
                      isDisabled
                        ? 'bg-gray-300 border-gray-400 cursor-not-allowed disabled-seat-pattern'
                        : isMaleSelected
                        ? 'bg-blue-200 border-blue-400 text-blue-800'
                        : isFemaleSelected
                        ? 'bg-pink-200 border-pink-400 text-pink-800'
                        : isClearSelected
                        ? 'bg-gray-200 border-gray-400 text-gray-800'
                        : currentGenderConstraint?.requiredGender === 'male'
                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : currentGenderConstraint?.requiredGender === 'female'
                        ? 'bg-pink-100 border-pink-300 text-pink-700'
                        : 'bg-white border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                    title={
                      isDisabled ? '사용 불가 좌석' :
                      currentGenderConstraint?.requiredGender === 'male' ? '남학생 전용' :
                      currentGenderConstraint?.requiredGender === 'female' ? '여학생 전용' :
                      `좌석 ${row + 1}-${col + 1}`
                    }
                  >
                    {seatNumber}
                    {currentGenderConstraint && (
                      <div className="text-xs">
                        {currentGenderConstraint.requiredGender === 'male' ? '♂' : '♀'}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="text-sm text-gray-600 text-center">
            선택된 좌석: {selectedSeats.length}개
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
            <div className="font-medium mb-1">💡 참고사항</div>
            <div>• 파란색: 남학생 전용 좌석</div>
            <div>• 분홍색: 여학생 전용 좌석</div>
            <div>• 회색 사선: 사용 불가 좌석 (선택 불가)</div>
            <div>• 우클릭 메뉴를 통해 개별 좌석도 설정할 수 있습니다</div>
          </div>
        </div>
      </Modal>
    </div>
  );
};