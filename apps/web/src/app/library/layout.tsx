import { SelectionProvider } from "@/context/selection-context";
import { ObservatoryShell } from "@/components/layout";

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SelectionProvider>
      <ObservatoryShell>{children}</ObservatoryShell>
    </SelectionProvider>
  );
}
