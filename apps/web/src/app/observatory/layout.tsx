import { ObservatoryShell } from "@/components/layout";

export default function ObservatoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ObservatoryShell>{children}</ObservatoryShell>;
}
