const bcrypt = require("bcrypt");
const crypto = require("crypto");

const { getAdminUser, saveAdminUser, getNews, saveNews } = require("../utils/fileDb");
const { slugify, ensureUniqueSlug } = require("../utils/slug");
const { toISODate } = require("../utils/format");
const { extractArticleData } = require("../utils/extractArticleData");

async function ensureDefaultAdmin() {
  const existing = await getAdminUser();
  if (existing?.username && existing?.passwordHash) {
    return existing;
  }

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin12345";
  const passwordHash = await bcrypt.hash(password, 10);
  const user = { username, passwordHash };
  await saveAdminUser(user);
  return user;
}

function toClientNews(item) {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    date: item.date,
    summary: item.summary,
    content: item.content,
    image: item.image,
    sourceUrl: item.sourceUrl || "",
    category: item.category,
    createdAt: item.createdAt
  };
}

async function buildNewsPayload(cleanedNews) {
  const fallbackDate = new Date().toISOString().split("T")[0];
  let extracted = {};
  if (cleanedNews.sourceUrl) {
    try {
      extracted = await extractArticleData(cleanedNews.sourceUrl);
    } catch (error) {
      extracted = {};
    }
  }

  // If no image was extracted from URL, use a default energy-themed placeholder
  const defaultImage = "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800&h=600&fit=crop";
  const image = cleanedNews.image || extracted.image || defaultImage;

  return {
    title: cleanedNews.title || extracted.title || "Untitled",
    sourceUrl: cleanedNews.sourceUrl || "",
    date: toISODate(cleanedNews.date || extracted.date || fallbackDate),
    summary: cleanedNews.summary || extracted.summary || "Summary not available from source.",
    content:
      cleanedNews.content ||
      extracted.content ||
      `Article details were sourced from: ${cleanedNews.sourceUrl || "N/A"}`,
    image: image,
    category: cleanedNews.category
  };
}

function isApiAuthenticated(req, res, next) {
  if (!req.session.isAuthenticated) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  return next();
}

async function getAuthStatus(req, res) {
  res.json({ ok: true, isAuthenticated: Boolean(req.session.isAuthenticated) });
}

async function login(req, res) {
  const { username = "", password = "" } = req.body || {};
  const admin = await ensureDefaultAdmin();
  const usernameMatch = username.trim() === admin.username;
  const passwordMatch = await bcrypt.compare(password, admin.passwordHash);

  if (!usernameMatch || !passwordMatch) {
    return res.status(401).json({ ok: false, error: "Invalid username or password." });
  }

  req.session.isAuthenticated = true;
  return res.json({ ok: true });
}

function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) return next(error);
    return res.json({ ok: true });
  });
}

async function listNews(req, res) {
  const items = await getNews();
  const sorted = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ ok: true, news: sorted.map(toClientNews) });
}

async function getNewsBySlug(req, res) {
  const items = await getNews();
  const item = items.find((entry) => entry.slug === req.params.slug);
  if (!item) {
    return res.status(404).json({ ok: false, error: "News article not found" });
  }

  const related = items
    .filter((entry) => entry.slug !== item.slug && entry.category === item.category)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3)
    .map(toClientNews);

  return res.json({ ok: true, article: toClientNews(item), related });
}

async function createNews(req, res) {
  if (req.validationErrors.length) {
    return res.status(400).json({ ok: false, errors: req.validationErrors });
  }

  const items = await getNews();
  const baseSlug = slugify(req.cleanedNews.title);
  const uniqueSlug = ensureUniqueSlug(
    baseSlug,
    items.map((item) => item.slug),
    null,
    items
  );

  let hydrated;
  try {
    hydrated = await buildNewsPayload(req.cleanedNews);
  } catch (error) {
    return res.status(400).json({ ok: false, errors: [`Could not fetch article data from URL: ${error.message}`] });
  }

  const payload = {
    id: crypto.randomUUID(),
    title: hydrated.title,
    slug: uniqueSlug,
    date: hydrated.date,
    summary: hydrated.summary,
    content: hydrated.content,
    image: hydrated.image,
    sourceUrl: hydrated.sourceUrl,
    category: hydrated.category,
    createdAt: new Date().toISOString()
  };

  items.push(payload);
  await saveNews(items);
  return res.status(201).json({ ok: true, item: toClientNews(payload) });
}

async function updateNews(req, res) {
  if (req.validationErrors.length) {
    return res.status(400).json({ ok: false, errors: req.validationErrors });
  }

  const items = await getNews();
  const target = items.find((entry) => entry.id === req.params.id);
  if (!target) {
    return res.status(404).json({ ok: false, error: "News article not found" });
  }

  const baseSlug = slugify(req.cleanedNews.title);
  const uniqueSlug = ensureUniqueSlug(
    baseSlug,
    items.map((item) => item.slug),
    target.id,
    items
  );

  let hydrated;
  try {
    hydrated = await buildNewsPayload(req.cleanedNews);
  } catch (error) {
    return res.status(400).json({ ok: false, errors: [`Could not fetch article data from URL: ${error.message}`] });
  }

  target.title = hydrated.title;
  target.slug = uniqueSlug;
  target.date = hydrated.date;
  target.summary = hydrated.summary;
  target.content = hydrated.content;
  target.image = hydrated.image;
  target.sourceUrl = hydrated.sourceUrl;
  target.category = hydrated.category;

  await saveNews(items);
  return res.json({ ok: true, item: toClientNews(target) });
}

async function deleteNews(req, res) {
  const items = await getNews();
  const nextItems = items.filter((item) => item.id !== req.params.id);
  if (items.length === nextItems.length) {
    return res.status(404).json({ ok: false, error: "News article not found" });
  }

  await saveNews(nextItems);
  return res.json({ ok: true });
}

module.exports = {
  isApiAuthenticated,
  getAuthStatus,
  login,
  logout,
  listNews,
  getNewsBySlug,
  createNews,
  updateNews,
  deleteNews
};
