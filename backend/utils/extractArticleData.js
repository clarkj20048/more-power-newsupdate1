const { URL } = require("url");

function pickMetaContent(html, patterns, pageUrl = "") {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match || !match[1]) continue;
    const value = match[1].trim();
    if (!value) continue;

    if (pattern.toString().includes("image")) {
      try {
        return new URL(value, pageUrl).href;
      } catch {
        continue;
      }
    }

    return value;
  }
  return "";
}

/**
 * Extracts images from page content by searching for img tags, article images, etc.
 * This provides a fallback when meta tags don't contain images.
 */
function extractImageFromContent(html, pageUrl) {
  const images = [];
  
  // Pattern 1: Find images in <figure> or <article> tags (often featured images)
  const articleImgPatterns = [
    /<article[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>[\s\S]*?<\/article>/i,
    /<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>[\s\S]*?<\/figure>/i,
    /<div[^>]+class=["'][^"']*feature[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>/i,
  ];
  
  for (const pattern of articleImgPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      try {
        const url = new URL(match[1], pageUrl).href;
        // Filter out tracking pixels, icons, and small images
        if (!url.includes('pixel') && !url.includes('icon') && !url.includes('logo')) {
          images.push(url);
        }
      } catch {
        // Continue to next pattern
      }
    }
  }
  
  // Pattern 2: Find all img tags with meaningful src attributes
  const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
  for (const match of imgMatches) {
    const src = match[1];
    if (!src || src.startsWith('data:') || src.includes('pixel') || src.includes('icon') || src.includes('logo') || src.includes('avatar')) {
      continue;
    }
    try {
      const url = new URL(src, pageUrl).href;
      // Filter by common image extensions and minimum path length (to avoid tracking pixels)
      if (url.match(/\.(jpg|jpeg|png|webp|svg|avif)(\?|$)/i) || src.length > 50) {
        if (!images.includes(url)) {
          images.push(url);
        }
      }
    } catch {
      // Continue to next image
    }
  }
  
  // Pattern 3: Look for first contentful image in style tags or background images
  const bgImgPattern = /url\(["']?([^"')]+\.(jpg|jpeg|png|webp|avif)[^"')]*)\)?/gi;
  const bgMatches = [...html.matchAll(bgImgPattern)];
  for (const match of bgMatches) {
    const src = match[1];
    if (src && !src.includes('data:') && !src.includes('pixel') && !src.includes('icon')) {
      try {
        const url = new URL(src, pageUrl).href;
        if (!images.includes(url)) {
          images.push(url);
        }
      } catch {
        // Continue
      }
    }
  }
  
  // Return the first valid image found
  return images.length > 0 ? images[0] : "";
}

function stripHtml(value = "") {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractParagraphText(html = "", limit = 1800) {
  const matches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  const text = matches
    .slice(0, 14)
    .map((item) => stripHtml(item[1]))
    .filter(Boolean)
    .join("\n\n")
    .slice(0, limit);
  return text;
}

/**
 * Extracts a summary from article body content when meta tags are not available.
 * Finds the first meaningful paragraph(s) from the article.
 */
function extractSummaryFromContent(html = "", maxLength = 320) {
  // Common patterns for article content containers
  const contentPatterns = [
    // Look for article or main content areas
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]+class=["'][^"']*(?:content|article|post|entry|story|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ];

  let contentHtml = "";
  
  // Try to find a content container first
  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      contentHtml = match[1];
      break;
    }
  }

  // If no container found, use the whole HTML
  if (!contentHtml) {
    contentHtml = html;
  }

  // Extract paragraphs from the content
  const paragraphMatches = [...contentHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  
  // Filter out short paragraphs (likely navigation, ads, etc.) and get meaningful ones
  const meaningfulParagraphs = paragraphMatches
    .map(item => stripHtml(item[1]))
    .filter(text => text.length >= 50 && text.length <= 500); // 50-500 chars is a good summary length

  if (meaningfulParagraphs.length > 0) {
    // Join first 2-3 paragraphs to create a comprehensive summary
    const summary = meaningfulParagraphs.slice(0, 3).join(" ");
    return summary.slice(0, maxLength);
  }

  return "";
}

function toISODate(value = "") {
  // Treat empty string, null, and undefined as falsy to allow fallback
  if (!value || value === "") return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().split("T")[0];
}

async function extractArticleData(sourceUrl) {
  const response = await fetch(sourceUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "accept-encoding": "gzip, deflate, br",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  const html = await response.text();
  const title = pickMetaContent(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i
  ]);
  
  // Try to get summary from meta tags first
  let summary = pickMetaContent(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["'][^>]*>/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i
  ]);
  
  // If no meta summary found, extract from article body content
  if (!summary || summary.trim() === "") {
    summary = extractSummaryFromContent(html, 320);
  }
  
  const image = pickMetaContent(
    html,
    [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i
    ],
    sourceUrl
  ) || extractImageFromContent(html, sourceUrl);
  const publishedRaw = pickMetaContent(html, [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["'][^>]*>/i,
    /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<time[^>]+datetime=["']([^"']+)["'][^>]*>/i
  ]);

  return {
    title: stripHtml(title).slice(0, 160),
    summary: stripHtml(summary).slice(0, 320),
    content: extractParagraphText(html),
    image,
    date: toISODate(publishedRaw)
  };
}

module.exports = {
  extractArticleData
};

