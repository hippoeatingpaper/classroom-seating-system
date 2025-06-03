//src/utils/excelUploader.ts
import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, X } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { ColumnMappingModal } from '@/components/student/ColumnMappingModal';
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
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = async (selectedFile: File) => {
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

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      handleFileChange(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileChange(droppedFile);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParseResult(null);
    setError(null);
    setShowColumnMapping(false);
    setIsDragOver(false);
    onClose();
  };

  const handleImportComplete = (students: any[]) => {
    onImport(students);
    handleClose();
  };

  const removeFile = () => {
    setFile(null);
    setParseResult(null);
    setError(null);
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
          {/* 파일 업로드 영역 */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
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
              onChange={handleFileInputChange}
              className="hidden"
              id="excel-file-input"
              disabled={loading}
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('excel-file-input')?.click()}
              icon={Upload}
              loading={loading}
              disabled={loading}
            >
              파일 선택
            </Button>
          </div>

          {/* 선택된 파일 정보 */}
          {file && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-blue-900">
                    {file.name}
                  </div>
                  <div className="text-xs text-blue-700">
                    크기: {(file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={removeFile}
                  className="border-none hover:bg-blue-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700 whitespace-pre-line">{error}</div>
              </div>
            </div>
          )}

          {/* 사용법 안내 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">📋 사용법 안내</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <div>• 첫 번째 행은 헤더(컬럼명)로 인식됩니다</div>
              <div>• <strong>이름</strong>과 <strong>성별</strong> 컬럼은 필수입니다</div>
              <div>• 성별은 다음 중 아무거나: <code>남/여</code>, <code>남자/여자</code>, <code>male/female</code>, <code>m/f</code>, <code>1/2</code></div>
              <div>• 번호 컬럼은 선택사항입니다</div>
              <div>• 빈 행은 자동으로 제외됩니다</div>
            </div>
          </div>

          {/* 예시 템플릿 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-yellow-900 mb-2">💡 엑셀 파일 예시</h4>
            <div className="text-xs text-yellow-800">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-yellow-100">
                    <th className="border border-yellow-300 px-2 py-1">이름</th>
                    <th className="border border-yellow-300 px-2 py-1">성별</th>
                    <th className="border border-yellow-300 px-2 py-1">번호</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-yellow-300 px-2 py-1">김민수</td>
                    <td className="border border-yellow-300 px-2 py-1">남</td>
                    <td className="border border-yellow-300 px-2 py-1">1</td>
                  </tr>
                  <tr>
                    <td className="border border-yellow-300 px-2 py-1">이영희</td>
                    <td className="border border-yellow-300 px-2 py-1">여</td>
                    <td className="border border-yellow-300 px-2 py-1">2</td>
                  </tr>
                </tbody>
              </table>
            </div>
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