export type ValueListener<T> = (value: T) => void;

export interface ReadableValue<T> {
  get(): T;
  /** Calls `listener` immediately with the current value, then after every change. */
  subscribe(listener: ValueListener<T>): () => void;
}

export interface WritableValue<T> extends ReadableValue<T> {
  set(value: T): void;
}

export function createValue<T>(initial: T): WritableValue<T> {
  let current = initial;
  const listeners = new Set<ValueListener<T>>();

  return {
    get: () => current,
    set(value) {
      if (Object.is(value, current)) {
        return;
      }

      current = value;
      for (const listener of listeners) {
        listener(value);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(current);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function readonlyValue<T>(value: ReadableValue<T>): ReadableValue<T> {
  return { get: value.get, subscribe: value.subscribe };
}
