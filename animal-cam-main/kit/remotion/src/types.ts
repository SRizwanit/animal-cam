export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type KitProps = {
  // ---- Python (uniquify.py) এই ভ্যালুগুলো props.json এ লেখে ----
  width: number;
  height: number;
  fps: number;
  durationSec: number; // ফাইনাল ভিডিওর দৈর্ঘ্য
  clipSec: number; // একটি forward/reverse সেগমেন্টের দৈর্ঘ্য
  hasAudio: boolean;
  fwdSrc: string; // public/ এর ভেতরের ফাইল
  revSrc: string;
  thumbSrc: string;

  dayText: string;
  brandText: string;
  badgeCorner: Corner;

  // ---- seed থেকে বের হওয়া "ইউনিক" প্যারামিটার ----
  seed: number;
  hue: number; // deg
  saturate: number;
  contrast: number;
  brightness: number;
  zoom: number; // 0.02 = 2%
  driftSpeed: number; // pan/zoom গতি
  driftPhase: number;
  vignette: number; // 0..1
  grain: number; // 0..1
  tint: string; // rgba(...)
  introSec: number;
  outroSec: number;
};

export const defaultProps: KitProps = {
  width: 1280,
  height: 720,
  fps: 30,
  durationSec: 10,
  clipSec: 4,
  hasAudio: false,
  fwdSrc: 'fwd.mp4',
  revSrc: 'rev.mp4',
  thumbSrc: 'thumb.jpg',
  dayText: '01',
  brandText: 'Animal Cam',
  badgeCorner: 'top-left',
  seed: 1,
  hue: 2,
  saturate: 1.05,
  contrast: 1.03,
  brightness: 1.0,
  zoom: 0.03,
  driftSpeed: 0.15,
  driftPhase: 0,
  vignette: 0.25,
  grain: 0.05,
  tint: 'rgba(255,200,120,0.04)',
  introSec: 2.5,
  outroSec: 2,
};
