import { TimeProvider } from "@/context/time-context";
import { ObservatoryShell } from "@/components/layout";

export default function ObservatoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TimeProvider>
      <ObservatoryShell>{children}</ObservatoryShell>
    </TimeProvider>
  );
}
