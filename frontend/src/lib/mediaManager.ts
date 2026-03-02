// Global media manager to ensure only one media plays at a time
type StopCallback = () => void;

let activeStop: StopCallback | null = null;
let activeId: string | null = null;

export const mediaManager = {
  play(stopCb: StopCallback, id?: string) {
    // If the same media is resuming, just update the callback
    if (id && id === activeId) {
      activeStop = stopCb;
      return;
    }
    // Stop the currently playing media
    if (activeStop) activeStop();
    activeStop = stopCb;
    activeId = id || null;
  },
  stop() {
    if (activeStop) {
      activeStop();
      activeStop = null;
      activeId = null;
    }
  },
};
