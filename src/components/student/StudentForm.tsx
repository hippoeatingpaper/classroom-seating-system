//src/components/student/StudentForm.tsx
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { useAppContext } from '@/context/AppContext';
import { generateId } from '@/utils/idGenerator';

export const StudentForm: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [formData, setFormData] = useState({
    name: '',
    gender: 'male' as 'male' | 'female',
    number: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = '이름을 입력해주세요.';
    } else if (state.students.some(s => s.name === formData.name.trim())) {
      newErrors.name = '이미 존재하는 이름입니다.';
    }

    const number = parseInt(formData.number);
    if (formData.number && (isNaN(number) || number < 1)) {
      newErrors.number = '올바른 번호를 입력해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const newStudent = {
      id: generateId(),
      name: formData.name.trim(),
      gender: formData.gender,
      number: formData.number ? parseInt(formData.number) : undefined,
      createdAt: new Date(),
    };

    dispatch({ type: 'ADD_STUDENT', payload: newStudent });
    
    setFormData({ name: '', gender: 'male', number: '' });
    setErrors({});
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <Input
        label="이름"
        type="text"
        value={formData.name}
        onChange={(e) => handleChange('name', e.target.value)}
        error={errors.name}
        placeholder="학생 이름"
        required
      />

      <Select
        label="성별"
        value={formData.gender}
        onChange={(e) => handleChange('gender', e.target.value)}
        options={[
          { value: 'male', label: '남' },
          { value: 'female', label: '여' },
        ]}
      />

      <Input
        label="번호"
        type="number"
        value={formData.number}
        onChange={(e) => handleChange('number', e.target.value)}
        error={errors.number}
        placeholder="출석번호 (선택)"
        min="1"
      />

      <Button
        type="submit"
        variant="primary"
        icon={Plus}
        className="w-full"
      >
        학생 추가
      </Button>
    </form>
  );
};
