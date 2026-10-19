import { useEffect, useReducer, useRef, useState } from 'react';
import { cx } from '../lib/cx';
import { buzzPlace, buzzReturn, buzzWrong } from '../lib/haptics';
import { playPickupSound, playPlaceSound, playReturnSound } from '../lib/sound';
import type { Puzzle, TileModel } from '../types';
import { boardReducer, createBoard, slotKey } from './boardReducer';
import styles from './Game.module.css';

interface BoardProps {
  puzzle: Puzzle;
  /** Fired on the first tile pick-up (starts the timer). */
  onStart: () => void;
  /** Fired once when the board is completely correct. */
  onSolved: () => void;
  /** Challenges pass the shared seed so every player gets the identical tile order. */
  seed?: number;
}

interface DragState {
  tileId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hoverSlot: string | null;
}

const TAP_DISTANCE = 6; // movement under this (px) counts as a tap
const BLOCK_COLORS = 5;
const SNAP_DISTANCE = 30; // a drop this close (px) to a slot still lands in it
const EDGE = 110; // holding a tile within this many px of a screen edge scrolls the page
const MAX_SCROLL_SPEED = 18; // px per frame at the very edge

/** Picks one of the block paint colours from the chunk text, so a chunk always looks the same. */
function blockColor(chunk: string): number {
  let sum = 0;
  for (let i = 0; i < chunk.length; i++) sum += chunk.charCodeAt(i);
  return sum % BLOCK_COLORS;
}

