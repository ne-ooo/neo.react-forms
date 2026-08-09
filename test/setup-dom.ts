import { Window } from 'happy-dom'

const browserWindow = new Window({ url: 'http://localhost/' })
const globalObject = globalThis as Record<PropertyKey, unknown>

for (const key of Reflect.ownKeys(browserWindow)) {
  if (key in globalObject) continue
  const descriptor = Object.getOwnPropertyDescriptor(browserWindow, key)
  if (descriptor) Object.defineProperty(globalObject, key, descriptor)
}

for (const [key, value] of [
  ['window', browserWindow],
  ['self', browserWindow],
  ['document', browserWindow.document],
  ['navigator', browserWindow.navigator],
] as const) {
  Object.defineProperty(globalObject, key, {
    configurable: true,
    value,
    writable: true,
  })
}
