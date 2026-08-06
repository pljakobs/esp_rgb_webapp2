const DEFAULT_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 1000;

export function loadAsyncComponent(importFn, retries = DEFAULT_RETRIES, initialDelayMs = DEFAULT_INITIAL_DELAY_MS) {
	return () =>
		new Promise((resolve, reject) => {
			const attempt = (retriesLeft, delayMs) => {
				importFn()
					.then(resolve)
					.catch((error) => {
						if (retriesLeft <= 0) {
							reject(error);
							return;
						}

						setTimeout(() => {
							attempt(retriesLeft - 1, delayMs * 2);
						}, delayMs);
					});
			};

			attempt(retries, initialDelayMs);
		});
}

const CHUNK_LOAD_ERROR_PATTERNS = [
	/Loading chunk [\w-]+ failed/i,
	/Failed to fetch dynamically imported module/i,
	/Importing a module script failed/i,
	/ChunkLoadError/i,
];

export function isChunkLoadError(error) {
	const message = `${error?.message ?? error ?? ""}`;

	return CHUNK_LOAD_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}
