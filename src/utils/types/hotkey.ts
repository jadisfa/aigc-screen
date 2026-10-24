export declare type KeyPredicate = (event: KeyboardEvent) => boolean
export declare type KeyFilter = null | undefined | string | KeyPredicate
export declare type KeyStrokeEventName = 'keydown' | 'keypress' | 'keyup'
export declare type KeyStrokeOptions = {
  eventName?: KeyStrokeEventName
  target?: MaybeRef<EventTarget>
  passive?: boolean
}
/**
 * Listen for keyboard keys being stroked.
 *
 * @see /onKeyStroke
 * @param key
 * @param handler
 * @param options
 */
export declare function onKeyStroke(
  key: KeyFilter,
  handler: (event: KeyboardEvent) => void,
  options?: KeyStrokeOptions
): Fn
/**
 * Listen to the keydown event of the given key.
 *
 * @see /onKeyStroke
 * @param key
 * @param handler
 * @param options
 */
export declare function onKeyDown(
  key: KeyFilter,
  handler: (event: KeyboardEvent) => void,
  options?: Omit<KeyStrokeOptions, 'eventName'>
): Fn
/**
 * Listen to the keypress event of the given key.
 *
 * @see /onKeyStroke
 * @param key
 * @param handler
 * @param options
 */
export declare function onKeyPressed(
  key: KeyFilter,
  handler: (event: KeyboardEvent) => void,
  options?: Omit<KeyStrokeOptions, 'eventName'>
): Fn
/**
 * Listen to the keyup event of the given key.
 *
 * @see /onKeyStroke
 * @param key
 * @param handler
 * @param options
 */
export declare function onKeyUp(
  key: KeyFilter,
  handler: (event: KeyboardEvent) => void,
  options?: Omit<KeyStrokeOptions, 'eventName'>
): Fn
