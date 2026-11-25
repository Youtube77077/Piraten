import { motion } from 'motion/react';
import { spring } from '../motion';
import logoUrl from '../assets/brand/logo.webp';

interface Props {
  layoutId?: string;
  className?: string;
  /** Gentle idle float. */
  float?: boolean;
  /** Ambient glow behind the token. */
  glow?: boolean;
  /** Occasional light reflection sweeping across the metal. */
  sheen?: boolean;
  src?: string;
  alt?: string;
}

/** The Pirate Token logo, rendered from the supplied artwork without alteration. */
export function Token({ layoutId, className = '', float, glow, sheen, src = logoUrl, alt = 'Pirate Token' }: Props) {
  return (
    <motion.div layoutId={layoutId} className={`token ${className}`} transition={spring.smooth}>
      {glow && <span className="token__glow" aria-hidden="true" />}
      <span className={`token__body ${float ? 'is-floating' : ''}`}>
        <img className="token__img" src={src} alt={alt} draggable={false} decoding="async" />
        {sheen && <span className="token__sheen" aria-hidden="true" />}
      </span>
    </motion.div>
  );
}
