import '@testing-library/jest-dom'
// vi is available globally via vitest.config.ts globals: true

// Provide crypto.randomUUID used in useChat
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => `${Math.random().toString(36).slice(2)}-${Date.now()}`,
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256)
      return arr
    },
    subtle: {},
  },
  writable: true,
})

// Silence React act() warnings in tests
globalThis.IS_REACT_ACT_ENVIRONMENT = true
