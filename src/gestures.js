export const GESTURES = {
  nod: {
    durationSec: 0.75,
    apply(t, intensity) {
      // Asymmetric: quicker dip down, gentler recovery (feels like a real head nod).
      const wave =
        t < 0.28
          ? Math.sin((t / 0.28) * (Math.PI / 2))
          : Math.cos(((t - 0.28) / 0.72) * (Math.PI / 2));
      return {
        ParamAngleY: -20 * wave * intensity,
        ParamBodyAngleY: -7 * wave * intensity,
      };
    },
  },
  headTilt: {
    durationSec: 1.2,
    apply(t, intensity) {
      const env = t < 0.3 ? t / 0.3 : t > 0.7 ? (1 - t) / 0.3 : 1;
      return {
        ParamAngleZ: 12 * env * intensity,
        ParamBodyAngleZ: 5 * env * intensity,
        ParamBodyAngleX: 3 * env * intensity,
      };
    },
  },
  shake: {
    durationSec: 1.0,
    apply(t, intensity) {
      const decay = 1 - t;
      const wave = Math.sin(t * Math.PI * 4);
      return {
        ParamAngleX: wave * 12 * decay * intensity,
        ParamBodyAngleX: wave * 5 * decay * intensity,
      };
    },
  },
  bounce: {
    durationSec: 0.8,
    apply(t, intensity) {
      const wave = Math.sin(t * Math.PI);
      return {
        ParamBodyAngleY: 9 * wave * intensity,
        ParamAngleY: 6 * wave * intensity,
        ParamBodyAngleZ: Math.sin(t * Math.PI * 2) * 3 * intensity,
      };
    },
  },
  pullback: {
    durationSec: 0.7,
    apply(t, intensity) {
      const env = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
      return {
        ParamAngleY: 10 * env * intensity,
        ParamBodyAngleY: 7 * env * intensity,
        ParamBodyAngleZ: 2 * env * intensity,
      };
    },
  },
  leanIn: {
    durationSec: 1.0,
    apply(t, intensity) {
      const env = t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5;
      return {
        ParamBodyAngleY: -9 * env * intensity,
        ParamAngleY: -5 * env * intensity,
        ParamBodyAngleX: 2 * env * intensity,
      };
    },
  },
};
