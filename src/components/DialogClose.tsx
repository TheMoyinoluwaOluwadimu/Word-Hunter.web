import styles from './DialogClose.module.css';

interface Props {
  onClick: () => void;
}

export default function DialogClose({ onClick }: Props) {
  return (
    <button type="button" className={styles.close} onClick={onClick} aria-label="Close">
      <img src={`${import.meta.env.BASE_URL}icons/close.svg`} alt="" width={45} height={46} />
    </button>
  );
}
