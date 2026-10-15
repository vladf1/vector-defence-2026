type DomChild = Node | string;

/** Creates an element with string attributes and children. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>>,
  ...children: DomChild[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.append(...children);
  return element;
}

/** Writes text only when it changed, so per-frame HUD publishes do not churn the DOM. */
export function setText(node: Node, text: string): void {
  if (node.textContent !== text) {
    node.textContent = text;
  }
}

/** Writes an attribute only when it changed; `null` removes it. */
export function setAttribute(element: Element, name: string, value: string | null): void {
  if (value === null) {
    element.removeAttribute(name);
  } else if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

/** Assigns a property only when it changed. */
export function setProperty<T extends object, K extends keyof T>(target: T, key: K, value: T[K]): void {
  if (target[key] !== value) {
    target[key] = value;
  }
}

/**
 * Makes `parent` contain exactly `children`, in order. Nodes that stay present are never
 * detached, so a focused button keeps focus when a sibling appears or disappears.
 */
export function syncChildren(parent: Element, children: readonly Node[]): void {
  const keep = new Set(children);
  for (const child of Array.from(parent.childNodes)) {
    if (!keep.has(child)) {
      child.remove();
    }
  }

  let cursor = parent.firstChild;
  for (const child of children) {
    if (child === cursor) {
      cursor = cursor.nextSibling;
    } else {
      parent.insertBefore(child, cursor);
    }
  }
}
