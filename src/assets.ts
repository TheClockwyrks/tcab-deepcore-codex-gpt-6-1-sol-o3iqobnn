/// <reference types="vite/client" />
import type { InitApi } from "@clockwyrks/simple-2d";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import type { Assets, DeepcoreState } from "./model";
import { CUES } from "./constants";
const files = import.meta.glob("../assets/**/*.{png,json,wav}", {
  eager: true,
  query: "?url&no-inline",
  import: "default",
}) as Record<string, string>;
function localPath(url: string) {
  const part = url.split("/assets/").pop();
  if (!part) throw new Error("Invalid asset URL");
  return part;
}
export async function loadAssets(api: InitApi<DeepcoreState>): Promise<Assets> {
  const assets: Assets = { images: {}, fx: {} };
  await Promise.all(
    Object.entries(files).map(async ([key, url]) => {
      const path = key.replace("../assets/", "");
      if (path.endsWith(".png"))
        assets.images[path] = await api.assets.loadImage(localPath(url));
      else if (path.startsWith("fx/"))
        assets.fx[path.slice(3, -5)] = JSON.parse(
          await (await api.assets.load(localPath(url))).text(),
        ) as ParticleSystem;
    }),
  );
  await Promise.all(
    Object.values(CUES).map((cue) =>
      api.audio.load(cue, localPath(files[`../assets/audio/${cue}.wav`])),
    ),
  );
  return assets;
}
