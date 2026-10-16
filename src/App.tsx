import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { RETURN_KEY, useAuth } from './auth/AuthProvider';
import { retryPendingDailyRun } from './lib/dailyRun';
import { IconSprite } from './components/icons';
import SplashScreen from './components/SplashScreen';
import ChallengeList from './pages/ChallengeList';
import ChallengePlay from './pages/ChallengePlay';
import ChallengeSpin from './pages/ChallengeSpin';
import Game from './pages/Game';
import Leaderboard from './pages/Leaderboard';
import MainMenu from './pages/MainMenu';
import Practice from './pages/Practice';
import PracticeGame from './pages/PracticeGame';

export default function App() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // A daily run that finished while offline is sent as soon as we know who the player is.
  useEffect(() => {
    if (user) void retryPendingDailyRun();
  }, [user]);

  // Back from signing in: pick up the challenge link they opened.
  useEffect(() => {
    if (!user) return;
    try {
      const saved = localStorage.getItem(RETURN_KEY);
      if (!saved) return;
      localStorage.removeItem(RETURN_KEY);
      navigate(saved.replace(/^#/, ''), { replace: true });
    } catch {
      // storage unavailable: stay on the menu
    }
  }, [user, navigate]);

  return (
    <>
      <IconSprite />
      <SplashScreen />
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/play" element={<Game />} />
        <Route path="/challenge" element={<ChallengeSpin />} />
        <Route path="/challenges" element={<ChallengeList />} />
        <Route path="/c/:code" element={<ChallengePlay />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/practice/:file" element={<PracticeGame />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
