import Header from "@/components/Header";
import SavedList from "@/components/SavedList";

export const metadata = {
  title: "Your account · HospiScore",
  description: "Saved properties and score history for your account.",
};

export default function AccountPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          My account
        </h1>
        <SavedList />
      </main>
      <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        HospiScore · Hospitality OS
      </footer>
    </div>
  );
}