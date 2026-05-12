import { useMemo, useRef } from 'react';

import bgArt from '../../../packages/core/assets/background.txt?raw';
import bgArt2 from '../../../packages/core/assets/background2.txt?raw';
import { normalizeAsciiPair } from '../../lib/asciiBackground/normalizeAsciiPair';
import { useAsciiBackgroundCanvas } from '../../lib/asciiBackground/useAsciiBackgroundCanvas';

function splitLines(raw: string): string[] {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

export function AsciiWaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { base, alt } = useMemo(
    () => normalizeAsciiPair(splitLines(bgArt), splitLines(bgArt2)),
    [bgArt, bgArt2],
  );
  useAsciiBackgroundCanvas(canvasRef, base, alt);

  return (
    <div className="bg-art" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
