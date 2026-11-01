import mark from '../assets/lenipo-mark.svg';

/** The Lenipo mark from the brand board (TL-87, E-129); the name beside it says what it is. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <img
      src={mark}
      alt=""
      aria-hidden
      width={Math.round((size * 192) / 208)}
      height={size}
      className="block shrink-0"
    />
  );
}
