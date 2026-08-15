import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { PMS_MODULES } from "@/lib/modules";
import { MODULE_ALIASES } from "@/lib/featurePages";
import { SOLUTIONS } from "@/lib/solutions";
import { BLOG_POSTS } from "@/lib/posts";
import { CASE_STUDIES } from "@/lib/caseStudies";
import { NEWS_ITEMS } from "@/lib/news";
import { UPDATES } from "@/lib/updates";
import { KNOWLEDGE_ARTICLES } from "@/lib/knowledge";
import { CAREER_ROLES } from "@/lib/careers";
import { properties } from "@/lib/data";

const lastModified = "2026-08-08";

export default function sitemap(): MetadataRoute.Sitemap {
  const marketing: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/platform`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/pricing`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/solutions`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/integrations`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/contact`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/blog`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/demo`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/free-score`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/faq`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/security`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/migration`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/alternatives`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/case-studies`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/news`, lastModified, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/product-updates`, lastModified, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/product-videos`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/knowledge-base`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/careers`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.2 },
  ];

  const platformSlugs = new Set<string>();
  for (const m of PMS_MODULES) platformSlugs.add(m.id);
  for (const alias of Object.keys(MODULE_ALIASES)) platformSlugs.add(alias);

  const platformPages: MetadataRoute.Sitemap = [...platformSlugs].map((slug) => ({
    url: `${SITE_URL}/platform/${slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const solutionPages: MetadataRoute.Sitemap = SOLUTIONS.map((s) => ({
    url: `${SITE_URL}/solutions/${s.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const blogPages: MetadataRoute.Sitemap = BLOG_POSTS.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: p.date,
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  const caseStudyPages: MetadataRoute.Sitemap = CASE_STUDIES.map((c) => ({
    url: `${SITE_URL}/case-studies/${c.slug}`,
    lastModified: c.date,
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  const newsPages: MetadataRoute.Sitemap = NEWS_ITEMS.map((n) => ({
    url: `${SITE_URL}/news/${n.slug}`,
    lastModified: n.date,
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  const updatePages: MetadataRoute.Sitemap = UPDATES.map((u) => ({
    url: `${SITE_URL}/product-updates/${u.slug}`,
    lastModified: u.date,
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  const knowledgePages: MetadataRoute.Sitemap = KNOWLEDGE_ARTICLES.map((a) => ({
    url: `${SITE_URL}/knowledge-base/${a.slug}`,
    lastModified: a.updated,
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  const careerPages: MetadataRoute.Sitemap = CAREER_ROLES.map((r) => ({
    url: `${SITE_URL}/careers/${r.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  const propertyPages: MetadataRoute.Sitemap = properties.map((p) => ({
    url: `${SITE_URL}/properties/${p.slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [
    ...marketing,
    ...platformPages,
    ...solutionPages,
    ...blogPages,
    ...caseStudyPages,
    ...newsPages,
    ...updatePages,
    ...knowledgePages,
    ...careerPages,
    ...propertyPages,
  ];
}
