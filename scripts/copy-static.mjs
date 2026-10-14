import { cp, mkdir } from "node:fs/promises";

const source = new URL("../firmware/", import.meta.url);
const destination = new URL("../dist/firmware/", import.meta.url);

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
