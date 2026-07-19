// global types

// 百度地图GL版本全局类型声明
/// <reference types="bmapgl" />

declare module 'qrcode';

// Vite's `?url` asset import, used to bundle zxing's wasm with the app.
declare module '*.wasm?url' {
  const src: string;
  export default src;
}
