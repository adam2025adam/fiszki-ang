const fs = require("fs");

const inputFile = "words.csv";
const outputFile = "words.json";

const csv = fs.readFileSync(inputFile, "utf8");

const lines = csv
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line.length > 0);

// pomijamy pierwszy wiersz z nagłówkami
const dataLines = lines.slice(1);

const words = dataLines.map(line => {
  // ID, CATEGORY, ENGLISH, POLISH
  const [id, category, english, polish] = line.split(",");

  return {
    id: Number(id.trim()),
    english: english.trim(),
    polish: polish.trim(),
    category: category.trim().toUpperCase()
  };
});

fs.writeFileSync(
  outputFile,
  JSON.stringify(words, null, 2),
  "utf8"
);

console.log(`Gotowe. Zapisano ${words.length} słówek do ${outputFile}`);