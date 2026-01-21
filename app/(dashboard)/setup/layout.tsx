/**
 * Setup Wizard Layout
 * Minimal layout without navbar for first-time setup flow
 */

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
