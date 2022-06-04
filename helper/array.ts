
export function findAllIndex<X>(arr: X[], predicate: (x: X) => boolean): number[] {
  const out: number[] = [];

  for (let i = 0; i < arr.length; ++i) {
    if (predicate(arr[i])) {
      out.push(i);
    }
  }

  return out;
}

export function arrayContainsSub<X>(arr: X[], sub: X[]): boolean {
  if (sub.length === 0) {
    return true;
  } else if (sub.length > arr.length) {
    return false;
  }

outer:
  for (let i = 0; i <= arr.length - sub.length; ++i) {
    for (let j = 0; j < sub.length; ++j) {
      if (arr[i + j] !== sub[j]) {
        continue outer;
      }
    }
    return true;
  }

  return false;
}
