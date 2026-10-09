interface FireIconProps {
  size?: number;
}

export default function FireIcon({ size = 16 }: FireIconProps) {
  return <img width={size} height={size} src="https://img.icons8.com/emoji/48/fire.png" alt="streak" />;
}
