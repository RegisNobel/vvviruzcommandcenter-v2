export default function AdminAuthLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-app px-4 py-10 text-ink sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 subtle-grid opacity-35" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-primary-soft blur-[120px]" />
      <div className="relative z-10 mx-auto max-w-md">{children}</div>
    </div>
  );
}
