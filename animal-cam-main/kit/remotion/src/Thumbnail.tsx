import React from 'react';
import {AbsoluteFill, Img, staticFile, useVideoConfig} from 'remotion';
import {KitProps} from './types';

const FONT = '"DejaVu Sans", "Liberation Sans", Arial, sans-serif';

export const Thumbnail: React.FC<KitProps> = (p) => {
  const {width, height} = useVideoConfig();
  const unit = Math.min(width, height) / 100;
  const c = p.badgeCorner; // Python এখানে সবচেয়ে ফাঁকা কোণ বসিয়েছে
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <Img
        src={staticFile(p.thumbSrc)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: `hue-rotate(${p.hue}deg) saturate(${p.saturate}) contrast(${p.contrast}) brightness(${p.brightness})`,
        }}
      />
      <AbsoluteFill
        style={{background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,${p.vignette}) 100%)`}}
      />
      <div
        style={{
          position: 'absolute',
          ...(c.startsWith('top') ? {top: 5 * unit} : {bottom: 5 * unit}),
          ...(c.endsWith('left') ? {left: 5 * unit} : {right: 5 * unit}),
          color: '#fff',
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 13 * unit,
          lineHeight: 1,
          textShadow: `0 ${0.4 * unit}px ${2 * unit}px rgba(0,0,0,.8)`,
          WebkitTextStroke: `${0.25 * unit}px rgba(0,0,0,.6)`,
        }}
      >
        Day {p.dayText}
      </div>
    </AbsoluteFill>
  );
};
