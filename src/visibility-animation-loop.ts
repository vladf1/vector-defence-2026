type AnimationStep = (deltaSeconds: number) => void;
const MAX_DELTA_SECONDS = 0.05;

export function startVisibilityAwareAnimationLoop(step: AnimationStep): () => void {
  let lastTimestamp = performance.now();
  let animationFrameId: number | null = null;

  function schedule(): void {
    if (document.hidden || animationFrameId !== null) {
      return;
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  function animate(timestamp: number): void {
    animationFrameId = null;
    if (document.hidden) {
      return;
    }

    const deltaSeconds = Math.min(MAX_DELTA_SECONDS, (timestamp - lastTimestamp) / 1000);
    lastTimestamp = timestamp;
    step(deltaSeconds);
    schedule();
  }

  function handleVisibilityChange(): void {
    if (document.hidden) {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      return;
    }

    lastTimestamp = performance.now();
    schedule();
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  schedule();

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };
}
