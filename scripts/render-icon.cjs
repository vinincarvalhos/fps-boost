// Renders build/icon.svg to build/icon.png (512px) and build/icon.ico (256px PNG inside an ICO).
// Usage: npx electron scripts/render-icon.cjs
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const dir = join(__dirname, '..', 'build')
const svg = readFileSync(join(dir, 'icon.svg'), 'utf8')

async function render(win, size) {
  const html = `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`
  await win.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'))
  win.setContentSize(size, size)
  await new Promise((r) => setTimeout(r, 300))
  return (await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size })).resize({ width: size, height: size }).toPNG()
}

function ico(png) {
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // one image
  header.writeUInt8(0, 6) // width 256
  header.writeUInt8(0, 7) // height 256
  header.writeUInt16LE(1, 10) // planes
  header.writeUInt16LE(32, 12) // bpp
  header.writeUInt32LE(png.length, 14)
  header.writeUInt32LE(22, 18) // offset
  return Buffer.concat([header, png])
}

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } })
  writeFileSync(join(dir, 'icon.png'), await render(win, 512))
  writeFileSync(join(dir, 'icon.ico'), ico(await render(win, 256)))
  console.log('icon.png e icon.ico gerados em', dir)
  app.quit()
})
