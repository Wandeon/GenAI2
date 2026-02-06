import { DailyDesktop } from "@/components/daily/daily-desktop";
import { DailyMobile } from "@/components/daily/daily-mobile";

export default function DailyRunPage() {
  return (
    <>
      <div className="hidden md:block">
        <DailyDesktop />
      </div>
      <div className="md:hidden">
        <DailyMobile />
      </div>
    </>
  );
}
