// Keep only the latest snapshot of each utterance. Never splice unrelated audio.
export class PendingUtterances {
  constructor(limit = 2) { this.limit = limit; this.items = []; }
  get length() { return this.items.length; }
  clear() { this.items.length = 0; }
  shift() { return this.items.shift(); }
  hasNewer(segment) { return this.items.some(x=>x.utterance===segment.utterance && x.revision>segment.revision); }
  push(segment) {
    const index = this.items.findIndex(x=>x.utterance===segment.utterance);
    if (index !== -1) {
      if (segment.revision > this.items[index].revision) this.items[index] = segment;
      return false;
    }
    const skipped = this.items.length >= this.limit;
    if (skipped) this.items.shift();
    this.items.push(segment); return skipped;
  }
}

// Only used after an explicit audio rollover. Match punctuation/case-insensitively
// and retain offsets into the original string. Without known audio overlap, do
// not remove repetitions: they may be intentional speech.
export function trimAudioOverlap(previous, current, continued) {
  if (!continued || !previous) return current.trim();
  const tokens = text => {
    const chars = []; let offset = 0;
    for (const char of text) {
      offset += char.length;
      for (const normalized of char.normalize('NFKC').toLowerCase()) {
        if (/[\p{L}\p{N}]/u.test(normalized)) chars.push({char:normalized,end:offset});
      }
    }
    return chars;
  };
  const left = tokens(previous).slice(-160), right = tokens(current);
  for (let n=Math.min(left.length,right.length,160); n>=4; n--) {
    if (!left.slice(-n).every((x,i)=>x.char===right[i].char)) continue;
    const matched = current.slice(0,right[n-1].end);
    // Avoid stripping a coincidental fragment inside a Latin word.
    if (/[a-z0-9]$/i.test(matched) && /^[a-z0-9]/i.test(current.slice(right[n-1].end))) continue;
    if (!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(matched)
      && matched.trim().split(/\s+/).length < 2) continue;
    return current.slice(right[n-1].end).replace(/^[\s,，。.!！?？;；:：、]+/u,'').trim();
  }
  return current.trim();
}
