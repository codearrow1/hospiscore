/**
 * Open roles for the /careers hub and /careers/[slug] detail pages.
 */

export interface CareerRole {
  slug: string;
  title: string;
  team: string;
  location: string;
  type: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave?: string[];
}

export const CAREER_ROLES: CareerRole[] = [
  {
    slug: "senior-product-engineer",
    title: "Senior Product Engineer",
    team: "Engineering",
    location: "Remote (worldwide)",
    type: "Full-time",
    summary:
      "Own real-time features across reservations, housekeeping and channel sync — the core of what makes HospiOS feel instant.",
    responsibilities: [
      "Build and ship real-time features across the PMS core",
      "Own quality end to end: tests, type safety, observability",
      "Work directly with designers and customer success on what matters",
      "Mentor engineers and raise the bar on the codebase",
    ],
    requirements: [
      "5+ years building production web applications",
      "Deep TypeScript and React experience",
      "Comfort with databases and real-time sync systems",
      "A bias for shipping small, reviewed, tested changes",
    ],
    niceToHave: [
      "Experience in hospitality or booking software",
      "Public REST API or webhook design",
      "Mobile-first product experience",
    ],
  },
  {
    slug: "product-designer",
    title: "Product Designer",
    team: "Design",
    location: "Remote (worldwide)",
    type: "Full-time",
    summary:
      "Design the screens a front desk runs on all day — fast, forgiving and delightful even at 2am check-in.",
    responsibilities: [
      "Design end-to-end flows across PMS, POS and guest portal",
      "Turn dense operational data into calm, glanceable interfaces",
      "Run quick usability tests with real hotel staff",
      "Contribute to our design system and motion language",
    ],
    requirements: [
      "Strong portfolio of complex, data-heavy products",
      "Fluency in design tools and prototyping",
      "Opinionated about motion, spacing and accessibility",
      "Comfortable collaborating with engineers daily",
    ],
    niceToHave: [
      "Experience designing for mobile or offline contexts",
      "Hospitality, point-of-sale or booking experience",
    ],
  },
  {
    slug: "implementation-specialist",
    title: "Customer Implementation Specialist",
    team: "Customer Success",
    location: "Remote (EMEA or APAC)",
    type: "Full-time",
    summary:
      "Own the first week for every new property — data migration, configuration, and the first night audit.",
    responsibilities: [
      "Run migrations and configuration for new properties",
      "Guide customers through the go-live checklist",
      "Troubleshoot channel mapping and data imports",
      "Feed product feedback from the front lines",
    ],
    requirements: [
      "Experience with hotel operations or hotel software",
      "Excellent, patient communication skills",
      "Comfort with data imports, mapping and spreadsheets",
      "Self-directed across time zones",
    ],
    niceToHave: [
      "Used a major PMS (Mews, Cloudbeds, Opera, etc.)",
      "Worked in a front desk or housekeeping role",
    ],
  },
  {
    slug: "customer-marketing-lead",
    title: "Customer Marketing Lead",
    team: "Marketing",
    location: "Remote (worldwide)",
    type: "Full-time",
    summary:
      "Turn happy properties into stories — case studies, community, and the content that proves HospiOS works.",
    responsibilities: [
      "Own customer stories, case studies and testimonials",
      "Run the customer community and win-back journeys",
      "Measure the revenue impact of marketing campaigns",
      "Collaborate with sales on lifecycle email",
    ],
    requirements: [
      "3+ years in customer or content marketing",
      "Storytelling that earns trust, not hype",
      "Comfort with analytics and experimentation",
      "Genuine interest in the hospitality industry",
    ],
    niceToHave: [
      "B2B SaaS experience",
      "Video storytelling skills",
    ],
  },
];

export function getCareerRole(slug: string): CareerRole | undefined {
  return CAREER_ROLES.find((r) => r.slug === slug);
}
