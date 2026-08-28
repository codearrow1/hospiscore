import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/account",
          "/api",
          // Property CLAIM pages are thin no-metadata forms — keep them out of
          // the index while public /properties/[slug] listings stay crawlable.
          "/properties/*/claim",
          // Internal command/control panels must never be indexed.
          "/saas",
          "/customer",
          "/dashboard",
          "/subadmin",
          "/marketing-admin",
          "/staff",
          "/partner",
          "/affiliate",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
