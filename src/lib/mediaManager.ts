// Global media manager to ensure only one media plays at a time
type StopCallback = () => void;

let activeStop: StopCallback | null = null;

export const mediaManager = {
  play(stopCb: StopCallback) {
    // Stop the currently playing media
    if (activeStop) activeStop();
    activeStop = stopCb;
  },
  stop() {
    if (activeStop) {
      activeStop();
      activeStop = null;
    }
  },
};
