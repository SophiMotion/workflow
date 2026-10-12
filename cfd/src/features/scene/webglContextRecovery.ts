export function registerWebglContextRecovery(
  canvas: HTMLCanvasElement,
  onLost: () => void,
  onRestored: () => void,
): () => void {
  let active = true;
  const remove = () => {
    if (!active) return;
    active = false;
    canvas.removeEventListener("webglcontextlost", handleLost);
    canvas.removeEventListener("webglcontextrestored", handleRestored);
  };
  const handleLost = (event: Event) => {
    event.preventDefault();
    onLost();
  };
  const handleRestored = () => {
    remove();
    onRestored();
  };
  canvas.addEventListener("webglcontextlost", handleLost);
  canvas.addEventListener("webglcontextrestored", handleRestored);
  return remove;
}
