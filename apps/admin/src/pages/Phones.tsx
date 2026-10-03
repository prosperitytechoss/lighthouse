import { useEffect, useState } from "react";

import * as api from "../api";
import { type Overview } from "../api";
import { ParentList, StatusHelp } from "../DeviceList";
import { Page, Spinner, errMsg } from "../ui";

export function Phones({ openId }: { openId?: string }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(openId ?? null);

  useEffect(() => {
    api.getOverview().then(setOv).catch((e) => setErr(errMsg(e, "Phones did not load")));
  }, []);
  useEffect(() => { if (openId) setOpen(openId); }, [openId]);

  const q = search.trim().toLowerCase();
  const shown = (ov?.devices ?? []).filter((d) => !q || [d.name, d.assignee, d.account].some((v) => v?.toLowerCase().includes(q)));

  return (
    <Page title="Phones" blurb="Every parent and their phones. Click a phone to see its settings and recent alerts." errors={[err]}>
      {!ov && !err ? <Spinner /> : ov && (
        <>
          <div className="row wrap between" style={{ marginBottom: 12 }}>
            <input placeholder="Search by phone, child or parent" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
            <span className="row muted small" style={{ gap: 8 }}>{ov.stats.parents ?? 0} parent{ov.stats.parents === 1 ? "" : "s"}, {ov.stats.totalDevices} phone{ov.stats.totalDevices === 1 ? "" : "s"}<StatusHelp hours={ov.stats.silenceHours} /></span>
          </div>
          <ParentList devices={shown} open={open} onOpen={setOpen} emptyText={q ? `No phone matches "${search}".` : "No phones set up yet."} />
        </>
      )}
    </Page>
  );
}
