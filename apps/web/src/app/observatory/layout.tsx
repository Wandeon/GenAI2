import { SelectionProvider } from "@/context/selection-context";
import { MobileLaneProvider } from "@/context/mobile-lane-context";
import { ObservatoryShell } from "@/components/layout";

export default function ObservatoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SelectionProvider>
      <MobileLaneProvider>
        <ObservatoryShell>{children}</ObservatoryShell>
      </MobileLaneProvider>
    </SelectionProvider>
  );
}
