import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { Script, runInNewContext } from "node:vm";

const root = resolve(import.meta.dirname, "..", "dist");
const origin = "https://wangmixiaopiano.cn";
const version = JSON.parse(readFileSync(join(root, "version.json"), "utf8")).version;
const copySource = readFileSync(join(root, "app.js"), "utf8");
const translations = runInNewContext(copySource.split("\ndocument.getElementById")[0] + "\ncopy", Object.create(null));
const languages = [["zh-CN", "", "zh"], ["en", "en/", "en"], ["fr", "fr/", "fr"]];
const digest = bytes => createHash("sha256").update(bytes).digest("hex").slice(0, 12);

for (const [language, route, key] of languages) {
  const html = readFileSync(join(root, route, "index.html"), "utf8");
  assert(html.includes(`<html lang="${language}">`), `Incorrect language: ${route}`);
  assert(html.includes(`rel="canonical" href="${origin}/${route}"`), `Incorrect canonical: ${route}`);
  assert(html.includes(`name="site-version" content="${version}"`), `Stale version: ${route}`);
  for (const [, tag, item, value] of html.matchAll(/<([a-z][\w-]*)\b[^>]*data-i18n="([^"]+)"[^>]*>([^<]*)<\/\1>/g)) {
    const escape = text => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    assert.equal(value, escape(translations[key][item]), `Translation mismatch: ${route} ${item}`);
  }
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  for (const [, attribute, reference] of html.matchAll(/\b(src|href)="([^"]+)"/g)) {
    if (/^(?:https?:|mailto:|tel:)/.test(reference)) continue;
    if (reference.startsWith("#")) {
      assert(ids.has(reference.slice(1)), `Missing anchor: ${reference}`);
      continue;
    }
    const url = new URL(reference, `${origin}/${route}`);
    let file = resolve(root, `.${url.pathname}`);
    assert(file.startsWith(root), `Path escapes dist: ${reference}`);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    assert(existsSync(file), `Missing ${attribute}: ${reference} on ${route}`);
    const contentHash = file.match(/\.([a-f0-9]{12})\.(?:js|css|webp)$/)?.[1];
    if (contentHash) assert.equal(digest(readFileSync(file)), contentHash, `Asset hash mismatch: ${file}`);
  }
  for (const [, attributes, source] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (attributes.includes('type="application/ld+json"')) JSON.parse(source);
    else if (!attributes.includes("src=")) new Script(source);
  }
  for (const [, image] of html.matchAll(/<img[^>]*\bsrc="([^"]+)"/g)) {
    assert(image.startsWith("/assets/images/"), `Image must remain same-origin: ${image}`);
  }
  for (const href of ["/", "/en/", "/fr/"]) assert(html.includes(`href="${href}"`));
  assert(!/pocketbay|pocketbase|github\.io/i.test(html), `Old hosting or incorrect canonical: ${route}`);
  console.log(`Validated /${route}: language, content, links, scripts, images, SEO and version`);
}

for (const name of readdirSync(root)) {
  if (name.endsWith(".js")) new Script(readFileSync(join(root, name), "utf8"));
}
const sitemap = readFileSync(join(root, "sitemap.xml"), "utf8");
for (const [, route] of languages) assert(sitemap.includes(`<loc>${origin}/${route}</loc>`));
assert(readFileSync(join(root, "robots.txt"), "utf8").includes(`Sitemap: ${origin}/sitemap.xml`));
assert.equal(readFileSync(join(root, "CNAME"), "utf8").trim(), "wangmixiaopiano.cn");
assert(existsSync(join(root, ".nojekyll")));
console.log("Static validation passed; no server runtime is needed for production.");
