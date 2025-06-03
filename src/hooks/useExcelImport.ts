//src/hooks/useExcelImport.ts
import { useState } from 'react';
import { Student, ExcelImportResult } from '@/types';
import { parseExcelFile, mapColumnsToStudents, validateExcelFile } from '@/utils/excelProcessor';

export const useExcelImport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ExcelImportResult | null>(null);

  const processFile = async (file: File): Promise<ExcelImportResult | null> => {
    setLoading(true);
    setError(null);

    try {
      // 파일 유효성 검사
      const validationError = validateExcelFile(file);
      if (validationError) {
        throw new Error(validationError);
      }

      // 파일 파싱
      const result = await parseExcelFile(file);
      
      const fullResult: ExcelImportResult = {
        ...result,
        previewData: [],
        columnMapping: {
          nameColumn: '',
          genderColumn: '',
          numberColumn: '',
        },
      };

      setParseResult(fullResult);
      return fullResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '파일 처리 중 오류가 발생했습니다.';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const generateStudents = (mapping: any): Student[] => {
    if (!parseResult) {
      throw new Error('파싱 결과가 없습니다.');
    }

    return mapColumnsToStudents(parseResult.data, parseResult.headers, mapping);
  };

  const reset = () => {
    setLoading(false);
    setError(null);
    setParseResult(null);
  };

  return {
    loading,
    error,
    parseResult,
    processFile,
    generateStudents,
    reset,
  };
};