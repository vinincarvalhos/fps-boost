/** Minimal parser for Valve KeyValues text (libraryfolders.vdf, appmanifest_*.acf). */
export type Vdf = { [key: string]: string | Vdf }

export function parseVdf(text: string): Vdf {
  let i = 0
  const n = text.length

  const skip = () => {
    while (i < n) {
      const c = text[i]
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') i++
      else if (c === '/' && text[i + 1] === '/') while (i < n && text[i] !== '\n') i++
      else break
    }
  }

  const str = (): string => {
    if (text[i] !== '"') {
      // unquoted token
      const start = i
      while (i < n && !/[\s{}"]/.test(text[i])) i++
      return text.slice(start, i)
    }
    i++
    let out = ''
    while (i < n && text[i] !== '"') {
      if (text[i] === '\\' && i + 1 < n) {
        const e = text[i + 1]
        out += e === 'n' ? '\n' : e === 't' ? '\t' : e
        i += 2
      } else out += text[i++]
    }
    i++ // closing quote
    return out
  }

  const obj = (): Vdf => {
    const o: Vdf = {}
    for (;;) {
      skip()
      if (i >= n || text[i] === '}') {
        i++
        return o
      }
      const key = str()
      skip()
      if (text[i] === '{') {
        i++
        o[key] = obj()
      } else o[key] = str()
    }
  }

  return obj()
}
