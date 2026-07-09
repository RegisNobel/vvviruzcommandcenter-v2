import {CommandCenterNav} from "@/components/command-center-nav";
import {requireAuthenticatedAdminSession} from "@/lib/auth/server";

export default async function ProtectedAdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAuthenticatedAdminSession();

  return (
    <div className="admin-signal-scope min-h-screen bg-app">
      <CommandCenterNav />
      <div className="lg:pl-64">
        {children}
      </div>
    </div>
  );
}
