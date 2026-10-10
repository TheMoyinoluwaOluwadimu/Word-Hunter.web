import { Navigate, useParams } from 'react-router-dom';
import { ARCHIVE_PUZZLE_FILES } from '../config';
import Game from './Game';

/** /practice/:file. Only files listed in ARCHIVE_PUZZLE_FILES can be opened, anything else goes back to the archive. */
export default function PracticeGame() {
  const { file } = useParams();
  if (!file || !ARCHIVE_PUZZLE_FILES.includes(file)) return <Navigate to="/practice" replace />;
  // keyed so moving from one puzzle to the next starts with a fresh timer and board
  return <Game key={file} mode="practice" file={file} />;
}
