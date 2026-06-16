# esp_rgb_webapp2 — Code Review

> **Review date: 2026-04-21.** All issues identified against current codebase.

## websocket.js

### High Severity

1. `wsStatus.CLOSED` is undefined — `reconnect()` backoff never fires
   **Location:** [src/services/websocket.js](src/services/websocket.js#L82)
   **Details:** `wsStatus` defines `CONNECTING`, `CONNECTED`, `DISCONNECTED`, `FAILED` — but not `CLOSED`. The `reconnect()` function checks `state.status === wsStatus.CLOSED` which is always `=== undefined`, so the progressive-backoff reconnect path never executes. The only working reconnect is in `onclose` which hard-codes 5000ms and ignores `reconnectAttempts` entirely.
   ->fix ✅

2. `handleKeepAlive` double-serializes the response
   **Location:** [src/services/websocket.js](src/services/websocket.js#L56)
   **Details:** `send` is `(method, params) => socket.send(JSON.stringify({jsonrpc, method, params}))`. `handleKeepAlive` calls `send(JSON.stringify(response))` — passing an already-serialized string as the `method` argument. The firmware receives `{"jsonrpc":"2.0","method":"{\"id\":...}","params":{}}` instead of the correct response structure.
   ->fix ✅

3. `destroy()` throws if `socket` is null
   **Location:** [src/services/websocket.js](src/services/websocket.js#L117)
   **Details:** `state.socket.readyState` crashes if `destroy()` is called before `connect()`. `state.socket` is initialized to `null` in state with no guard in `destroy()`.
   ->fix ✅

### Medium Severity

4. WebSocket callbacks accumulate without cleanup
   **Location:** [src/services/websocket.js](src/services/websocket.js#L151)
   **Details:** `onJson` only pushes to the callbacks array and never removes. If `fetchData` is called again on a store that doesn't guard with `websocketSubscribed`, handlers multiply. No `offJson` mechanism exists. <- offJson is clearly nonsense, the onJson is a callback marshaller, but you're right, json that is not handled by a callback should be discarded at the end of the queue
   -> add fallthrough cleanup to dequeue a message that is not handled by any subscriber ✅

5. Module-level `console.log` with `JSON.stringify(state)` runs on every `useWebSocket()` call
   **Location:** [src/services/websocket.js](src/services/websocket.js#L157)
   **Details:** Reactive Vue state serialization runs eagerly for every consumer of the composable.

### Low Severity

6. `reconnectTimeout` variable is declared but never used for its intended purpose
   **Location:** [src/services/websocket.js](src/services/websocket.js#L24)
   **Details:** Declared alongside `lostConnectionTimeout` but never assigned or cleared in the reconnect flow.

## api.js

### High Severity

1. Unbounded retry backoff can stall the UI for ~9 minutes per request
   **Location:** [src/services/api.js](src/services/api.js#L375)
   **Details:** `maxRetries = 10` is hard-coded and uses `retryDelay * 2^retryCount` (base 500ms). Retry 10 fires after ~256 seconds. Worst-case total wait per request: ~9 minutes. For an embedded device UI, this is impractical — a slow network or rebooting controller will freeze the entire app.
   -> don't touch, this is intended behaviour for now ⏭

### Medium Severity

2. `clearTimeout(timeoutId)` missing in the catch branch
   **Location:** [src/services/api.js](src/services/api.js#L470)
   **Details:** `clearTimeout(timeoutId)` is called only on successful response. When the fetch throws a non-AbortError, `timeoutId` keeps running and eventually calls `abortController.abort()` on an already-failed request — timer leaks per failed request.
   -> fix ✅

3. `_processQueue` can crash if `_activeRequests` Set is missing
   **Location:** [src/services/api.js](src/services/api.js#L74)
   **Details:** `_processQueue` calls `this._activeRequests.get(controllerIp).add(promise)` but doesn't verify the Set exists for this IP before `.add()`. A race between cleanup and queue processing can cause a null dereference.
   ->fix ✅

4. `maxRetries = 10` overrides parameter-level intent
   **Location:** [src/services/api.js](src/services/api.js#L380)
   **Details:** `_executeFetchApi` accepts `retryCount` as a parameter but always uses its own local `maxRetries = 10`. Callers cannot limit the retry count below 10.
   -> fix ✅

### Low Severity

5. All URLs use `http://` hardcoded — mixed-content block if served over HTTPS
   **Location:** [src/services/api.js](src/services/api.js#L406)
   **Details:** `http://${targetController.ip_address}/${endpoint}` is unconditional. If the webapp is ever served over HTTPS, all API calls will be blocked by browser mixed-content policy.
   -> the controllers cannot do https due to hardware restrictions. ⏭

## appDataStore.js

### High Severity

1. `targetControllerss.length` typo causes `ReferenceError` at runtime
   **Location:** [src/stores/appDataStore.js](src/stores/appDataStore.js#L480)
   **Details:** In `savePreset`, the error-recovery progress callback references `targetControllerss.length` (double `ss`). On any fetch error from a controller, this throws `ReferenceError: targetControllerss is not defined`, crashing the entire save operation.
   -> fix ✅

### Medium Severity

2. `savePreset` bypasses `apiService` with raw `fetch()`
   **Location:** [src/stores/appDataStore.js](src/stores/appDataStore.js#L462)
   **Details:** Uses raw `fetch()` instead of `apiService.fetchApi()`, losing queue management, retry logic, chunking, and timeout handling. Results in unthrottled simultaneous requests to the same controller.
   -> fix ✅

3. `watchForSync` leaks Vue watchers — `_syncWatchStops` never called
   **Location:** [src/stores/appDataStore.js](src/stores/appDataStore.js#L222)
   **Details:** `_syncWatchStops` stores stop functions for two watchers but they are never invoked. When the store is reset or the controller changes, the old watchers keep firing.
   -> explain ⏭

4. Remote data mutation before merge decision
   **Location:** [src/stores/appDataStore.js](src/stores/appDataStore.js#L142)
   **Details:** `if (!item.ts) item.ts = 0;` mutates the item object from the API response directly before using it for comparison, which can affect cached references.
   -> this seems to just be a default timestamp of 0 if the timestamp is not set, don't touch for now ⏭

5. `toggleFavorite` has no AbortController, no timeout, and no null check on `currentController`
   **Location:** [src/stores/appDataStore.js](src/stores/appDataStore.js#L706)
   **Details:** `controllers.currentController["ip_address"]` is accessed without null check. Also uses unbounded raw `fetch()` with no timeout.
   -> fix ✅

## controllersStore.js

### High Severity

1. Quoted selector syntax causes firmware `BadSelector` HTTP 400
   **Location:** [src/stores/controllersStore.js](src/stores/controllersStore.js#L210)
   **Details:** `payload = { [\`controllers[id="${metadata.id}"]\`]: metadata }`uses a quoted id selector. The`appDataStore.js` itself has a comment stating: _"ConfigDB selector values must be unquoted — quoted selectors are treated as literal quote characters by firmware parser and result in HTTP 400 BadSelector."_ Every controller metadata update silently fails.
   -> fix ✅

### Medium Severity

2. `websocketSubscribed` and `error` set on `this` without declaration in `state()`
   **Location:** [src/stores/controllersStore.js](src/stores/controllersStore.js#L114)
   **Details:** Both `this.websocketSubscribed` and `this.error` are assigned without being declared in the `state()` factory. In Pinia, undeclared state properties are not reactive and won't trigger updates.
   -> fix ✅

## saveDelete.js

### High Severity

1. `existingDataResponse.json()` called without checking response status
   **Location:** [src/services/saveDelete.js](src/services/saveDelete.js#L60)
   **Details:** After `fetch()`, `existingDataResponse.ok` is never checked. If the controller returns 404/500, `.json()` may throw or return an error body, causing `existingData[pluralType].find(...)` to crash or incorrectly treat the item as new.
   -> fix ✅

2. Quoted selector syntax causes `BadSelector` errors in `saveItem`
   **Location:** [src/services/saveDelete.js](src/services/saveDelete.js#L70)
   **Details:** `{ [\`${pluralType}[id="${item.id}"]\`]: itemToSync }` uses quoted selectors, inconsistent with the rest of the codebase and rejected by the firmware with HTTP 400.
   -> fix ✅

### Medium Severity

3. `deleteItem` routes through the store then back into `saveDelete.js` — circular indirection
   **Location:** [src/services/saveDelete.js](src/services/saveDelete.js#L107)
   **Details:** `deleteItem` calls `store.deleteScene(item)` which is defined in `appDataStore` which in some paths calls back into `saveDelete`. Reduces traceability and increases coupling.
   -> I think this is works as designed ⏭

## configDataStore.js

### High Severity

1. `updateData` crashes on null/missing intermediate path nodes
   **Location:** [src/stores/configDataStore.js](src/stores/configDataStore.js#L55)
   **Details:** `currentObject = currentObject[fieldParts[i]]` does not guard against `undefined` or `null`. If `this.data.network` is absent when setting `network.telemetry.host`, the second iteration accesses `undefined["telemetry"]` and throws a `TypeError`.
   -> fix ✅

### Medium Severity

2. `updateMultipleData` has the same null path traversal issue
   **Location:** [src/stores/configDataStore.js](src/stores/configDataStore.js#L83)
   **Details:** Same unguarded traversal pattern as `updateData`.
   -> fix ✅

## systemCommands.js

### High Severity

1. `sysCmd` dereferences `currentController` without null check
   **Location:** [src/services/systemCommands.js](src/services/systemCommands.js#L6)
   **Details:** `controllers.currentController.ip_address` is accessed unconditionally. If called before stores are initialized or after a disconnect, throws `TypeError: Cannot read properties of null`.
   -> this should never happen, but better check than fail. fix ✅

## ColorPage.vue

### High Severity

1. `savePreset` is a non-functional stub
   **Location:** [src/pages/ColorPage.vue](src/pages/ColorPage.vue#L38)
   **Details:** The `savePreset` function defined in `setup()` only logs and closes the dialog without calling any store method. The Save preset button in the color page dialog has never persisted any data.
   -> that must be a misreading, I can save presets just fine although, I'm using the "add preset" button on the color picker page ⏭

## appCommands.js

### Medium Severity

1. `webapp_cmd` reload has no authentication and cannot be cancelled
   **Location:** [src/services/appCommands.js](src/services/appCommands.js#L6)
   **Details:** Any WebSocket message with `method: "webapp_cmd"` and `params.message === "reload"` triggers `location.reload()` after 10 seconds with no confirmation, no cancel, and no origin check. A rogue or misbehaving controller can force-reload all connected browsers.
   -> don't touch ⏭

## notifications.js

### Medium Severity

1. `params.message` displayed without null/type guard
   **Location:** [src/services/notifications.js](src/services/notifications.js#L6)
   **Details:** `Notify.create({ message: params.message })` — if the notification event omits `message`, Quasar displays `undefined` as the notification text.
   -> fix ✅

## storeHelpers.js

### Medium Severity

1. `fetchApi` is a legacy duplicate of `ApiService._executeFetchApi`
   **Location:** [src/stores/storeHelpers.js](src/stores/storeHelpers.js#L17)
   **Details:** Full duplicate of the fetch logic without queue management, chunking, or proper error handling for non-404 4xx/5xx codes. If callers use this directly instead of `apiService`, they bypass all rate limiting and retry improvements.
   -> fix ✅

## syncService.js

### Medium Severity

1. Sync lock timestamp relies on client clock — unreliable across tabs/devices
   **Location:** [src/services/syncService.js](src/services/syncService.js#L70)
   **Details:** `lockAge = now - existingLock.ts` where `now = Date.now()`. If two browser instances have clock skew (even 30s), a valid lock appears stale and is overwritten, allowing concurrent syncs that corrupt data.
   ->but that's why we use ID bound locks, if the code finds a foreign lock, it will back off.

2. Lock release errors are silently swallowed
   **Location:** [src/services/syncService.js](src/services/syncService.js#L192)
   **Details:** `releaseDistributedLocks` does not check for errors from `apiService.updateDataOnController`. Stale locks remain on controllers with no indication that release failed.
   -> failure to delete locks should a) trigger repeats, b) if repeats fail, report error, although this is not a user correctable error, reaaly

## storeConstants.js

### Medium Severity

1. `requestTimeout = 2000ms` is too short for ESP8266 writes
   **Location:** [src/stores/storeConstants.js](src/stores/storeConstants.js#L42)
   **Details:** 2 seconds is insufficient for firmware config writes on a loaded ESP8266. Under poor WiFi, legitimate requests time out, trigger the 10-retry backoff, and cause the UI to stall for minutes.
   -> increase to 3000ms ✅

## router/routes.js

### Low Severity

1. Catch-all 404 route is commented out
   **Location:** [src/router/routes.js](src/router/routes.js#L38)
   **Details:** `ErrorNotFound.vue` exists but the route is commented out. Unknown paths render blank instead of a 404 page.

-> there should never be a 404 that is not handled by the front end application ⏭
