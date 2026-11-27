'use strict';

const wallpaperDepth = (() => {
  const analysisSize = 128;
  const renderSize = 1024;

  function canvas(width, height) {
    const element = document.createElement('canvas');
    element.width = width;
    element.height = height;
    return element;
  }

  function scaledSize(image, limit) {
    const scale = Math.min(1, limit / Math.max(image.naturalWidth, image.naturalHeight));
    return [Math.max(1, Math.round(image.naturalWidth * scale)), Math.max(1, Math.round(image.naturalHeight * scale))];
  }

  function neighbors(index, width, length, visit) {
    const x = index % width;
    if (x > 0) visit(index - 1);
    if (x + 1 < width) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index + width < length) visit(index + width);
  }

  function sideColor(data, width, height, x0, x1, y) {
    const color = [0, 0, 0];
    const top = Math.max(0, y - 2);
    const bottom = Math.min(height - 1, y + 2);
    for (let row = top; row <= bottom; row++) {
      for (let x = x0; x < x1; x++) {
        const i = (row * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) color[channel] += data[i + channel];
      }
    }
    const count = (bottom - top + 1) * (x1 - x0);
    return color.map(value => value / count);
  }

  function findForeground({data, width, height}) {
    const length = width * height;
    const distance = new Float32Array(length);
    const border = [];
    const strip = Math.max(2, Math.round(width * .05));
    // A smooth background can have a different color at each height and on each side.
    for (let y = 0; y < height; y++) {
      const left = sideColor(data, width, height, 0, strip, y);
      const right = sideColor(data, width, height, width - strip, width, y);
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const pixel = index * 4;
        if (data[pixel + 3] < 245) return null;
        const t = Math.max(0, Math.min(1, (x - (strip - 1) / 2) / (width - strip)));
        let squared = 0;
        for (let channel = 0; channel < 3; channel++) {
          const expected = left[channel] + (right[channel] - left[channel]) * t;
          squared += (data[pixel + channel] - expected) ** 2;
        }
        distance[index] = Math.sqrt(squared / 3);
        if (x < strip || width - 1 - x < strip || y < 2 || height - 1 - y < 2) border.push(distance[index]);
      }
    }
    border.sort((a, b) => a - b);
    const noise = border[Math.floor(border.length * .9)];
    if (noise > 25) return null;
    const cutoff = Math.max(29, 2.3 * noise);
    const minArea = length * .035;
    const labels = new Uint16Array(length);
    const queue = new Int32Array(length);
    let group = 0;
    let largest;
    let second = 0;
    for (let start = 0; start < length; start++) {
      if (labels[start] || distance[start] < cutoff) continue;
      labels[start] = ++group;
      queue[0] = start;
      let count = 1;
      let minX = width, maxX = 0, minY = height, maxY = 0;
      let separation = 0;
      function enqueue(index) {
        if (labels[index] || distance[index] < cutoff) return;
        labels[index] = group;
        queue[count++] = index;
      }
      for (let head = 0; head < count; head++) {
        const index = queue[head];
        const x = index % width;
        const y = Math.floor(index / width);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        separation += distance[index];
        neighbors(index, width, length, enqueue);
      }
      if (count < minArea) continue;
      if (largest && count <= largest.count) {
        second = Math.max(second, count);
        continue;
      }
      second = largest?.count ?? 0;
      largest = {id:group, count, minX, maxX, minY, maxY, mean:separation / count};
    }
    if (!largest || largest.count > length * .46 || second > largest.count * .45 || largest.mean < cutoff * 1.4) return null;
    const {id, count, minX, maxX, minY, maxY} = largest;
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    if (minX < strip || maxX >= width - strip || minY < 2 || maxY >= height - 2 ||
        boxWidth < width * .1 || boxHeight < height * .12 || count < boxWidth * boxHeight * .3) return null;
    return Uint8Array.from(labels, label => Number(label === id));
  }

  function expand(mask, width) {
    const outer = mask.slice();
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      neighbors(i, width, mask.length, index => { outer[index] = 1; });
    }
    return outer;
  }

  function imageMask(mask, width, height) {
    const bitmap = canvas(width, height);
    const ctx = bitmap.getContext('2d');
    const pixels = ctx.createImageData(width, height);
    mask.forEach((member, index) => { pixels.data[index * 4 + 3] = member * 255; });
    ctx.putImageData(pixels, 0, 0);
    return bitmap;
  }

  function repairBackground(pixels, hidden) {
    const {data, width, height} = pixels;
    const nearest = new Int32Array(hidden.length);
    nearest.fill(-1);
    const queue = new Int32Array(hidden.length);
    let tail = 0;
    for (let index = 0; index < hidden.length; index++) {
      if (hidden[index]) continue;
      nearest[index] = index;
      queue[tail++] = index;
    }
    for (let head = 0; head < tail; head++) {
      const current = queue[head];
      neighbors(current, width, hidden.length, index => {
        if (nearest[index] !== -1) return;
        nearest[index] = nearest[current];
        queue[tail++] = index;
      });
    }
    const restored = canvas(width, height);
    const ctx = restored.getContext('2d');
    const filled = ctx.createImageData(width, height);
    for (let i = 0; i < nearest.length; i++) {
      const source = nearest[i] * 4;
      filled.data.set(data.subarray(source, source + 4), i * 4);
    }
    ctx.putImageData(filled, 0, 0);
    return restored;
  }

  async function prepare(address) {
    try {
      const image = new Image();
      if (/^https?:/i.test(address)) image.crossOrigin = 'anonymous';
      image.src = address;
      await image.decode();
      const [w, h] = scaledSize(image, analysisSize);
      if (Math.min(w, h) < 24) return null;
      const sample = canvas(w, h).getContext('2d', {willReadFrequently:true});
      sample.drawImage(image, 0, 0, w, h);
      const pixels = sample.getImageData(0, 0, w, h);
      const subject = findForeground(pixels);
      if (!subject) return null;

      const [width, height] = scaledSize(image, renderSize);
      const foreground = canvas(width, height);
      const fg = foreground.getContext('2d');
      fg.drawImage(image, 0, 0, width, height);
      fg.globalCompositeOperation = 'destination-in';
      fg.filter = 'blur(.6px)';
      fg.drawImage(imageMask(subject, w, h), 0, 0, width, height);

      // Extend intact colors into the covered area to hide the original silhouette.
      // Keep full-resolution pixels elsewhere in the background.
      const hole = expand(expand(subject, w), w);
      const patch = canvas(width, height);
      const patchContext = patch.getContext('2d');
      patchContext.drawImage(repairBackground(pixels, hole), 0, 0, width, height);
      patchContext.globalCompositeOperation = 'destination-in';
      patchContext.drawImage(imageMask(expand(hole, w), w, h), 0, 0, width, height);
      const background = canvas(width, height);
      const bg = background.getContext('2d');
      bg.drawImage(image, 0, 0, width, height);
      bg.drawImage(patch, 0, 0);
      return {
        background:background.toDataURL('image/webp', .91),
        foreground:foreground.toDataURL('image/png')
      };
    } catch {
      // A broken or cross-origin image keeps the static wallpaper.
      return null;
    }
  }

  return {prepare};
})();
