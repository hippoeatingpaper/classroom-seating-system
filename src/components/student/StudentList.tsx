//src/components/student/StudentList.tsx
import React from 'react';
import { Trash2, GripVertical, Users } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useAppContext } from '@/context/AppContext';

export const StudentList: React.FC = () => {
  const { state, dispatch } = useAppContext();

  const handleDelete = (studentId: string) => {
    const student = state.students.find(s => s.id === studentId);
    if (student && confirm(`${student.name} 학생을 삭제하시겠습니까?`)) {
      dispatch({ type: 'REMOVE_STUDENT', payload: studentId });
    }
  };

  const handleDragStart = (e: React.DragEvent, studentId: string) => {
    e.dataTransfer.setData('text/plain', studentId);
    dispatch({ type: 'SET_UI_STATE', payload: { draggedStudent: studentId } });
  };

  if (state.students.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>등록된 학생이 없습니다.</p>
        <p className="text-sm">위 폼에서 학생을 추가해주세요.</p>
      </div>
    );
  }

  const sortedStudents = [...state.students].sort((a, b) => {
    if (a.number && b.number) return a.number - b.number;
    if (a.number && !b.number) return -1;
    if (!a.number && b.number) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700 mb-3">학생 목록</h4>
      
      <div className="max-h-96 overflow-y-auto space-y-1">
        {sortedStudents.map(student => {
          const isPlaced = Object.values(state.currentSeating).includes(student.id);
          
          return (
            <div
              key={student.id}
              className={`flex items-center gap-3 p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow cursor-grab ${
                isPlaced ? 'border-green-200 bg-green-50' : 'border-gray-200'
              }`}
              draggable
              onDragStart={(e) => handleDragStart(e, student.id)}
            >
              <GripVertical className="w-4 h-4 text-gray-400" />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
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
                  {isPlaced && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                      배치됨
                    </span>
                  )}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(student.id)}
                className="p-1 border-none hover:bg-red-50 text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
