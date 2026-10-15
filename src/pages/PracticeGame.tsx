import { Navigate, useParams } from 'react-router-dom';
import { usePuzzleSchedule } from '../hooks/usePuzzleSchedule';
import Game from './Game';

/** /practice/:file. Only puzzles already played as a daily can be opened, anything else goes back to the archive. */
export default function PracticeGame() {
  const { file } = useParams();
  const sched = usePuzzleSchedule();
  if (sched.status === 'loading') return null;
  if (sched.status === 'error' || !file || !sched.schedule.archive.includes(file)) {
    return <Navigate to="/practice" replace />;
  }
  // keyed so moving from one puzzle to the next starts with a fresh timer and board
  return <Game key={file} mode="practice" file={file} />;
}
