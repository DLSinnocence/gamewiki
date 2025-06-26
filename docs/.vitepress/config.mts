import { defineConfig, type DefaultTheme } from "vitepress";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 解决 ESM 没有 __dirname 的问题
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 生成 Nav 和 Sidebar
export function getWikiNavAndSidebar(): {
  nav: DefaultTheme.NavItem[];
  sidebar: DefaultTheme.SidebarMulti;
} {
  // 解决 ESM 下 __dirname
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // 固定 Wiki 根目录，根据你实际情况修改
  const wikiRoot = path.resolve(__dirname, "../");

  const categories = fs.readdirSync(wikiRoot).filter((name) => {
    const dirPath = path.join(wikiRoot, name);
    return fs.statSync(dirPath).isDirectory();
  });

  const nav = [
    {
      text: "Wiki",
      link: "/",
    },
  ];
  const sidebar: DefaultTheme.SidebarMulti = {};

  for (const category of categories) {
    const categoryDir = path.join(wikiRoot, category);
    const subDirs = fs
      .readdirSync(categoryDir)
      .filter((name) =>
        fs.statSync(path.join(categoryDir, name)).isDirectory()
      );

    // 把每个子文件夹映射成折叠项数组
    const items = subDirs.map((subDir) => {
      const subDirPath = path.join(categoryDir, subDir);

      const files = fs
        .readdirSync(subDirPath)
        .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "index.md");

      const subItems = files.map((file) => {
        const name = file.replace(/\.md$/, "");
        return {
          text: name,
          link: `/${category}/${subDir}/${encodeURIComponent(name)}`,
        };
      });

      return {
        text: subDir,
        collapsed: true,
        link: `/${category}/${subDir}/`,
        items: subItems,
      };
    });

    sidebar[`/${category}/`] = items;
  }

  function toTitleCase(str) {
    return str.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const wikiIndexPath = path.join(wikiRoot, "index.md");
  if (!fs.existsSync(wikiIndexPath)) {
    const indexContent = [
      "# Wiki 首页\n",
      "欢迎来到 Wiki 首页，以下是所有分类：\n",
      "| 类型 | 链接 |",
      "| ---- | ---- |",
    ];

    categories.forEach((category) => {
      const title = toTitleCase(category);
      indexContent.push(
        `| ${title} | [查看](/${encodeURIComponent(category)}/) |`
      );
    });

    fs.writeFileSync(wikiIndexPath, indexContent.join("\n"), "utf-8");
  }

  return { nav, sidebar };
}

const { nav, sidebar } = getWikiNavAndSidebar();

export default defineConfig({
  ignoreDeadLinks: true,
  title: "游戏 Wiki",
  description: "基于 CSV 自动生成的 Wiki",
  base: "/gamewiki/", // 如果部署到子路径，注意修改
  themeConfig: {
    nav,
    sidebar,
    socialLinks: [{ icon: "github", link: "https://github.com/your-repo" }],
  },
});
