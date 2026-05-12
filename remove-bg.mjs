import { Jimp } from 'jimp';

const img = await Jimp.read('../CosmosREV logo.jpg');

// Target colour — deep teal #0a4a44
const R = 10, G = 74, B = 68;

img.scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
  const r = img.bitmap.data[idx];
  const g = img.bitmap.data[idx + 1];
  const b = img.bitmap.data[idx + 2];

  // Perceived brightness (0 = black, 1 = white)
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Smooth alpha curve — anti-aliased edge pixels fade gradually
  // instead of being hard-cut, giving clean smooth edges
  const alpha = Math.pow(1 - brightness, 1.4);

  img.bitmap.data[idx]     = R;
  img.bitmap.data[idx + 1] = G;
  img.bitmap.data[idx + 2] = B;
  img.bitmap.data[idx + 3] = Math.round(Math.min(alpha, 1) * 255);
});

await img.write('./public/cosmos-rev-logo.png');
console.log('Done — public/cosmos-rev-logo.png created');
