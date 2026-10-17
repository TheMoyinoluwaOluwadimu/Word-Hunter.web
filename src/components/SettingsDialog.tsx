import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { buzz, canVibrate } from '../lib/haptics';
import { setSetting, useSettings } from '../lib/settings';
import { playPlaceSound } from '../lib/sound';
import styles from './SettingsDialog.module.css';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`${styles.switch} ${checked ? styles.switchOn : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  );
}

/** Sound and vibration switches, plus the way into the "How to play" screen. */
export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const settings = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="settings-title" className={styles.title}>
          Settings
        </h2>

        <div className={styles.panel}>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <p className={styles.rowTitle}>Sound</p>
              <p className={styles.rowSub}>Tile clicks and the win jingle</p>
            </div>
            <Switch
              label="Sound"
              checked={settings.sound}
              onChange={(next) => {
                setSetting('sound', next);
                // a little click so turning it on proves it works
                if (next) playPlaceSound();
              }}
            />
          </div>

          {canVibrate() && (
            <div className={styles.row}>
              <div className={styles.rowText}>
                <p className={styles.rowTitle}>Vibration</p>
                <p className={styles.rowSub}>A tiny buzz when tiles land</p>
              </div>
              <Switch
                label="Vibration"
                checked={settings.vibration}
                onChange={(next) => {
                  setSetting('vibration', next);
                  if (next) buzz(30);
                }}
              />
            </div>
          )}

          <button
            type="button"
            className={styles.howTo}
            onClick={() => {
              onClose();
              navigate('/how-to-play');
            }}
          >
            <span className={styles.howToMark} aria-hidden="true">
              ?
            </span>
            <span className={styles.howToText}>
              <span className={styles.rowTitle}>How to play</span>
              <span className={styles.rowSub}>A quick guide to the game</span>
            </span>
            <span className={styles.chevron} aria-hidden="true">
              &rsaquo;
            </span>
          </button>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.close} onClick={onClose} autoFocus>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
