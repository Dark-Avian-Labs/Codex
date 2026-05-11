import bgArt from '../../../packages/core/assets/background.txt?raw';
import bgArt2 from '../../../packages/core/assets/background2.txt?raw';

export function AsciiWaveBackground() {
  return (
    <div className="bg-art bg-art--wave" aria-hidden="true">
      <pre className="bg-art__layer">{bgArt}</pre>
      <pre className="bg-art__layer bg-art__layer--alt">{bgArt2}</pre>
    </div>
  );
}
