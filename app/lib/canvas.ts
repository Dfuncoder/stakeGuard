import type { Validator, AVSService } from "@/app/types";

export function layoutNodes(
  validators: Validator[],
  avsServices: AVSService[],
  width: number,
  height: number
): { validators: Validator[]; avsServices: AVSService[] } {
  const cx = width / 2;
  const cy = height / 2;
  const shortSide = Math.min(width, height);

  const avsR = shortSide * 0.22;
  const valR = shortSide * 0.38;

  const newAVS = avsServices.map((a, i) => {
    const angle = (i / avsServices.length) * Math.PI * 2 - Math.PI / 2;
    return { ...a, x: cx + avsR * Math.cos(angle), y: cy + avsR * Math.sin(angle) };
  });

  const newVals = validators.map((v, i) => {
    const angle =
      (i / validators.length) * Math.PI * 2 -
      Math.PI / 2 +
      Math.PI / validators.length;
    return { ...v, x: cx + valR * Math.cos(angle), y: cy + valR * Math.sin(angle) };
  });

  return { validators: newVals, avsServices: newAVS };
}

export function hitTestNode(
  mx: number,
  my: number,
  nodes: Array<{ x: number; y: number; id: string }>,
  radius: number
): string | null {
  for (const node of nodes) {
    const dx = mx - node.x;
    const dy = my - node.y;
    if (Math.sqrt(dx * dx + dy * dy) < radius) return node.id;
  }
  return null;
}
