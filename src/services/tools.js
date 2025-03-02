import { infoDataStore } from "src/stores/infoDataStore";
import { collapseTextChangeRangesAcrossMultipleVersions } from "typescript";

function makeID() {
  const infoData = infoDataStore();
  const controllerID = infoData.data.deviceid;

  const localID = getLocalID(8);
  return `${controllerID}-${localID}`;
}

function getLocalID(n) {
  let min = Math.pow(10, n);
  let max = min * 10 - 1;
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export { makeID };
