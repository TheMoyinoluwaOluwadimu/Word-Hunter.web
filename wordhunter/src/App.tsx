import { Navigate, Route, Routes } from 'react-router-dom';
import Game from './pages/Game';
import MainMenu from './pages/MainMenu';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainMenu />} />
      <Route path="/play" element={<Game />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
