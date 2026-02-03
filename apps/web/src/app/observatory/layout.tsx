import { TimeProvider } from "@/context/time-context";
import { SelectionProvider } from "@/context/selection-context";
import { ObservatoryShell } from "@/components/layout";

export default function ObservatoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TimeProvider>
      <SelectionProvider>
        <ObservatoryShell>{children}</ObservatoryShell>
      </SelectionProvider>
    </TimeProvider>
  );
}
