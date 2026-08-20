import { seedDemoUsersCli } from "@/lib/marketing/seed";

seedDemoUsersCli().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});