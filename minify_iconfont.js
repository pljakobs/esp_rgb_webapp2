import { MiProvider } from "subset-iconfont";

const mdi = new MdiProvider(["lightbulb", "settings", "code", "tune"], {
  formats: ["ttf", "woff2"],
});

fa.makeFonts("./").then((result) => {
  console.log("Done!");
});
