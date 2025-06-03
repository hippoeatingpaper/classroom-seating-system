//src/components/classroom/SeatContextMenu.tsx
import React, { useEffect, useRef, useState } from 'react';
import { User, UserX, Ban, RotateCw, AlertCircle, X } from 'lucide-react';
import { SeatGenderConstraint, SeatUsageConstraint } from '@/types';
import { useAppContext } from '@/context/AppContext';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';

interface SeatContextMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  seatPosition: { row: number; col: number } | null;
  onClose: () => void;
}

export const SeatContextMenu: React.FC<SeatContextMenuProps> = ({
  visible,
  position,
  seatPosition,
  onClose,
}) => {
  const { state, dispatch } = useAppContext();
  const menuRef = useRef<HTMLDivElement>(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [disableReason, setDisableReason] = useState('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        // 사유 입력 모달이 열려있으면 컨텍스트 메뉴를 닫지 않음
        if (!showReasonModal) {
          onClose();
        }
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, onClose, showReasonModal]);

  // 컨텍스트 메뉴가 닫힐 때 모달도 함께 닫기
  useEffect(() => {
    if (!visible) {
      setShowReasonModal(false);
      setDisableReason('');
    }
  }, [visible]);

  if (!visible || !seatPosition) return null;

  const currentGenderConstraint = state.classroom.seatGenderConstraints.find(
    c => c.position.row === seatPosition.row && c.position.col === seatPosition.col
  );

  const currentUsageConstraint = state.classroom.seatUsageConstraints.find(
    c => c.position.row === seatPosition.row && c.position.col === seatPosition.col
  );

  const isDisabled = currentUsageConstraint?.isDisabled || false;

  const handleSetGenderConstraint = (gender: 'male' | 'female' | null) => {
    if (isDisabled) {
      alert('사용하지 않는 좌석에는 성별 제약조건을 설정할 수 없습니다.');
      return;
    }

    const constraint: SeatGenderConstraint = {
      position: seatPosition,
      requiredGender: gender,
      isLocked: gender !== null,
    };

    dispatch({ type: 'SET_SEAT_GENDER_CONSTRAINT', payload: constraint });
    onClose();
  };

  const handleSetUsageConstraint = (disabled: boolean, reason?: string) => {
    const constraint: SeatUsageConstraint = {
      position: seatPosition,
      isDisabled: disabled,
      reason: reason || undefined,
      createdAt: new Date(),
    };

    if (disabled) {
      dispatch({ type: 'SET_SEAT_USAGE_CONSTRAINT', payload: constraint });
    } else {
      dispatch({ type: 'REMOVE_SEAT_USAGE_CONSTRAINT', payload: seatPosition });
    }
    
    onClose();
  };

  const handleDisableSeat = () => {
    setShowReasonModal(true);
    // 컨텍스트 메뉴는 열어둠 (닫지 않음)
  };

  const handleConfirmDisable = () => {
    handleSetUsageConstraint(true, disableReason.trim() || undefined);
    setShowReasonModal(false);
    setDisableReason('');
    // 완료 후 컨텍스트 메뉴 닫기
    onClose();
  };

  const handleCancelDisable = () => {
    setShowReasonModal(false);
    setDisableReason('');
    // 취소 시에는 컨텍스트 메뉴는 유지
  };

  const menuStyle = {
    left: Math.min(position.x, window.innerWidth - 250), // 화면 밖으로 나가지 않도록
    top: Math.min(position.y, window.innerHeight - 300),
  };

  return (
    <>
      <div
        ref={menuRef}
        className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-40 min-w-[220px]"
        style={menuStyle}
      >
        <div className="px-3 py-2 text-sm font-medium text-gray-700 border-b border-gray-100">
          좌석 설정 ({seatPosition.row + 1}-{seatPosition.col + 1})
        </div>
        
        {/* 좌석 사용 섹션 */}
        <div className="py-1">
          <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">
            좌석 사용
          </div>
          
          {!isDisabled ? (
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2"
              onClick={handleDisableSeat}
            >
              <Ban className="w-4 h-4 text-red-600" />
              <span className="text-red-600">좌석 사용 안함</span>
            </button>
          ) : (
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-green-50 flex items-center gap-2"
              onClick={() => handleSetUsageConstraint(false)}
            >
              <RotateCw className="w-4 h-4 text-green-600" />
              <span className="text-green-600">좌석 사용 재개</span>
              <span className="ml-auto text-green-600">✓</span>
            </button>
          )}
          
          {currentUsageConstraint?.reason && (
            <div className="px-3 py-1 text-xs text-gray-500 italic">
              사유: {currentUsageConstraint.reason}
            </div>
          )}
        </div>

        {/* 성별 제약 섹션 */}
        {!isDisabled && (
          <div className="py-1 border-t border-gray-100">
            <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">
              성별 제약
            </div>
            
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2"
              onClick={() => handleSetGenderConstraint('male')}
            >
              <User className="w-4 h-4 text-blue-600" />
              남학생만 배치
              {currentGenderConstraint?.requiredGender === 'male' && (
                <span className="ml-auto text-blue-600">✓</span>
              )}
            </button>
            
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-pink-50 flex items-center gap-2"
              onClick={() => handleSetGenderConstraint('female')}
            >
              <User className="w-4 h-4 text-pink-600" />
              여학생만 배치
              {currentGenderConstraint?.requiredGender === 'female' && (
                <span className="ml-auto text-pink-600">✓</span>
              )}
            </button>
            
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              onClick={() => handleSetGenderConstraint(null)}
            >
              <UserX className="w-4 h-4 text-gray-600" />
              제한 해제
              {!currentGenderConstraint?.requiredGender && (
                <span className="ml-auto text-gray-600">✓</span>
              )}
            </button>
          </div>
        )}

        {isDisabled && (
          <div className="px-3 py-2 text-xs text-orange-600 bg-orange-50 mx-2 my-1 rounded">
            <AlertCircle className="w-3 h-3 inline mr-1" />
            사용하지 않는 좌석입니다
          </div>
        )}
      </div>

      {/* 사용 안함 사유 입력 모달 */}
      {showReasonModal && (
        <div 
          className="fixed inset-0 overflow-y-auto"
          style={{ zIndex: 60 }}
        >
          <div className="flex min-h-screen items-center justify-center p-4">
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" 
              onClick={handleCancelDisable} 
            />
            
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">좌석 사용 안함 설정</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelDisable}
                  className="p-1 border-none hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-4">
                  <p className="text-sm text-gray-700">
                    좌석 ({seatPosition.row + 1}-{seatPosition.col + 1})을 사용하지 않도록 설정합니다.
                  </p>
                  
                  <Input
                    label="사유 (선택사항)"
                    type="text"
                    value={disableReason}
                    onChange={(e) => setDisableReason(e.target.value)}
                    placeholder="예: 기둥, 출입구, 교사 책상 등"
                    maxLength={50}
                    autoFocus
                  />
                  
                  <div className="text-xs text-gray-500">
                    • 이 좌석에 배치된 학생이 있다면 자동으로 제거됩니다
                    • 자동 배치 시 이 좌석은 제외됩니다
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
                <Button
                  variant="outline"
                  onClick={handleCancelDisable}
                >
                  취소
                </Button>
                <Button
                  variant="danger"
                  onClick={handleConfirmDisable}
                >
                  설정
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};