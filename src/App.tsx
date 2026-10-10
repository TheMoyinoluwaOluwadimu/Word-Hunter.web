import { Navigate, Route, Routes } from 'react-router-dom';
import { IconSprite } from './components/icons';
import Game from './pages/Game';
import MainMenu from './pages/MainMenu';
import Practice from './pages/Practice';
import PracticeGame from './pages/PracticeGame';

export default function App() {
  return (
    <>
      <IconSprite />
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/play" element={<Game />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/practice/:file" element={<PracticeGame />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
