//src/components/student/ExcelUploader.tsx
import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { ColumnMappingModal } from './ColumnMappingModal';
import { parseExcelFile, validateExcelFile } from '@/utils/excelProcessor';
import { ExcelImportResult } from '@/types';

interface ExcelUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (students: any[]) => void;
}

export const ExcelUploader: React.FC<ExcelUploaderProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<Omit<ExcelImportResult, 'previewData' | 'columnMapping'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showColumnMapping, setShowColumnMapping] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const validationError = validateExcelFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setFile(selectedFile);
    setError(null);
    setLoading(true);

    try {
      const result = await parseExcelFile(selectedFile);
      setParseResult(result);
      setShowColumnMapping(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      // 파일 input에 설정
      const event = { target: { files: [droppedFile] } } as any;
      handleFileChange(event);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParseResult(null);
    setError(null);
    setShowColumnMapping(false);
    onClose();
  };

  const handleImportComplete = (students: any[]) => {
    onImport(students);
    handleClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !showColumnMapping}
        onClose={handleClose}
        title="엑셀 파일에서 학생 목록 가져오기"
        size="md"
      >
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <div className="text-lg font-medium text-gray-900 mb-2">
              엑셀 파일을 선택하거나 드래그하세요
            </div>
            <div className="text-sm text-gray-500 mb-4">
              .xlsx, .xls 파일 지원 (최대 10MB)
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="excel-file-input"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('excel-file-input')?.click()}
              icon={Upload}
              loading={loading}
            >
              파일 선택
            </Button>
          </div>

          {file && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-blue-900">
                선택된 파일: {file.name}
              </div>
              <div className="text-xs text-blue-700">
                크기: {(file.size / 1024).toFixed(1)} KB
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-1">
            <div>• 첫 번째 행은 헤더로 인식됩니다</div>
            <div>• 이름, 성별 컬럼은 필수입니다</div>
            <div>• 성별은 '남/여' 또는 'male/female'로 입력해주세요</div>
            <div>• 번호 컬럼은 선택사항입니다</div>
          </div>
        </div>
      </Modal>

      {showColumnMapping && parseResult && (
        <ColumnMappingModal
          isOpen={showColumnMapping}
          headers={parseResult.headers}
          data={parseResult.data}
          onClose={() => setShowColumnMapping(false)}
          onImport={handleImportComplete}
        />
      )}
    </>
  );
};