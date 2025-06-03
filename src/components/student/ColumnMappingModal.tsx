//src/components/student/ColumnMappingModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Select } from '@/components/common/Select';
import { mapColumnsToStudents, autoDetectColumns } from '@/utils/excelProcessor';
import { ExcelColumnMapping, Student } from '@/types';
import { AlertCircle, CheckCircle } from 'lucide-react';
// 사용법 예시 및 테스트 가이드
/*
엑셀 업로드 기능 테스트 방법:

1. 기본 테스트 파일 생성:
   - Excel에서 새 파일 생성
   - A1: "이름", B1: "성별", C1: "번호"
   - A2: "김민수", B2: "남", C2: "1"
   - A3: "이영희", B3: "여", C3: "2"
   - test.xlsx로 저장

2. 다양한 성별 표기 테스트:
   - "남", "여"
   - "남자", "여자"  
   - "male", "female"
   - "m", "f"
   - "1", "2"

3. 에러 케이스 테스트:
   - 빈 파일
   - 헤더가 없는 파일
   - 잘못된 성별 값
   - 중복된 이름
   - 잘못된 번호 형식

4. 대용량 파일 테스트:
   - 100명 이상의 학생 데이터

5. 특수 문자 테스트:
   - 한글, 영어, 숫자 조합 이름
   - 공백이 포함된 이름
*/

interface ColumnMappingModalProps {
  isOpen: boolean;
  headers: string[];
  data: any[][];
  onClose: () => void;
  onImport: (students: Student[]) => void;
}

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  isOpen,
  headers,
  data,
  onClose,
  onImport,
}) => {
  const [columnMapping, setColumnMapping] = useState<ExcelColumnMapping>({
    nameColumn: '',
    genderColumn: '',
    numberColumn: '',
  });
  const [previewStudents, setPreviewStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 자동 컬럼 매핑 시도
  useEffect(() => {
    const autoMapping = autoDetectColumns(headers);
    setColumnMapping(autoMapping);
  }, [headers]);

  // 미리보기 데이터 생성
  useEffect(() => {
    if (columnMapping.nameColumn && columnMapping.genderColumn) {
      try {
        const previewData = data.slice(0, 5); // 상위 5개만 미리보기
        const students = mapColumnsToStudents(previewData, headers, columnMapping);
        setPreviewStudents(students);
        setError(null);
      } catch (err) {
        setPreviewStudents([]);
        setError(err instanceof Error ? err.message : '미리보기 생성 실패');
      }
    } else {
      setPreviewStudents([]);
      setError(null);
    }
  }, [columnMapping, data, headers]);

  const handleMappingChange = (field: keyof ExcelColumnMapping, value: string) => {
    setColumnMapping(prev => ({ ...prev, [field]: value }));
  };

  const handleImport = async () => {
    if (!columnMapping.nameColumn || !columnMapping.genderColumn) {
      setError('이름과 성별 컬럼을 선택해주세요.');
      return;
    }

    setIsProcessing(true);
    try {
      const students = mapColumnsToStudents(data, headers, columnMapping);
      onImport(students);
    } catch (err) {
      setError(err instanceof Error ? err.message : '가져오기 실패');
      setIsProcessing(false);
    }
  };

  const canImport = columnMapping.nameColumn && columnMapping.genderColumn && previewStudents.length > 0;

  const headerOptions = [
    { value: '', label: '선택하세요' },
    ...headers.map(header => ({ value: header, label: header }))
  ];

  const numberHeaderOptions = [
    { value: '', label: '선택하세요 (선택사항)' },
    ...headers.map(header => ({ value: header, label: header }))
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="컬럼 매핑 설정"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={!canImport}
            loading={isProcessing}
          >
            가져오기 ({data.length}명)
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* 컬럼 매핑 설정 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="이름 컬럼 *"
            value={columnMapping.nameColumn}
            onChange={(e) => handleMappingChange('nameColumn', e.target.value)}
            options={headerOptions}
          />

          <Select
            label="성별 컬럼 *"
            value={columnMapping.genderColumn}
            onChange={(e) => handleMappingChange('genderColumn', e.target.value)}
            options={headerOptions}
          />

          <Select
            label="번호 컬럼"
            value={columnMapping.numberColumn}
            onChange={(e) => handleMappingChange('numberColumn', e.target.value)}
            options={numberHeaderOptions}
          />
        </div>

        {/* 상태 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700 whitespace-pre-line">{error}</div>
            </div>
          </div>
        )}

        {previewStudents.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div className="text-sm text-green-700">
                {previewStudents.length}명의 학생 데이터를 성공적으로 인식했습니다.
              </div>
            </div>
          </div>
        )}

        {/* 미리보기 테이블 */}
        {previewStudents.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              미리보기 (상위 5개 행)
            </h4>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      이름
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      성별
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      번호
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewStudents.map((student, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          student.gender === 'male' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-pink-100 text-pink-800'
                        }`}>
                          {student.gender === 'male' ? '♂ 남' : '♀ 여'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.number || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {data.length > 5 && (
              <div className="text-center mt-2 text-sm text-gray-500">
                ... 외 {data.length - 5}명 더
              </div>
            )}
          </div>
        )}

        {/* 도움말 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">🔧 매핑 도움말</h4>
          <div className="text-xs text-blue-800 space-y-1">
            <div>• 시스템이 자동으로 컬럼을 감지하지만, 수동으로 수정할 수 있습니다</div>
            <div>• 이름과 성별은 필수 항목이며, 번호는 선택사항입니다</div>
            <div>• 성별 데이터가 올바른 형식인지 미리보기에서 확인하세요</div>
            <div>• 문제가 있다면 엑셀 파일을 수정 후 다시 업로드하세요</div>
          </div>
        </div>
      </div>
    </Modal>
  );
};