import { LegalPage } from "../components/LegalPage";

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy. Lighthouse." updated="19 August 2026">
      <p>
        <strong>App:</strong> Lighthouse{" "}
        <code>fund.fastforward.lighthouse.child</code>
        <br />
        <strong>Developer and legal entity:</strong> Fast Forward Venture Studio
        <br />
        <strong>Contact:</strong>{" "}
        <a href="mailto:privacy@prosperitytech.org">privacy@prosperitytech.org</a>
      </p>

      <p>
        Lighthouse is a parental safety companion app that runs on a child’s Android phone. A
        parent or guardian sets it up on the child’s device using their own email address. There is
        no separate parent app. The parent receives email alerts when something serious happens, and
        a calm weekly summary. This policy explains what data the app accesses, how it is used, and
        how it is shared. Together with the disclosures shown inside the app, it covers all data the
        app accesses, collects, uses, and shares.
      </p>

      <h2>Accessibility Service</h2>
      <p>
        Lighthouse uses Android’s Accessibility Service to read on screen text in the apps it
        watches, so it can detect unsafe content as it appears and show a protective screen.
        Examples of what it looks for are explicit material, grooming, bullying, and self harm.{" "}
        <strong>
          The on screen content is analysed entirely on the device. It is never stored, never
          transmitted off the device, and never shown to the parent.
        </strong>{" "}
        Only a derived safety category and severity is recorded, for example “sexual content, high”.
        The app shows a prominent disclosure and asks for consent before the Accessibility Service is
        enabled.
      </p>

      <h2>Data we collect and share</h2>
      <ul>
        <li>
          <strong>Safety signals.</strong> A category and severity derived on the device from
          flagged content, plus the app it occurred in and the time. Shared only with the parent or
          guardian who set up the device, by email. The underlying messages, text, or images are
          never included.
        </li>
        <li>
          <strong>Location.</strong> Approximate or precise device location, collected periodically,
          including in the background, and shared only with the paired parent or guardian, so a
          guardian can see where the child is for safety. A prominent disclosure is shown inside the
          app before background location is enabled.
        </li>
        <li>
          <strong>Device status.</strong> Battery level, connectivity and permission state, and a
          device identifier used to keep the pairing working.
        </li>
      </ul>
      <p>
        We do <strong>not</strong> collect or transmit the content of the child’s messages, posts,
        searches, photos, or web browsing. Data is encrypted in transit with HTTPS and at rest with
        AES 256 GCM. We do not sell personal data, and we do not share it for advertising.
      </p>

      <h2>How data is used</h2>
      <p>
        Solely to provide the safety features described above to the paired guardian. Data is
        retained only as long as the device is paired. Unpairing or uninstalling stops collection,
        and associated data can be deleted on request.
      </p>

      <h2>Children</h2>
      <p>
        The app is intended for use on a child’s device under the supervision of a parent or
        guardian, who sets it up and controls the pairing. The child is shown, inside the app, when
        the app is active and what it does.
      </p>

      <h2>Your choices</h2>
      <p>
        A guardian can unpair the device or uninstall the app at any time to stop all collection. To
        request access to or deletion of data associated with a device, contact{" "}
        <a href="mailto:privacy@prosperitytech.org">privacy@prosperitytech.org</a>.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy. Material changes will be posted here with a revised date.
      </p>
    </LegalPage>
  );
}
