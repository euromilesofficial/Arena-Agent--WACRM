import { useApp } from "../../lib/store";
import { Drawer } from "../ui";
import { DomainDetails } from "./DomainDetails";

/** Narrow-viewport home for the same panel the wide layout shows inline. */
export function SiteDrawer({ siteId, onClose }: { siteId: string; onClose: () => void }) {
  const app = useApp();
  const site = app.data?.sites.find((s) => s.id === siteId);
  return (
    <Drawer title="Domain Details" sub={site ? `${site.name} · ${site.host}` : "Website"} icon="server" onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Close</button>}>
      <DomainDetails siteId={siteId} />
    </Drawer>
  );
}
