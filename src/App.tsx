//src/App.tsx
import { AppProvider } from '@/context/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';

function App() {
  return (
    <AppProvider>
      <div className="App">
        <MainLayout />
      </div>
    </AppProvider>
  );
}

export default App;