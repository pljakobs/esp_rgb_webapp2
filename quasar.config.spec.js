import { describe, expect, it } from "vitest";
import { compileScript, parse } from "@vue/compiler-sfc";
import configure from "./quasar.config.js";

describe("Vue production build configuration", () => {
  it("explicitly disables the Options API independently of Quasar defaults", () => {
    const config = configure({});
    expect(config.build.vueOptionsAPI).toBe(false);
  });

  it("keeps application components free of Options API state and hooks", () => {
    const files = import.meta.glob("./src/**/*.vue", {
      eager: true,
      query: "?raw",
      import: "default",
    });
    const forbidden = new Set([
      "data",
      "computed",
      "methods",
      "watch",
      "mixins",
      "extends",
      "beforeCreate",
      "created",
      "beforeMount",
      "mounted",
      "beforeUpdate",
      "updated",
      "beforeUnmount",
      "unmounted",
      "beforeDestroy",
      "destroyed",
      "activated",
      "deactivated",
      "errorCaptured",
      "renderTracked",
      "renderTriggered",
      "serverPrefetch",
    ]);
    for (const [file, source] of Object.entries(files)) {
      const { descriptor } = parse(source, { filename: file });
      if (!descriptor.script && !descriptor.scriptSetup) continue;
      const script = compileScript(descriptor, { id: file });

      function checkOptions(node) {
        if (!node || typeof node !== "object") return;
        let component;
        if (node.type === "ExportDefaultDeclaration") {
          component = node.declaration;
        } else if (
          node.type === "CallExpression" &&
          ["defineComponent", "defineOptions"].includes(node.callee.name)
        ) {
          component = node.arguments[0];
        }
        if (component?.type === "ObjectExpression") {
          const options = component.properties.map(
            (property) => property.key?.name ?? property.key?.value,
          );
          expect(
            options.filter((key) => forbidden.has(key)),
            file,
          ).toEqual([]);
        }
        for (const value of Object.values(node)) {
          if (Array.isArray(value)) value.forEach(checkOptions);
          else if (value && typeof value === "object") checkOptions(value);
        }
      }

      [...(script.scriptAst || []), ...(script.scriptSetupAst || [])].forEach(
        checkOptions,
      );
    }
  });
});
