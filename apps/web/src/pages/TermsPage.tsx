import { LegalPage } from "../components/LegalPage";

export function TermsPage() {
  return (
    <LegalPage title="Terms of Service." updated="19 August 2026">
      <p>
        These terms cover your use of Lighthouse, a parental safety app for Android provided by Fast
        Forward Venture Studio. Lighthouse is free for families. By installing or using it, you
        agree to these terms. If you do not agree, please do not use the app.
      </p>

      <h2>Who may use Lighthouse</h2>
      <p>
        You must be an adult. You may set up Lighthouse only on a device that you own, or on a
        device belonging to a child for whom you are the parent or legal guardian. You are
        responsible for that device and for the person who uses it.
      </p>
      <p>
        The child is always shown that the app is active. Lighthouse does not hide, and we will not
        help anyone hide it. The child can see what the app watches, what it can never see, and when
        something was flagged.
      </p>

      <h2>What Lighthouse does</h2>
      <p>
        Lighthouse reads what is on screen, on the device itself, and looks for signs of unsafe
        content. When it finds something serious it can show a protective screen on the phone and
        send an email alert to the parent or guardian who set it up. It also sends a short weekly
        summary by email.
      </p>

      <h2>What Lighthouse does not promise</h2>
      <p>
        Lighthouse is a safety aid. It is not a guarantee. We do not promise that it will catch or
        block every piece of harmful content, that it will never flag something harmless, or that it
        will work without interruption. Phones, operating systems, and other apps change, and some
        content will always slip past.
      </p>
      <p>
        Lighthouse does not replace parental supervision or conversation. Please keep talking with
        your child. If a child is in danger, contact your local emergency services.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Use Lighthouse only on a device you own or one belonging to a child you are the legal guardian for.</li>
        <li>Do not use Lighthouse to secretly monitor another adult. That is not what it is for, and it is not permitted.</li>
        <li>Do not attempt to hide the app from the person using the device.</li>
        <li>Do not misuse, copy, resell, or interfere with the app or the service behind it.</li>
      </ul>
      <p>
        You are responsible for following the laws that apply where you live, including any laws
        about monitoring and consent.
      </p>

      <h2>Cost</h2>
      <p>
        Lighthouse is free for families. There is no fee, and there is no uptime guarantee. Features
        may change, pause, or be removed while we build the product with families. We may introduce
        paid plans in the future. If we do, we will tell you before anything changes for you.
      </p>

      <h2>Changes and ending your use</h2>
      <p>
        You can stop at any time by uninstalling the app or disconnecting the device. We may change,
        suspend, or end the service, or any account, if the service is being misused or if we can no
        longer run it. Where we reasonably can, we will give notice first.
      </p>

      <h2>Disclaimer and limits</h2>
      <p>
        The app is provided as is, without warranties of any kind, to the fullest extent allowed by
        law. To the fullest extent allowed by law, Fast Forward Venture Studio is not liable for
        indirect or consequential loss, or for harm arising from content that Lighthouse did not
        detect or did not block. Nothing in these terms limits liability that cannot be limited by
        law.
      </p>

      <h2>Privacy</h2>
      <p>
        How we handle data is described in our <a href="/privacy">Privacy Policy</a>. The short
        version is that content is checked on the phone, never saved, never sent, and never shown to
        the parent. Only a safety category ever leaves the device.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the Federal Republic of Nigeria, and the courts of
        Nigeria have jurisdiction over any dispute.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Write to{" "}
        <a href="mailto:hello@prosperitytech.org">hello@prosperitytech.org</a>.
      </p>
    </LegalPage>
  );
}
