import React, { useState, useEffect } from 'react';
import { Users, UserX, MapPin, Rows, AlertTriangle, Shuffle } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Select } from '@/components/common/Select';
import { Student, ClassroomConfig } from '@/types';
import { useAppContext } from '@/context/AppContext';
import { generateConstraintColor } from '@/utils/idGenerator';

interface ConstraintModalProps {
  isOpen: boolean;
  type: 'pair_required' | 'pair_prohibited' | 'distance' | 'row_exclusion';
  students: Student[];
  classroom: ClassroomConfig;
  onClose: () => void;
}

export const ConstraintModal: React.FC<ConstraintModalProps> = ({
  isOpen,
  type,
  students,
  classroom,
  onClose,
}) => {
  const { state, dispatch } = useAppContext();
  
  // 기존 상태들 (짝 강제, 거리 유지용)
  const [student1Id, setStudent1Id] = useState('');
  const [student2Id, setStudent2Id] = useState('');
  const [distance, setDistance] = useState(2);
  
  // 짝 방지용 상태들
  const [baseStudentId, setBaseStudentId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  
  // 줄 제외용 상태들
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [excludedRows, setExcludedRows] = useState(1);
  
  const [error, setError] = useState<string | null>(null);

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setStudent1Id('');
      setStudent2Id('');
      setDistance(2);
      setError(null);
      setBaseStudentId('');
      setSelectedStudentIds(new Set());
      setSelectedStudentId('');
      setExcludedRows(1);
    }
  }, [isOpen]);

  const getModalConfig = () => {
    switch (type) {
      case 'pair_required':
        return {
          title: '짝 강제 제약조건 추가',
          icon: Users,
          color: 'text-green-600',
          description: '선택한 두 학생이 반드시 짝이 되도록 설정합니다.',
          actionText: '짝 강제 추가'
        };
      case 'pair_prohibited':
        return {
          title: '짝 방지 제약조건 추가',
          icon: UserX,
          color: 'text-red-600',
          description: '선택한 학생이 지정된 학생들과 짝이 되지 않도록 설정합니다.',
          actionText: '짝 방지 추가'
        };
      case 'distance':
        return {
          title: '거리 유지 제약조건 추가',
          icon: MapPin,
          color: 'text-orange-600',
          description: '선택한 두 학생이 지정된 거리 이상 떨어져 앉도록 설정합니다.',
          actionText: '거리 유지 추가'
        };
      case 'row_exclusion':
        return {
          title: '줄 제외 제약조건 추가',
          icon: Rows,
          color: 'text-purple-600',
          description: '선택한 학생이 뒤에서부터 지정된 줄에 앉지 않도록 설정합니다.',
          actionText: '줄 제외 추가'
        };
    }
  };

  const config = getModalConfig();
  const Icon = config.icon;

  // 학생 옵션 생성
  const studentOptions = [
    { value: '', label: '학생을 선택하세요' },
    ...students.map(student => ({
      value: student.id,
      label: `${student.name} (${student.gender === 'male' ? '남' : '여'}${student.number ? `, ${student.number}번` : ''})`
    }))
  ];

  // 두 번째 학생 옵션 (첫 번째 학생 제외)
  const student2Options = [
    { value: '', label: '학생을 선택하세요' },
    ...students
      .filter(student => student.id !== student1Id)
      .map(student => ({
        value: student.id,
        label: `${student.name} (${student.gender === 'male' ? '남' : '여'}${student.number ? `, ${student.number}번` : ''})`
      }))
  ];

  const validateInput = (): string | null => {
    if (type === 'row_exclusion') {
      if (!selectedStudentId) {
        return '학생을 선택해주세요.';
      }
      
      if (excludedRows < 1 || excludedRows >= classroom.rows) {
        return `제외할 줄 수는 1~${classroom.rows - 1} 범위 내에서 설정해주세요.`;
      }
      
      // 기존 제약조건 확인
      const existing = state.constraints.rowExclusions.find(c => c.studentId === selectedStudentId);
      if (existing) {
        return '이 학생에게는 이미 줄 제외 제약조건이 설정되어 있습니다.';
      }
      
      return null;
    }

    if (type === 'pair_prohibited') {
      if (!baseStudentId) {
        return '기준 학생을 선택해주세요.';
      }
      if (selectedStudentIds.size === 0) {
        return '짝이 되면 안 되는 학생을 최소 1명 선택해주세요.';
      }

      // 중복 제약조건 체크
      const duplicateStudents: string[] = [];
      selectedStudentIds.forEach(studentId => {
        if (hasExistingConstraint(baseStudentId, studentId)) {
          const student = students.find(s => s.id === studentId);
          if (student) duplicateStudents.push(student.name);
        }
      });

      if (duplicateStudents.length === selectedStudentIds.size) {
        return '선택한 모든 학생과 이미 짝 방지 제약조건이 설정되어 있습니다.';
      }

      if (duplicateStudents.length > 0) {
        return `${duplicateStudents.join(', ')}와는 이미 짝 방지 제약조건이 설정되어 있습니다. 다른 학생들만 추가됩니다.`;
      }

      // 짝 강제 제약조건과의 충돌 체크
      const conflictStudents: string[] = [];
      selectedStudentIds.forEach(studentId => {
        const hasRequiredConstraint = state.constraints.pairRequired.some(c =>
          (c.students[0] === baseStudentId && c.students[1] === studentId) ||
          (c.students[0] === studentId && c.students[1] === baseStudentId)
        );
        if (hasRequiredConstraint) {
          const student = students.find(s => s.id === studentId);
          if (student) conflictStudents.push(student.name);
        }
      });

      if (conflictStudents.length > 0) {
        return `${conflictStudents.join(', ')}와는 이미 짝 강제 제약조건이 설정되어 있어 짝 방지를 설정할 수 없습니다.`;
      }

      return null;
    }

    // 기존 검증 로직 (짝 강제, 거리 유지)
    if (!student1Id || !student2Id) {
      return '두 명의 학생을 모두 선택해주세요.';
    }

    if (student1Id === student2Id) {
      return '같은 학생을 선택할 수 없습니다.';
    }

    // 기존 제약조건과 중복 체크
    const existingPairRequired = state.constraints.pairRequired.find(c =>
      (c.students[0] === student1Id && c.students[1] === student2Id) ||
      (c.students[0] === student2Id && c.students[1] === student1Id)
    );

    const existingPairProhibited = state.constraints.pairProhibited.find(c =>
      (c.students[0] === student1Id && c.students[1] === student2Id) ||
      (c.students[0] === student2Id && c.students[1] === student1Id)
    );

    const existingDistance = state.constraints.distanceRules.find(c =>
      (c.students[0] === student1Id && c.students[1] === student2Id) ||
      (c.students[0] === student2Id && c.students[1] === student1Id)
    );

    if (type === 'pair_required' && existingPairRequired) {
      return '이미 짝 강제 제약조건이 설정된 학생들입니다.';
    }

    if (type === 'distance' && existingDistance) {
      return '이미 거리 유지 제약조건이 설정된 학생들입니다.';
    }

    // 충돌하는 제약조건 체크
    if (type === 'pair_required' && existingPairProhibited) {
      return '이 학생들에게는 이미 짝 방지 제약조건이 설정되어 있습니다.';
    }

    if (type === 'distance' && distance < 1) {
      return '거리는 1 이상이어야 합니다.';
    }

    if (type === 'distance' && distance > 10) {
      return '거리는 10 이하로 설정해주세요.';
    }

    // 거리 제약과 짝 강제의 충돌 체크
    if (type === 'distance' && distance > 1 && existingPairRequired) {
      return '짝 강제가 설정된 학생들에게는 거리 2 이상을 설정할 수 없습니다.';
    }

    if (type === 'pair_required' && existingDistance && existingDistance.minDistance > 1) {
      return '거리 유지가 설정된 학생들에게는 짝 강제를 설정할 수 없습니다.';
    }

    return null;
  };

  const handleSubmit = () => {
    const validationError = validateInput();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (type === 'row_exclusion') {
      dispatch({
        type: 'ADD_ROW_EXCLUSION_CONSTRAINT',
        payload: {
          studentId: selectedStudentId,
          excludedRowsFromBack: excludedRows,
        }
      });
    } else if (type === 'pair_prohibited') {
      // 중복되지 않은 학생들만 필터링
      const newConstraints: string[] = [];
      selectedStudentIds.forEach(selectedId => {
        if (!hasExistingConstraint(baseStudentId, selectedId)) {
          const studentPair = [baseStudentId, selectedId] as [string, string];
          dispatch({
            type: 'ADD_PAIR_CONSTRAINT',
            payload: {
              type: 'prohibited',
              constraint: {
                students: studentPair,
                type: 'prohibited',
                color: generateConstraintColor(),
              }
            }
          });
          const student = students.find(s => s.id === selectedId);
          if (student) newConstraints.push(student.name);
        }
      });

      // 성공 메시지 표시 (선택사항)
      if (newConstraints.length > 0) {
        setTimeout(() => {
          const baseStudent = students.find(s => s.id === baseStudentId);
          const message = `${baseStudent?.name}와 ${newConstraints.join(', ')}의 짝 방지 제약조건이 추가되었습니다.`;
          console.log(message);
        }, 100);
      }
    } else {
      // 기존 로직 (짝 강제, 거리 유지)
      const studentPair = [student1Id, student2Id] as [string, string];

      if (type === 'pair_required') {
        dispatch({
          type: 'ADD_PAIR_CONSTRAINT',
          payload: {
            type: 'required',
            constraint: {
              students: studentPair,
              type: 'required',
              color: generateConstraintColor(),
            }
          }
        });
      } else if (type === 'distance') {
        dispatch({
          type: 'ADD_DISTANCE_CONSTRAINT',
          payload: {
            students: studentPair,
            minDistance: distance,
          }
        });
      }
    }

    onClose();
  };

  const handleRandomSelect = () => {
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    
    if (type === 'row_exclusion') {
      if (shuffled.length >= 1) {
        setSelectedStudentId(shuffled[0].id);
        setError(null);
      }
    } else if (type === 'pair_prohibited') {
      if (shuffled.length >= 2) {
        setBaseStudentId(shuffled[0].id);
        const newSelected = new Set<string>();
        newSelected.add(shuffled[1].id);
        setSelectedStudentIds(newSelected);
        setError(null);
      }
    } else {
      if (shuffled.length >= 2) {
        setStudent1Id(shuffled[0].id);
        setStudent2Id(shuffled[1].id);
        setError(null);
      }
    }
  };

  // 체크박스 토글 핸들러
  const handleStudentToggle = (studentId: string) => {
    const newSelected = new Set(selectedStudentIds);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudentIds(newSelected);
    setError(null);
  };

  // 기존 제약조건 확인 함수
  const hasExistingConstraint = (student1Id: string, student2Id: string): boolean => {
    return state.constraints.pairProhibited.some(c =>
      (c.students[0] === student1Id && c.students[1] === student2Id) ||
      (c.students[0] === student2Id && c.students[1] === student1Id)
    );
  };

  const getSelectedStudentNames = () => {
    const student1 = students.find(s => s.id === student1Id);
    const student2 = students.find(s => s.id === student2Id);
    return {
      student1: student1?.name || '',
      student2: student2?.name || ''
    };
  };

  const selectedNames = getSelectedStudentNames();

  // 버튼 비활성화 조건
  const isSubmitDisabled = () => {
    switch (type) {
      case 'row_exclusion':
        return !selectedStudentId;
      case 'pair_prohibited':
        return !baseStudentId || selectedStudentIds.size === 0;
      default:
        return !student1Id || !student2Id;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={config.title}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitDisabled()}
          >
            {config.actionText}
            {type === 'pair_prohibited' && selectedStudentIds.size > 0 && ` (${selectedStudentIds.size}개)`}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* 설명 */}
        <div className={`p-4 rounded-lg bg-gray-50 border-l-4 ${
          type === 'pair_required' ? 'border-green-500' :
          type === 'pair_prohibited' ? 'border-red-500' : 
          type === 'distance' ? 'border-orange-500' : 'border-purple-500'
        }`}>
          <div className="flex items-start gap-3">
            <Icon className={`w-5 h-5 ${config.color} flex-shrink-0 mt-0.5`} />
            <div>
              <div className={`font-medium ${config.color} mb-1`}>
                {config.title}
              </div>
              <div className="text-sm text-gray-600">
                {config.description}
              </div>
            </div>
          </div>
        </div>

        {/* 학생 선택 섹션 */}
        {type === 'row_exclusion' ? (
          // 줄 제외용 UI
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">줄 제외 설정</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRandomSelect}
                disabled={students.length === 0}
                icon={Shuffle}
              >
                랜덤 선택
              </Button>
            </div>
            
            <Select
              label="학생 선택"
              value={selectedStudentId}
              onChange={(e) => {
                setSelectedStudentId(e.target.value);
                setError(null);
              }}
              options={studentOptions}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                뒤에서부터 제외할 줄 수: {excludedRows}줄
              </label>
              <input
                type="range"
                min="1"
                max={Math.max(1, classroom.rows - 1)}
                value={excludedRows}
                onChange={(e) => {
                  setExcludedRows(parseInt(e.target.value));
                  setError(null);
                }}
                className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1줄</span>
                <span>{Math.floor((classroom.rows - 1) / 2)}줄</span>
                <span>{classroom.rows - 1}줄</span>
              </div>
              <div className="text-sm text-gray-600 mt-2">
                {excludedRows === 1 && '맨 뒤 1줄에 앉지 않음'}
                {excludedRows === 2 && '뒤에서 1, 2번째 줄에 앉지 않음'}
                {excludedRows > 2 && `뒤에서 1~${excludedRows}번째 줄에 앉지 않음`}
              </div>
            </div>

            {/* 시각적 미리보기 */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <h5 className="text-sm font-medium text-purple-900 mb-2">교실 배치 미리보기</h5>
              <div className="flex gap-1">
                {Array.from({ length: classroom.rows }, (_, i) => {
                  const rowNumber = i + 1;
                  const isExcluded = i >= (classroom.rows - excludedRows);
                  
                  return (
                    <div 
                      key={i} 
                      className={`w-8 h-6 text-xs flex items-center justify-center rounded ${
                        isExcluded 
                          ? 'bg-purple-300 text-purple-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}
                      title={`${rowNumber}번 줄${isExcluded ? ' (제외)' : ''}`}
                    >
                      {rowNumber}
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-purple-700 mt-2">
                보라색: 제외 대상 줄 | 회색: 배치 가능 줄
              </div>
            </div>
          </div>
        ) : type === 'pair_prohibited' ? (
          // 짝 방지용 UI
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">짝 방지 설정</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRandomSelect}
                disabled={students.length < 2}
                icon={Shuffle}
              >
                랜덤 선택
              </Button>
            </div>
            
            {/* 기준 학생 선택 */}
            <div>
              <Select
                label="기준 학생"
                value={baseStudentId}
                onChange={(e) => {
                  setBaseStudentId(e.target.value);
                  setSelectedStudentIds(new Set());
                  setError(null);
                }}
                options={studentOptions}
              />
              <p className="text-xs text-gray-500 mt-1">
                이 학생과 짝이 되면 안 되는 학생들을 아래에서 선택하세요
              </p>
            </div>

            {/* 체크리스트 */}
            {baseStudentId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  짝이 되면 안 되는 학생들 ({selectedStudentIds.size}명 선택됨)
                </label>

                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      const availableStudents = students
                        .filter(s => s.id !== baseStudentId)
                        .map(s => s.id);
                      setSelectedStudentIds(new Set(availableStudents));
                      setError(null);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800"
                    disabled={students.filter(s => s.id !== baseStudentId).length === 0}
                  >
                    전체 선택
                  </button>
                  
                  <span className="text-xs text-gray-400">|</span>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudentIds(new Set());
                      setError(null);
                    }}
                    className="text-xs text-gray-600 hover:text-gray-800"
                    disabled={selectedStudentIds.size === 0}
                  >
                    전체 해제
                  </button>
                </div>
                
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
                  {students
                    .filter(student => student.id !== baseStudentId)
                    .map(student => {
                      const isSelected = selectedStudentIds.has(student.id);
                      const hasConstraint = hasExistingConstraint(baseStudentId, student.id);
                      
                      return (
                        <div
                          key={student.id}
                          className={`flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 ${
                            hasConstraint ? 'bg-yellow-50 border border-yellow-200' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id={`student-${student.id}`}
                              checked={isSelected}
                              onChange={() => handleStudentToggle(student.id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label
                              htmlFor={`student-${student.id}`}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <span className="font-medium text-gray-900">{student.name}</span>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                student.gender === 'male' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-pink-100 text-pink-800'
                              }`}>
                                {student.gender === 'male' ? '♂' : '♀'}
                              </span>
                              {student.number && (
                                <span className="text-xs text-gray-500">#{student.number}</span>
                              )}
                            </label>
                          </div>
                          
                          {hasConstraint && (
                            <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                              이미 설정됨
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
                
                {students.filter(s => s.id !== baseStudentId).length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    선택할 수 있는 다른 학생이 없습니다
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // 기존 UI (짝 강제, 거리 유지용)
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">학생 선택</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRandomSelect}
                disabled={students.length < 2}
                icon={Shuffle}
              >
                랜덤 선택
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <Select
                label="첫 번째 학생"
                value={student1Id}
                onChange={(e) => {
                  setStudent1Id(e.target.value);
                  setError(null);
                }}
                options={studentOptions}
              />

              <Select
                label="두 번째 학생"
                value={student2Id}
                onChange={(e) => {
                  setStudent2Id(e.target.value);
                  setError(null);
                }}
                options={student2Options}
                disabled={!student1Id}
              />
            </div>
          </div>
        )}

        {/* 거리 설정 (거리 제약조건인 경우) */}
        {type === 'distance' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              최소 거리: {distance}칸
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={distance}
              onChange={(e) => {
                setDistance(parseInt(e.target.value));
                setError(null);
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1칸</span>
              <span>5칸</span>
              <span>10칸</span>
            </div>
            <div className="text-sm text-gray-600">
              {distance === 1 && '인접하지 않도록 배치'}
              {distance === 2 && '1명 이상 사이에 두고 배치'}
              {distance === 3 && '2명 이상 사이에 두고 배치'}
              {distance > 3 && `${distance - 1}명 이상 사이에 두고 배치`}
            </div>
          </div>
        )}

        {/* 미리보기 섹션들 */}
        {/* 줄 제외 미리보기 */}
        {type === 'row_exclusion' && selectedStudentId && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-medium text-purple-900 mb-2">설정 미리보기</h4>
            <div className="text-sm text-purple-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">
                  {students.find(s => s.id === selectedStudentId)?.name}
                </span>
                <Rows className="w-4 h-4 text-purple-600" />
                <span>뒤 {excludedRows}줄 제외</span>
              </div>
              <div>
                → {Array.from({ length: excludedRows }, (_, i) => classroom.rows - i).reverse().join(', ')}번 줄에 앉지 않습니다
              </div>
            </div>
          </div>
        )}

        {/* 기존 미리보기들 */}
        {type !== 'pair_prohibited' && type !== 'row_exclusion' && student1Id && student2Id && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">설정 미리보기</h4>
            <div className="text-sm text-blue-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{selectedNames.student1}</span>
                {type === 'pair_required' && <Users className="w-4 h-4 text-green-600" />}
                {type === 'distance' && <MapPin className="w-4 h-4 text-orange-600" />}
                <span className="font-medium">{selectedNames.student2}</span>
              </div>
              <div>
                {type === 'pair_required' && '→ 반드시 짝이 되도록 배치됩니다'}
                {type === 'distance' && `→ 최소 ${distance}칸 이상 떨어뜨려 배치됩니다`}
              </div>
            </div>
          </div>
        )}

        {/* 미리보기 (짝 방지용) */}
        {type === 'pair_prohibited' && baseStudentId && selectedStudentIds.size > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-900 mb-2">설정 미리보기</h4>
            <div className="text-sm text-red-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">
                  {students.find(s => s.id === baseStudentId)?.name}
                </span>
                <UserX className="w-4 h-4 text-red-600" />
                <span>다음 학생들과 짝 방지:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.from(selectedStudentIds).map(studentId => {
                  const student = students.find(s => s.id === studentId);
                  return (
                    <span
                      key={studentId}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800"
                    >
                      {student?.name}
                    </span>
                  );
                })}
              </div>
              <div className="mt-2 text-xs">
                → {selectedStudentIds.size}개의 짝 방지 제약조건이 생성됩니다
              </div>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          </div>
        )}

        {/* 주의사항 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h4 className="font-medium text-yellow-900 mb-2">⚠️ 주의사항</h4>
          <div className="text-sm text-yellow-800 space-y-1">
            {type === 'pair_required' && (
              <>
                <div>• 짝 강제는 교실의 짝 구성 설정을 따릅니다</div>
                <div>• 성별 제약이 있는 좌석과 충돌할 수 있습니다</div>
                <div>• 거리 유지 제약조건과 동시 설정할 수 없습니다</div>
              </>
            )}
            {type === 'pair_prohibited' && (
              <>
                <div>• 짝 방지는 같은 책상에 앉지 않도록 합니다</div>
                <div>• 짝 강제 제약조건과 동시 설정할 수 없습니다</div>
                <div>• 한 번에 여러 학생과의 짝 방지를 설정할 수 있습니다</div>
              </>
            )}
            {type === 'distance' && (
              <>
                <div>• 거리가 클수록 배치가 어려워집니다</div>
                <div>• 짝 강제 제약조건과 동시 설정할 수 없습니다</div>
                <div>• 교실 크기를 고려하여 적절한 거리를 설정하세요</div>
              </>
            )}
            {type === 'row_exclusion' && (
              <>
                <div>• 뒤쪽 줄에 앉기 어려운 학생에게 적용하세요</div>
                <div>• 시력, 집중력 등을 고려한 배치에 유용합니다</div>
                <div>• 너무 많은 줄을 제외하면 배치가 어려워집니다</div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};