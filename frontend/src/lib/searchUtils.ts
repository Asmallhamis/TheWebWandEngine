
function normalizePinyinText(text: string) {
  return (text || '')
    .toLowerCase()
    .replace(/[“”"'‘’`·•]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPinyinMatch(query: string, py: string, init: string) {
  if (!query) return true;
  const normalizedQuery = normalizePinyinText(query).replace(/\s+/g, '');
  const normalizedPy = normalizePinyinText(py).replace(/\s+/g, '');
  const normalizedInit = normalizePinyinText(init).replace(/\s+/g, '');
  if (!normalizedQuery) return true;
  if (!normalizedPy || !normalizedInit) return false;

  // Pre-calculate initial positions in py
  const initialPositions: number[] = [];
  let lastPos = -1;
  for (const char of normalizedInit) {
    const pos = normalizedPy.indexOf(char, lastPos + 1);
    if (pos === -1) return false;
    initialPositions.push(pos);
    lastPos = pos;
  }

  let pyIdx = 0;
  let initIdx = 0;

  for (let i = 0; i < normalizedQuery.length; i++) {
    const qChar = normalizedQuery[i];
    let matched = false;

    // 1. Try to match as a start of a future syllable (initial)
    for (let j = initIdx; j < initialPositions.length; j++) {
      if (qChar === normalizedInit[j]) {
        pyIdx = initialPositions[j] + 1;
        initIdx = j + 1;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // 2. Try to match as continuation of current syllable
      if (pyIdx < normalizedPy.length && qChar === normalizedPy[pyIdx]) {
        pyIdx++;
        // If we matched the start of the next initial, advance initIdx
        if (initIdx < initialPositions.length && (pyIdx - 1) === initialPositions[initIdx]) {
          initIdx++;
        }
        matched = true;
      }
    }

    if (!matched) return false;
  }
  return true;
}

export function checkPinyinFuzzy(query: string, py: string, init: string) {
  const pyParts = normalizePinyinText(py).split(' ');
  const initParts = normalizePinyinText(init).split(' ');
  for (let i = 0; i < pyParts.length; i++) {
    if (isPinyinMatch(query, pyParts[i], initParts[i] || '')) return true;
  }
  return false;
}
