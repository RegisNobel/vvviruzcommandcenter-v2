import {CommandCenterNav} from "@/components/command-center-nav";
import {requireAuthenticatedAdminSession} from "@/lib/auth/server";

export default async function ProtectedAdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAuthenticatedAdminSession();

  return (
    <div className="min-h-screen bg-[#0f1114]">
      <CommandCenterNav />
      <div className="lg:pl-64">
        {children}
      </div>
    </div>
  );
}
