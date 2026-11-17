import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Corner, KitProps} from './types';

const FONT = '"DejaVu Sans", "Liberation Sans", Arial, sans-serif';

const cornerStyle = (c: Corner, pad: number): React.CSSProperties => ({
  position: 'absolute',
  ...(c.startsWith('top') ? {top: pad} : {bottom: pad}),
  ...(c.endsWith('left') ? {left: pad} : {right: pad}),
});

// ছোট noise টাইল — প্রতি ২ ফ্রেমে seed বদলায় (হালকা film grain)
const grainUrl = (seed: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${seed}'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`,
  )}")`;

export const UniqueVideo: React.FC<KitProps> = (p) => {
  const frame = useCurrentFrame();
  const {fps, width, height, durationInFrames} = useVideoConfig();
  const t = frame / fps;
  const unit = Math.min(width, height) / 100; // রেসপনসিভ একক

  // ---- forward / reverse সেগমেন্ট ----
  const seg = Math.max(1, Math.round(p.clipSec * fps));
  const segCount = Math.ceil(durationInFrames / seg);

  // ---- ধীরগতির zoom + pan (প্রতিটি ভিডিওতে আলাদা) ----
  const wave = Math.sin(t * p.driftSpeed * 2 * Math.PI + p.driftPhase);
  const scale = 1 + p.zoom * (1.4 + wave); // সবসময় >1, তাই কিনারা দেখা যায় না
  const panX = Math.cos(t * p.driftSpeed * 1.3 + p.driftPhase) * p.zoom * 40 * unit * 0.5;
  const panY = Math.sin(t * p.driftSpeed * 0.9 + p.driftPhase) * p.zoom * 40 * unit * 0.5;

  // ---- intro / outro ----
  const introF = p.introSec * fps;
  const outroF = p.outroSec * fps;
  const introOpacity = interpolate(frame, [0, fps * 0.4, introF - fps * 0.5, introF], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const outroOpacity = interpolate(frame, [durationInFrames - outroF, durationInFrames - 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const introY = interpolate(frame, [0, fps * 0.6], [3 * unit, 0], {extrapolateRight: 'clamp'});
  const badgeOpacity = interpolate(frame, [introF - fps * 0.3, introF + fps * 0.5], [0, 0.92], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#000', overflow: 'hidden'}}>
      {/* গ্রেড + zoom করা ভিডিও */}
      <AbsoluteFill
        style={{
          filter: `hue-rotate(${p.hue}deg) saturate(${p.saturate}) contrast(${p.contrast}) brightness(${p.brightness})`,
          transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
        }}
      >
        {Array.from({length: segCount}).map((_, i) => (
          <Sequence key={i} from={i * seg} durationInFrames={seg} layout="none">
            <AbsoluteFill>
              <OffthreadVideo
                src={staticFile(i % 2 === 0 ? p.fwdSrc : p.revSrc)}
                muted={!p.hasAudio}
                style={{width: '100%', height: '100%', objectFit: 'cover'}}
              />
            </AbsoluteFill>
          </Sequence>
        ))}
      </AbsoluteFill>

      {/* রঙের হালকা tint */}
      <AbsoluteFill style={{backgroundColor: p.tint, mixBlendMode: 'soft-light'}} />

      {/* vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,${p.vignette}) 100%)`,
        }}
      />

      {/* film grain */}
      {p.grain > 0 && (
        <AbsoluteFill
          style={{
            backgroundImage: grainUrl(p.seed % 1000 + Math.floor(frame / 2)),
            backgroundSize: `${28 * unit}px`,
            opacity: p.grain,
            mixBlendMode: 'overlay',
          }}
        />
      )}

      {/* intro টাইটেল */}
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: introOpacity}}>
        <div
          style={{
            transform: `translateY(${introY}px)`,
            textAlign: 'center',
            color: '#fff',
            fontFamily: FONT,
            textShadow: '0 0 ' + 4 * unit + 'px rgba(0,0,0,.6)',
          }}
        >
          <div style={{fontSize: 14 * unit, fontWeight: 800, letterSpacing: unit}}>Day {p.dayText}</div>
          <div style={{fontSize: 3.6 * unit, opacity: 0.9, marginTop: unit}}>{p.brandText}</div>
        </div>
      </AbsoluteFill>

      {/* ছোট ব্যাজ (সারাক্ষণ) */}
      <div
        style={{
          ...cornerStyle(p.badgeCorner, 4 * unit),
          opacity: badgeOpacity,
          color: '#fff',
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: 3 * unit,
          padding: `${unit}px ${2 * unit}px`,
          borderRadius: 2 * unit,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(6px)',
        }}
      >
        Day {p.dayText} · {p.brandText}
      </div>

      {/* outro */}
      <AbsoluteFill
        style={{
          backgroundColor: '#000',
          opacity: outroOpacity,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div style={{color: '#fff', fontFamily: FONT, fontSize: 6 * unit, fontWeight: 700, textAlign: 'center'}}>
          {p.brandText}
          <div style={{fontSize: 3 * unit, fontWeight: 400, opacity: 0.8, marginTop: unit}}>
            See you on Day {Number(p.dayText) ? Number(p.dayText) + 1 : 'next'}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

