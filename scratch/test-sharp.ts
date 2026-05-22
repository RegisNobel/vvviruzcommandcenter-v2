import sharp from "sharp";

async function test() {
  console.log("Sharp version:", sharp.versions);
}

test().catch(console.error);
