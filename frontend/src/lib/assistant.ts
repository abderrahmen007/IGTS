/** Opens the floating assistant from anywhere (optionally with a question to ask). */
export const ASSISTANT_EVENT = "igts:assistant";

export function openAssistant(question?: string) {
  window.dispatchEvent(new CustomEvent(ASSISTANT_EVENT, { detail: { question } }));
}
