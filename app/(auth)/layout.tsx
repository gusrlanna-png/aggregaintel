import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ImportProvider } from "@/components/import/import-provider";
import { ImportIndicator } from "@/components/import/import-indicator";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ImportProvider>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-[900px] flex-1 px-4 pb-24 pt-4">
          {children}
        </main>
        <ImportIndicator />
        <BottomNav />
      </div>
    </ImportProvider>
  );
}