export default function Board({ puzzle, onStart, onSolved, seed }: BoardProps) {
  const [board, dispatch] = useReducer(boardReducer, undefined, () => createBoard(puzzle, seed));
  const [drag, setDrag] = useState<DragState | null>(null);
  // A tile picked by tapping (instead of dragging): the next tap on a slot places it.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The tray and progress bar, pinned to the bottom of the screen. Auto-scroll stays clear of it.
  const dockRef = useRef<HTMLDivElement>(null);

  const onSolvedRef = useRef(onSolved);
  useEffect(() => {
    onSolvedRef.current = onSolved;
  });

  const tileById = new Map(board.tiles.map((t) => [t.id, t]));
  const placedIds = new Set(Object.values(board.placements));

  // A tile being dragged out of a slot has already left it, as far as counting goes.
  const liftedFromSlot = drag !== null && placedIds.has(drag.tileId);
  const placedCount = Object.keys(board.placements).length - (liftedFromSlot ? 1 : 0);

  // A selection ends when the tile gets placed some other way, or the board stops accepting moves.
  useEffect(() => {
    if (selectedId && (board.phase !== 'playing' || Object.values(board.placements).includes(selectedId))) {
      setSelectedId(null);
    }
  }, [selectedId, board.phase, board.placements]);

  // Whole board filled -> check it (after a beat, so the last drop registers visually).
  useEffect(() => {
    if (board.phase === 'playing' && drag === null && placedCount === board.totalSlots) {
      dispatch({ type: 'BEGIN_CHECK' });
    }
  }, [board.phase, board.totalSlots, drag, placedCount]);

  useEffect(() => {
    if (board.phase === 'checking') {
      const t = window.setTimeout(() => dispatch({ type: 'CHECK' }), 350);
      return () => window.clearTimeout(t);
    }
    if (board.phase === 'revealing') {
      buzzWrong();
      const t = window.setTimeout(() => dispatch({ type: 'RETRY' }), 500);
      return () => window.clearTimeout(t);
    }
    if (board.phase === 'solved') onSolvedRef.current();
  }, [board.phase]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, tile: TileModel) {
    if (board.phase !== 'playing' || drag !== null || board.locked.includes(tile.id)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();

    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    const offsetX = startX - rect.left;
    const offsetY = startY - rect.top;
    const wasPlaced = placedIds.has(tile.id);
    let lastX = startX;
    let lastY = startY;

    el.setPointerCapture(pointerId);
    onStart();
    playPickupSound();
    setDrag({ tileId: tile.id, x: rect.left, y: rect.top, width: rect.width, height: rect.height, hoverSlot: null });

    // The slot under the finger. If the finger lands just beside one, snap to the nearest within
    // thumb reach, so a drop doesn't have to be pixel perfect.
    const slotAt = (x: number, y: number): string | null => {
      const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-slot-key]');
      if (hit) return hit.dataset.slotKey ?? null;
      let best: string | null = null;
      let bestDistance = SNAP_DISTANCE;
      for (const slot of Array.from(document.querySelectorAll<HTMLElement>('[data-slot-key]'))) {
        const r = slot.getBoundingClientRect();
        const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
        if (d < bestDistance) {
          bestDistance = d;
          best = slot.dataset.slotKey ?? null;
        }
      }
      return best;
    };

    // Hold a tile near the top of the screen, or just above the tray, and the page scrolls that way.
    // The harder you push toward the edge, the faster it goes.
    let frame = 0;
    const autoScroll = () => {
      if (Math.hypot(lastX - startX, lastY - startY) >= TAP_DISTANCE) {
        const dockTop = dockRef.current?.getBoundingClientRect().top ?? window.innerHeight;
        let dy = 0;
        if (lastY < EDGE) dy = -Math.ceil(((EDGE - lastY) / EDGE) * MAX_SCROLL_SPEED);
        else if (lastY < dockTop && lastY > dockTop - EDGE) {
          dy = Math.ceil(((lastY - (dockTop - EDGE)) / EDGE) * MAX_SCROLL_SPEED);
        }
        if (dy !== 0) {
          window.scrollBy(0, dy);
          // the page moved under the finger, so the slot under it may have changed
          const hover = slotAt(lastX, lastY);
          setDrag((d) => (d && d.hoverSlot !== hover ? { ...d, hoverSlot: hover } : d));
        }
      }
      frame = requestAnimationFrame(autoScroll);
    };
    frame = requestAnimationFrame(autoScroll);

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      lastX = ev.clientX;
      lastY = ev.clientY;
      const hoverSlot = slotAt(ev.clientX, ev.clientY);
      setDrag((d) => (d ? { ...d, x: ev.clientX - offsetX, y: ev.clientY - offsetY, hoverSlot } : d));
    };

    const finish = (ev: PointerEvent, cancelled: boolean) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      cancelAnimationFrame(frame);

      const isTap = Math.hypot(lastX - startX, lastY - startY) < TAP_DISTANCE;
      const slot = cancelled || isTap ? null : slotAt(ev.clientX, ev.clientY);
      setDrag(null);

      if (isTap && !cancelled) {
        const ownSlot = wasPlaced ? Object.keys(board.placements).find((k) => board.placements[k] === tile.id) : undefined;
        if (selectedId && selectedId !== tile.id && ownSlot) {
          // a tile is selected and a placed one is tapped: swap them
          dispatch({ type: 'DROP', tileId: selectedId, slot: ownSlot });
          setSelectedId(null);
          playPlaceSound();
          buzzPlace();
        } else if (!wasPlaced) {
          // tapping a tile in the tray selects it (tap it again to let go)
          setSelectedId(selectedId === tile.id ? null : tile.id);
        } else {
          // tapping a placed tile sends it back to the tray
          dispatch({ type: 'RETURN', tileId: tile.id });
          playReturnSound();
          buzzReturn();
        }
        return;
      }

      setSelectedId(null);
      if (slot) {
        const occupant = board.placements[slot];
        const blocked = occupant !== undefined && board.locked.includes(occupant);
        dispatch({ type: 'DROP', tileId: tile.id, slot });
        if (blocked) {
          playReturnSound();
          buzzReturn();
        } else {
          playPlaceSound();
          buzzPlace();
        }
      } else {
        // dropped on empty space: back to the tray
        dispatch({ type: 'RETURN', tileId: tile.id });
        if (wasPlaced) {
          playReturnSound();
          buzzReturn();
        }
      }
    };
    const onUp = (ev: PointerEvent) => finish(ev, false);
    const onCancel = (ev: PointerEvent) => finish(ev, true);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }

  function placeSelected(slot: string) {
    if (!selectedId || board.phase !== 'playing') return;
    const occupant = board.placements[slot];
    if (occupant !== undefined && board.locked.includes(occupant)) {
      playReturnSound();
      buzzReturn();
      return;
    }
    dispatch({ type: 'DROP', tileId: selectedId, slot });
    setSelectedId(null);
    playPlaceSound();
    buzzPlace();
  }

  // The dragged tile keeps the same DOM node for the whole drag (it just goes position:fixed),
  // so the browser never loses track of the pointer mid-gesture.
  function renderTile(tile: TileModel) {
    const isDragging = drag?.tileId === tile.id;
    return (
      <div
        key={tile.id}
        data-tile-id={tile.id}
        data-k={blockColor(tile.chunk)}
        className={cx(
          styles.tile,
          isDragging && styles.dragging,
          selectedId === tile.id && !isDragging && styles.selected,
          board.locked.includes(tile.id) && styles.locked,
          board.wrong.includes(tile.id) && styles.wrongShake,
        )}
        style={isDragging && drag ? { left: drag.x, top: drag.y, width: drag.width } : undefined}
        onPointerDown={(e) => handlePointerDown(e, tile)}
      >
        {tile.chunk}
      </div>
    );
  }

  const poolTiles = board.tiles.filter((t) => !placedIds.has(t.id));

  const selectedChunk = selectedId ? tileById.get(selectedId)?.chunk : undefined;

  const status =
    board.phase === 'checking' || board.phase === 'revealing'
      ? 'Checking...'
      : board.phase === 'solved'
        ? 'Puzzle solved'
        : selectedChunk
          ? `Now tap a slot for "${selectedChunk}"`
          : (board.message ??
          (placedCount === 0
            ? 'Fill every slot, then it checks itself'
            : `${placedCount} of ${board.totalSlots} tiles placed`));

  return (
    <>
      <div className={styles.words}>
        {puzzle.items.map((item, wordIdx) => (
          <div key={wordIdx} className={cx(styles.wordRow, board.phase === 'solved' && styles.solved)}>
            <div className={styles.wordTop}>
              <div className={styles.wordText}>{item.label}</div>
              <div className={styles.slots}>
                {item.chunks.map((_, chunkIdx) => {
                  const key = slotKey(wordIdx, chunkIdx);
                  const tileId = board.placements[key];
                  const tile = tileId ? tileById.get(tileId) : undefined;
                  const filled = tile !== undefined && drag?.tileId !== tile.id;
                  return (
                    <div
                      key={key}
                      data-slot-key={key}
                      className={cx(
                        styles.slot,
                        filled && styles.filled,
                        drag?.hoverSlot === key && styles.hoverTarget,
                        selectedId && !filled && styles.target,
                      )}
                      onClick={(e) => {
                        // a tap on a tile inside the slot is the tile's own business
                        if ((e.target as HTMLElement).closest('[data-tile-id]')) return;
                        placeSelected(key);
                      }}
                    >
                      {tile && renderTile(tile)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.dock} ref={dockRef}>
        <div className={styles.poolSection}>
          <div className={styles.pool} data-testid="pool">
            {poolTiles.flatMap((tile) =>
              drag?.tileId === tile.id
                ? [
                    <div key={`ph-${tile.id}`} style={{ width: drag.width, height: drag.height, flexShrink: 0 }} />,
                    renderTile(tile),
                  ]
                : [renderTile(tile)],
            )}
          </div>
        </div>

        <div className={styles.footerBar}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${(placedCount / board.totalSlots) * 100}%` }} />
          </div>
          <div className={styles.statusLine} data-testid="status">
            {status}
          </div>
        </div>
      </div>
    </>
  );
}
