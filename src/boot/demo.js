import { boot } from "quasar/wrappers";
import { isDemoMode } from "src/services/demoMode";
import { installDemoTransport } from "src/services/demoController";

export default boot(() => {
  if (isDemoMode()) installDemoTransport();
});
