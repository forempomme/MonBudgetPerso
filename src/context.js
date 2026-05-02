import { createContext, useContext } from "react";

/**
 * @typedef {'success'|'error'|'info'} ToastType
 * @typedef {{ id: string, msg: string, type: ToastType }} Toast
 */

/** @type {React.Context<(msg: string, type?: ToastType) => void>} */
export const ToastCtx = createContext(() => {});

/** @returns {(msg: string, type?: ToastType) => void} */
export function useToast() {
  return useContext(ToastCtx);
}
