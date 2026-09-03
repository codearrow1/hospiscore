export default function AccountSettingsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading account settings" className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600 dark:border-zinc-700 dark:border-t-indigo-400" />
    </div>
  );
}
