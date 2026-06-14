import { useState } from 'react';

/**
 * 检测当前设备是否有粗指针（触屏）。
 * 用于在数字 input 上条件性设置 inputmode：
 *   - 触屏（手机/平板）：加 inputmode="decimal" 弹数字键盘
 *   - 非触屏（桌面）：不设 inputmode，避免 IME 被切英文
 */
export function useIsTouchDevice() {
  return useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(pointer: coarse)').matches;
  })[0];
}
