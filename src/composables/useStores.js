/**
 * Composable for accessing all application stores
 * Reduces import boilerplate across components
 */
import { useAppDataStore } from 'src/stores/appDataStore'
import { useControllersStore } from 'src/stores/controllersStore'
import { infoDataStore } from 'src/stores/infoDataStore'
import { useConfigDataStore } from 'src/stores/configDataStore'
import { useColorDataStore } from 'src/stores/colorDataStore'
import { useScenesStore } from 'src/stores/scenesStore'
import { useTelemetryStore } from 'src/stores/telemetryData'

/**
 * Returns all commonly used stores
 * @returns {Object} Object containing all store instances
 */
export function useStores() {
  return {
    appData: useAppDataStore(),
    controllers: useControllersStore(),
    info: infoDataStore(),
    config: useConfigDataStore(),
    colorData: useColorDataStore(),
    scenes: useScenesStore(),
    telemetry: useTelemetryStore()
  }
}

/**
 * Returns only the most frequently used stores
 * For components that don't need all stores
 * @returns {Object} Object with appData and controllers stores
 */
export function useCoreStores() {
  return {
    appData: useAppDataStore(),
    controllers: useControllersStore()
  }
}
