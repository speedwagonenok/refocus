import fs from "fs";

const xml = fs.readFileSync("docs/thesis-unzip/word/document.xml", "utf8");
const text = xml
  .replace(/<w:tab[^/]*\/>/g, "\t")
  .replace(/<\/w:p>/g, "\n")
  .replace(/<w:br[^/]*\/>/g, "\n")
  .replace(/<[^>]+>/g, "")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"');

fs.writeFileSync("docs/thesis-extract.txt", text, "utf8");
console.log("lines", text.split("\n").length, "chars", text.length);
