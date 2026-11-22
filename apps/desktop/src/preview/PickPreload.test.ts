import { expect, it, vi } from "vite-plus/test";

import { CANCEL_PICK_CHANNEL, START_PICK_CHANNEL } from "./GuestProtocol.ts";
import "./PickPreload.ts";

const ipcListeners = vi.hoisted(() => new Map<string, Array<(...args: unknown[]) => void>>());

vi.mock("electron", () => ({
  ipcRenderer: {
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      ipcListeners.set(channel, [...(ipcListeners.get(channel) ?? []), listener]);
    },
    off: () => {},
    send: () => {},
    invoke: async () => [],
  },
}));

vi.mock("react-grab/primitives", () => ({ getElementContext: async () => null }));

const startAnnotation = (): ShadowRoot => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  using attachShadow = vi.spyOn(Element.prototype, "attachShadow");
  for (const listener of ipcListeners.get(START_PICK_CHANNEL) ?? []) listener({}, undefined, false);
  const shadowRoot = attachShadow.mock.results[0]?.value;
  if (!(shadowRoot instanceof ShadowRoot)) throw new Error("annotation overlay did not start");
  return shadowRoot;
};

it("switches tools from the keyboard after a toolbar button is clicked", () => {
  const shadowRoot = startAnnotation();
  const region = Array.from(shadowRoot.querySelectorAll("button")).find(
    (button) => button.textContent === "Region",
  );
  if (!region) throw new Error("Region toolbar button not found");

  region.focus();
  region.click();
  expect(document.documentElement.getAttribute("data-t3code-annotation-tool")).toBe("marquee");

  region.dispatchEvent(new KeyboardEvent("keydown", { key: "v", bubbles: true, composed: true }));

  expect(
    document.documentElement.getAttribute("data-t3code-annotation-tool"),
    "V should switch to Select while focus is on a toolbar button",
  ).toBe("select");
});

it("keeps the tool while typing a tool key in the comment", () => {
  const shadowRoot = startAnnotation();
  const comment = shadowRoot.querySelector("textarea");
  if (!comment) throw new Error("comment textarea not found");

  comment.focus();
  comment.dispatchEvent(new KeyboardEvent("keydown", { key: "r", bubbles: true, composed: true }));

  expect(document.documentElement.getAttribute("data-t3code-annotation-tool")).toBe("select");
});

it("keeps comment keystrokes away from the page's capture-phase shortcuts", () => {
  const pageShortcut = vi.fn((event: KeyboardEvent) => event.preventDefault());
  window.addEventListener("keydown", pageShortcut, { capture: true });
  const shadowRoot = startAnnotation();
  const comment = shadowRoot.querySelector("textarea");
  if (!comment) throw new Error("comment textarea not found");

  comment.focus();
  const space = new KeyboardEvent("keydown", {
    key: " ",
    code: "Space",
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  comment.dispatchEvent(space);
  window.removeEventListener("keydown", pageShortcut, { capture: true });

  expect(pageShortcut).not.toHaveBeenCalled();
  expect(space.defaultPrevented).toBe(false);
});

it("keeps the annotation when Escape dismisses an IME candidate in the comment", () => {
  const shadowRoot = startAnnotation();
  const comment = shadowRoot.querySelector("textarea");
  if (!comment) throw new Error("comment textarea not found");

  comment.value = "draft";
  comment.focus();
  comment.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      isComposing: true,
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  );

  expect(shadowRoot.host.isConnected).toBe(true);
  expect(comment.value).toBe("draft");
});

import { afterPinLayoutSettles, findPinElement, pinSelectorChain } from "./PinAnchor.ts";
import type { PreviewPin } from "@t3tools/contracts";
const pin: PreviewPin = {
  id: "pin-1",
  number: 1,
  text: "按钮加宽",
  selectorChain: ["#pay"],
  tag: "button",
  elementText: "Pay",
  ancestor: null,
  relative: { x: 0.5, y: 0.5 },
  documentPosition: { x: 0.5, y: 0.5 },
  rect: { x: 0, y: 0, width: 20, height: 20 },
  pageKey: "http://localhost/page",
  createdAt: "2026-11-16T12:00:00Z",
  status: "unsent",
  screenshot: null,
  element: {
    pageUrl: "http://localhost/page",
    pageTitle: "Sample",
    tagName: "BUTTON",
    selector: "#pay",
    htmlPreview: '<button id="pay">Pay</button>',
    componentName: null,
    source: null,
    stack: [],
    styles: "",
    pickedAt: "2026-11-16T12:00:00Z",
  },
};

it("builds selectors and reanchors by selector, text, then nearby position", () => {
  document.body.innerHTML =
    '<main id="sample"><button id="pay">Pay</button><button>Other</button></main>';
  const button = document.querySelector("#pay")!;
  const chain = pinSelectorChain(button);
  expect(chain.length).toBeGreaterThan(0);
  expect(findPinElement({ ...pin, selectorChain: chain })).toBe(button);
  button.removeAttribute("id");
  expect(findPinElement(pin)).toBe(button);
  button.textContent = "Changed";
  Object.defineProperty(document.documentElement, "scrollWidth", {
    configurable: true,
    value: 100,
  });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 100,
  });
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue(new DOMRect(40, 40, 20, 20));
  expect(findPinElement({ ...pin, elementText: "missing" })).toBe(button);
  expect(
    findPinElement({ ...pin, elementText: "missing", documentPosition: { x: 9, y: 9 } }),
  ).toBeNull();
});
it("waits for load and 500ms quiet, caps dynamic layouts at 3s, and cancels observers", async () => {
  vi.useFakeTimers();
  const resizeDisconnect = vi.fn(),
    mutationDisconnect = vi.fn();
  let changed: () => void = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        changed = callback;
      }
      observe() {}
      disconnect() {
        resizeDisconnect();
      }
    },
  );
  vi.stubGlobal(
    "MutationObserver",
    class {
      observe() {}
      disconnect() {
        mutationDisconnect();
      }
    },
  );
  const ready = vi.fn();
  const cancel = afterPinLayoutSettles(document, ready);
  window.dispatchEvent(new Event("load"));
  await vi.advanceTimersByTimeAsync(499);
  expect(ready).not.toHaveBeenCalled();
  changed();
  await vi.advanceTimersByTimeAsync(499);
  expect(ready).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(ready).toHaveBeenCalledTimes(1);
  expect(resizeDisconnect).toHaveBeenCalled();
  expect(mutationDisconnect).toHaveBeenCalled();
  cancel();
  const capped = vi.fn();
  afterPinLayoutSettles(document, capped);
  window.dispatchEvent(new Event("load"));
  for (let n = 0; n < 7; n++) {
    await vi.advanceTimersByTimeAsync(400);
    changed();
  }
  expect(capped).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(200);
  expect(capped).toHaveBeenCalledTimes(1);
  const cancelled = vi.fn();
  const stop = afterPinLayoutSettles(document, cancelled);
  stop();
  await vi.advanceTimersByTimeAsync(4000);
  expect(cancelled).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("removes the pin host and page interception completely on close", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  for (const listener of ipcListeners.get(START_PICK_CHANNEL) ?? [])
    listener({}, undefined, true, undefined, true);
  window.dispatchEvent(new Event("load"));
  await vi.advanceTimersByTimeAsync(500);
  expect(document.querySelector('[data-t3code-annotation-ui="pins"]')).not.toBeNull();
  for (const listener of ipcListeners.get(CANCEL_PICK_CHANNEL) ?? []) listener({});
  expect(document.querySelector('[data-t3code-annotation-ui="pins"]')).toBeNull();
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  document.body.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(false);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
