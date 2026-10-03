import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";

const root = resolve(import.meta.dirname, "..", "dist");
const read = (name) => readFileSync(join(root, name), "utf8");
const write = (name, content) => writeFileSync(join(root, name), content);
const hash = (content) => createHash("sha256").update(content).digest("hex").slice(0, 12);
const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const script = read("app.js");
const stylesheet = read("styles.css");
const translations = runInNewContext(script.split("\ndocument.getElementById")[0] + "\ncopy", Object.create(null));
const oldVersion = read("index.html").match(/<meta name="site-version" content="([^"]+)"/)[1];
const scriptName = `app.${hash(script)}.js`;
const styleName = `styles.${hash(stylesheet)}.css`;
let index = read("index.html");
const imageNames = {};
for (const name of ["hero", "portrait"]) {
  const bytes = readFileSync(join(root, "assets", "images", `${name}.webp`));
  const filename = `${name}.${hash(bytes)}.webp`;
  writeFileSync(join(root, "assets", "images", filename), bytes);
  imageNames[name] = filename;
}
const normalizedIndex = index.replaceAll(oldVersion, "VERSION")
  .replace(/\/app\.[a-f0-9]{12}\.js/g, "/app.HASH.js")
  .replace(/\/styles\.[a-f0-9]{12}\.css/g, "/styles.HASH.css")
  .replace(/\/assets\/images\/(hero|portrait)(?:\.[a-f0-9]{12})?\.webp/g, "/assets/images/$1.HASH.webp");
const version = hash(normalizedIndex + script + stylesheet + JSON.stringify(imageNames));

index = index.replaceAll(oldVersion, version)
  .replace(/\/app\.[a-f0-9]{12}\.js/g, `/${scriptName}`)
  .replace(/\/styles\.[a-f0-9]{12}\.css/g, `/${styleName}`)
  .replace(/\/assets\/images\/(hero|portrait)(?:\.[a-f0-9]{12})?\.webp/g,
    (_, name) => `/assets/images/${imageNames[name]}`);
write("index.html", index);
write(scriptName, script);
write(styleName, stylesheet);
write("version.json", JSON.stringify({ version }, null, 2) + "\n");

const metadata = {
  en: {
    url: "https://wangmixiaopiano.cn/en/",
    title: "Mixiao Wang | Piano Lessons and Performance",
    description: "Mixiao Wang is a pianist and piano teacher trained at École Normale de Musique de Paris. Individual piano lessons for children, teenagers and adults.",
    ogDescription: "Pianist and piano teacher with degrees in piano and chamber music from École Normale de Musique de Paris.",
    ogLocale: "en_US",
    otherLocales: ["zh_CN", "fr_FR"],
    label: "Language",
    imageAlts: ["Mixiao Wang performing at a grand piano in a concert hall", "Pianist and piano teacher Mixiao Wang"]
  },
  fr: {
    url: "https://wangmixiaopiano.cn/fr/",
    title: "Mixiao Wang | Cours de piano et concerts",
    description: "Mixiao Wang, pianiste et professeur de piano diplômé de l’École Normale de Musique de Paris. Cours personnalisés pour enfants, adolescents et adultes.",
    ogDescription: "Pianiste et professeur de piano, diplômé en piano et en musique de chambre de l’École Normale de Musique de Paris.",
    ogLocale: "fr_FR",
    otherLocales: ["zh_CN", "en_US"],
    label: "Choisir la langue",
    imageAlts: ["Mixiao Wang joue du piano à queue dans une salle de concert", "Le pianiste et professeur de piano Mixiao Wang"]
  }
};

function languageLinks(active) {
  return `<div class="language" aria-label="${metadata[active]?.label || "选择语言"}">\n` +
    `        <a${active === "zh" ? ' class="active" aria-current="page"' : ""} lang="zh-CN" href="/">中</a>` +
    `<a${active === "en" ? ' class="active" aria-current="page"' : ""} lang="en" href="/en/">EN</a>` +
    `<a${active === "fr" ? ' class="active" aria-current="page"' : ""} lang="fr" href="/fr/">FR</a>\n` +
    `      </div>`;
}

function replaceMeta(html, key, value) {
  const pattern = new RegExp(`(<meta (?:name|property)="${key}" content=")[^"]*("\\s*\\/>)`);
  if (!pattern.test(html)) throw new Error(`Missing meta ${key}`);
  return html.replace(pattern, `$1${escapeHtml(value)}$2`);
}

for (const lang of ["en", "fr"]) {
  const info = metadata[lang];
  let page = index.replace('<html lang="zh-CN">', `<html lang="${lang}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(info.title)}</title>`)
    .replace('rel="canonical" href="https://wangmixiaopiano.cn/"', `rel="canonical" href="${info.url}"`)
    .replace(/<div class="language" aria-label="选择语言">[\s\S]*?<\/div>/, languageLinks(lang))
    .replace('alt="王米笑在音乐厅演奏三角钢琴"', `alt="${escapeHtml(info.imageAlts[0])}"`)
    .replace('alt="钢琴家与教师王米笑"', `alt="${escapeHtml(info.imageAlts[1])}"`)
    .replace(/<meta property="og:locale:alternate" content="[^"]+" \/>\s*<meta property="og:locale:alternate" content="[^"]+" \/>/,
      info.otherLocales.map(locale => `<meta property="og:locale:alternate" content="${locale}" />`).join("\n    "));
  for (const [key, value] of Object.entries({
    description: info.description,
    "og:locale": info.ogLocale,
    "og:title": info.title,
    "og:description": info.ogDescription,
    "og:url": info.url,
    "twitter:title": info.title,
    "twitter:description": info.ogDescription
  })) page = replaceMeta(page, key, value);

  let replaced = 0;
  page = page.replace(/(<([a-z][\w-]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/g,
    (match, open, tag, key, content, close) => {
      if (!(key in translations[lang])) throw new Error(`Missing ${lang} translation for ${key}`);
      replaced++;
      return open + escapeHtml(translations[lang][key]) + close;
    });
  const expected = (page.match(/data-i18n="/g) || []).length;
  if (replaced !== expected) throw new Error(`Translated ${replaced}/${expected} ${lang} elements`);
  mkdirSync(join(root, lang), { recursive: true });
  write(`${lang}/index.html`, page);
}

const sitemapLinks = [
  ["zh-CN", "https://wangmixiaopiano.cn/"],
  ["en", "https://wangmixiaopiano.cn/en/"],
  ["fr", "https://wangmixiaopiano.cn/fr/"],
  ["x-default", "https://wangmixiaopiano.cn/"]
];
const urls = sitemapLinks.slice(0, 3).map(([, url]) =>
  `  <url>\n    <loc>${url}</loc>\n` +
  sitemapLinks.map(([language, href]) => `    <xhtml:link rel="alternate" hreflang="${language}" href="${href}"/>`).join("\n") +
  "\n  </url>"
).join("\n");
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
console.log(`Generated localized pages, sitemap and ${scriptName} / ${styleName}`);
