import { TimeProvider } from "@/context/time-context";
import { SelectionProvider } from "@/context/selection-context";
import { MobileLaneProvider } from "@/context/mobile-lane-context";
import { ObservatoryShell } from "@/components/layout";

export default function ObservatoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TimeProvider>
      <SelectionProvider>
        <MobileLaneProvider>
          <ObservatoryShell>{children}</ObservatoryShell>
        </MobileLaneProvider>
      </SelectionProvider>
    </TimeProvider>
  );
}
