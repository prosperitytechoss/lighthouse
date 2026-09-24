import { Events } from "../Events";
import { Page } from "../ui";

export function Alerts() {
  return (
    <Page title="Alerts" blurb="Every signal a phone sent, newest first. No message text or pictures ever reach here.">
      <Events />
    </Page>
  );
}
