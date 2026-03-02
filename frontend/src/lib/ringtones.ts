// Generate ringtones using Web Audio API
let audioContext: AudioContext | null = null;
let activeOscillators: OscillatorNode[] = [];
let activeGains: GainNode[] = [];
let ringtoneInterval: NodeJS.Timeout | null = null;

const getAudioContext = () => {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext();
  }
  return audioContext;
};

const stopRingtone = () => {
  activeOscillators.forEach(osc => {
    try { osc.stop(); } catch (_) {}
  });
  activeGains.forEach(g => {
    try { g.disconnect(); } catch (_) {}
  });
  activeOscillators = [];
  activeGains = [];
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
};

// Classic phone ring pattern for voice calls
const playVoiceRingtone = () => {
  stopRingtone();
  const ctx = getAudioContext();

  const playBurst = () => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = 440;
    osc2.type = 'sine';
    osc2.frequency.value = 480;

    gain.gain.value = 0.15;

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc1.start(now);
    osc2.start(now);
    // Ring for 1s, pause 2s (handled by interval)
    osc1.stop(now + 1);
    osc2.stop(now + 1);

    activeOscillators.push(osc1, osc2);
    activeGains.push(gain);
  };

  playBurst();
  ringtoneInterval = setInterval(playBurst, 3000);
};

// Melodic chime pattern for video calls
const playVideoRingtone = () => {
  stopRingtone();
  const ctx = getAudioContext();

  const notes = [523.25, 659.25, 783.99, 659.25]; // C5, E5, G5, E5

  const playChime = () => {
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;

      gain.gain.value = 0;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.2);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.2 + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.2 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + i * 0.2);
      osc.stop(ctx.currentTime + i * 0.2 + 0.4);

      activeOscillators.push(osc);
      activeGains.push(gain);
    });
  };

  playChime();
  ringtoneInterval = setInterval(playChime, 2500);
};

export { playVoiceRingtone, playVideoRingtone, stopRingtone };
