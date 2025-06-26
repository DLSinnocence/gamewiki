const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");
const { parse } = require("csv-parse/sync");
const glob = require("glob");

function linkifyBuffInText(text, buffMap) {
  if (!text) return "";

  const sortedNames = Array.from(buffMap.keys()).sort(
    (a, b) => b.length - a.length
  );

  for (const name of sortedNames) {
    const link = buffMap.get(name);
    const pattern = new RegExp(`${name}`, "g");
    text = text.replace(pattern, `[${name}](${link})`);
  }

  return text;
}

function buildBuffMap() {
  const dataFiles = glob.sync("Source/Data/Buff/*.csv");
  const textFiles = glob.sync("Source/Text/Buff/*.csv");

  const textMap = new Map();

  textFiles.forEach((file) => {
    const rows = readCSV(file);
    rows.forEach((row) => {
      textMap.set(row.Id, row);
    });
  });

  const buffMap = new Map();

  dataFiles.forEach((file) => {
    const rows = readCSV(file);
    const fileName = path.basename(file, ".csv");
    const outputDir = path.join("Buff", fileName);

    rows.forEach((row) => {
      const text = textMap.get(row.Id) || {};
      const displayName = text.Name || row.Id;
      const link = `/Buff/${fileName}/${encodeURIComponent(row.Id)}.html`;
      buffMap.set(displayName, link);
    });
  });
  return buffMap;
}

// 工具：读取 CSV 文件
function readCSV(filePath) {
  const buffer = fs.readFileSync(filePath);
  const raw = iconv.decode(buffer, "utf-8");

  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
  });
}

// 工具：写入 Markdown 文件
function writeMarkdown(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

function escapeMarkdown(text) {
  return String(text || "")
    .replace(/\|/g, "\\|") // 转义 |
    .replace(/</g, "&lt;") // 转义 <
    .replace(/>/g, "&gt;") // 转义 >
    .replace(/`/g, "\\`") // 转义 `
    .replace(/\*/g, "\\*") // 转义 *
    .replace(/_/g, "\\_") // 转义 _
    .replace(/\n/g, "<br>"); // 换行符变成 <br> 避免断行
}

function renderMarkdown(title, data, buffMap) {
  const lines = [`# ${title}\n`];
  const type = data.Type;
  const rarity = data.Rarity;
  const description = linkifyBuffInText(
    data.Description || data.描述 || "",
    buffMap
  );
  const tips = linkifyBuffInText(data.Tips || "", buffMap);
  lines.push(`## 简介\n`);
  if (type) lines.push(`**类型**：${escapeMarkdown(type)}  `);
  if (rarity) lines.push(`**稀有度**：${escapeMarkdown(rarity)}  `);
  if (description) lines.push(`**描述**：${description}  `);
  if (tips) lines.push(`**提示**：${tips}  `);
  lines.push(`\n---\n`);
  lines.push(`## 原始数据\n`);
  lines.push("```");

  // 显示除主要字段外的所有字段
  Object.keys(data).forEach((key) => {
    lines.push(`${key}: ${String(data[key] || "")}`);
  });

  lines.push("```");

  return lines.join("\n");
}

// 主函数
function generatePages() {
  const buffMap = buildBuffMap();
  const dataFiles = glob.sync("Source/Data/**/**/*.csv");
  const textFiles = glob.sync("Source/Text/**/**/*.csv");

  const textFileMap = new Map();
  textFiles.forEach((f) => {
    const relative = path.relative("Source/Text", f).replace(/\\/g, "/");
    const key = relative.toLowerCase();
    textFileMap.set(key, f);
  });

  const outputRoot = path.resolve("docs/wiki");

  for (const dataFile of dataFiles) {
    const relative = path.relative("Source/Data", dataFile).replace(/\\/g, "/");
    const key = relative.toLowerCase();

    const textFile = textFileMap.get(key);
    if (!textFile) {
      console.warn(`⚠️ 找不到对应的 Text 文件: ${relative}`);
      continue;
    }

    function sanitizeFileName(name) {
      return String(name).replace(/[\\\/:*?"<>|]/g, "_");
    }

    const category = sanitizeFileName(path.dirname(relative)); // 如 Card
    const name = sanitizeFileName(path.basename(dataFile, ".csv")); // 如 Card

    const dataRows = readCSV(dataFile).slice(2);
    const textRows = readCSV(textFile).slice(2);

    const textMap = new Map();
    textRows.forEach((row) => {
      textMap.set(row.Id, row);
    });

    const outputDir = path.join(outputRoot, category, name);
    fs.mkdirSync(outputDir, { recursive: true });

    const indexContent = [
      `# ${name} 列表\n`,
      `| 名称 | 描述 |`,
      `| --- | --- |`,
    ];

    dataRows.forEach((row) => {
      const text = textMap.get(row.Id) || {};
      const displayName = text.Name || row.Id;
      const description = escapeMarkdown(text.Description || text.描述 || "");
      const fileName = sanitizeFileName(row.Id);
      indexContent.push(
        `| [${displayName}](./${fileName}.md) | ${description} |`
      );
    });
    writeMarkdown(
      path.join(outputRoot, category, name, "index.md"),
      indexContent.join("\n")
    );

    // ✅ 生成详情页
    dataRows.forEach((row) => {
      const text = textMap.get(row.Id) || {};
      const displayName = text.Name || text.Id || row.Id;
      const fileName = sanitizeFileName(row.Id);
      const md = renderMarkdown(displayName, { ...row, ...text }, buffMap);
      writeMarkdown(path.join(outputDir, `${fileName}.md`), md);
    });
    generateCategoryHome(path.join(outputRoot, category));
    console.log(`✅ 已生成 ${category}/${name}`);
  }
}

function generateCategoryHome(categoryDir, textMap = new Map()) {
  const category = path.basename(categoryDir);

  const subDirs = fs.readdirSync(categoryDir).filter(name =>
    fs.statSync(path.join(categoryDir, name)).isDirectory()
  );

  const indexContent = [
    `# ${category} 列表\n`,
    `| 名称 | 描述 |`,
    `| --- | --- |`,
  ];

  subDirs.forEach(sub => {
    const text = textMap.get(sub) || {};
    const displayName = text.Name || sub;
    const description = escapeMarkdown(text.Description || text.描述 || '');

    indexContent.push(
      `| [${displayName}](./${encodeURIComponent(sub)}/) | ${description} |`
    );
  });

  const indexPath = path.join(categoryDir, 'index.md');
  writeMarkdown(indexPath, indexContent.join('\n'));
}

generatePages();
