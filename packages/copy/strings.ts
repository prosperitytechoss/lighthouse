
export const strings = {
  app: {
    name: "Lighthouse",
    parentName: "Lighthouse",
    childName: "Lighthouse",
  },

  common: {
    next: "Next",
    cancel: "Cancel",
    save: "Save",
    saveAndContinue: "Save & continue",
    edit: "Edit",
    dismiss: "Dismiss",
    continue: "Continue",
  },

  onboarding: {
    slide1: {
      headline: "Kids see things they didn't ask for, in apps, chats, and online.",
      subheadline: "Know what your child's apps are showing.",
      button: "Next",
    },
    slide2: {
      headline: "What Lighthouse does, and doesn't do.",
      doesLabel: "What it does",
      doesCount: "6",
      does: [
        {
          title: "Scans messages on your child's phone",
          subtitle: "9 apps incl. WhatsApp, text messages, IG, TikTok and Snapchat",
        },
        { title: "Tracks the child's device", subtitle: "Live location, geofences, battery" },
        { title: "Blurs or pauses severe content", subtitle: "Before it fully loads on screen" },
        { title: "Enforces screen time & bedtime", subtitle: "Daily cap + bedtime window" },
        { title: "Weekly summary to guardians", subtitle: "One email, every Sunday" },
        { title: "Instant alerts for severe incidents", subtitle: "Push to your phone in seconds" },
      ],
      neverLabel: "What it never does",
      neverCount: "4",
      never: [
        {
          title: "Send message contents off the phone",
          subtitle: "Classified on your child's phone, the text never leaves it",
        },
        { title: "Hide itself from the child", subtitle: "Always visible on the child phone" },
        { title: "Share raw chats, photos, or contacts with the parent", subtitle: "" },
        { title: "Sell data or share with advertisers", subtitle: "" },
      ],
      button: "Next",
    },
    slide3: {
      headline: "How Lighthouse works.",
      cards: [
        {
          title: "On your child's phone",
          body: "The AI runs entirely on your child's phone. Their messages never leave it, only the encrypted alert reaches you.",
        },
        {
          title: "Signals, not content",
          body: "Lighthouse reads what's on the phone to check for risk, but only ever records the category, never the actual words or images.",
        },
        {
          title: "Weekly reports & instant alerts",
          body: "A parent gets a Sunday summary by email, and a push the moment a severe flag is detected.",
        },
      ],
      footer:
        "Lighthouse monitors: TikTok, Instagram, Chrome, Snapchat, Roblox, WhatsApp, X, Facebook and text messages.",
      button: "Next",
    },
    // Slide 4, role selector (from the prototype). In the two-app build, "I'm a
    // parent" continues into the parent app; "Pair this device" points to the
    // child app.
    role: {
      headline: "Which best describes you?",
      sub: "This sets up Lighthouse for the right person.",
      parentLabel: "I'm a parent",
      parentDesc: "Set up monitoring, receive weekly reports, manage devices",
      childLabel: "Pair this device with a parent",
      childDesc: "Link this phone, tablet, or laptop to a parent's Lighthouse account",
      footer: "You can always access this from settings.",
    },
    welcome: {
      headline: "Welcome to Lighthouse",
      body: "Pair the Android phone your child uses. Reports are per device, so even a shared phone shows up honestly. Support for iPhone, iPad, and Chromebook is coming in a later release.",
      button: "Pair a device",
      microcopy: "You'll need the device in the same room.",
    },
  },

  parent: {
    nav: { home: "Home", activity: "Activity", location: "Location", settings: "Settings" },
    navTitle: "Lighthouse",

    // Email/password + email-OTP auth (wired to the API).
    auth: {
      login: {
        title: "Welcome back",
        body: "Log in to your Lighthouse account.",
        emailLabel: "Email",
        emailPlaceholder: "you@example.com",
        passwordLabel: "Password",
        passwordPlaceholder: "Your password",
        button: "Log in",
        toSignup: "New to Lighthouse? Create an account",
        forgot: "Forgot password?",
        invalid: "Invalid email or password.",
        needsVerify: "Let's confirm your email first. We've sent you a fresh code.",
      },
      forgot: {
        title: "Reset your password",
        body: "Enter your email and we'll send a 6-digit code to reset your password.",
        emailLabel: "Email",
        emailPlaceholder: "you@example.com",
        button: "Send reset code",
      },
      reset: {
        title: "Set a new password",
        body: (email: string) => `Enter the 6-digit code we sent to ${email}, then choose a new password.`,
        codeLabel: "Reset code",
        codePlaceholder: "6-digit code",
        passwordLabel: "New password",
        passwordPlaceholder: "At least 8 characters",
        button: "Reset password",
        resend: "Resend code",
        resendIn: (s: number) => `Resend code in ${s}s`,
        resent: "A new code is on its way.",
        cooldown: "Please wait a minute before requesting another code.",
        invalid: "That code is invalid or has expired.",
        passwordTooShort: "Use at least 8 characters.",
        success: "Password reset. Please log in with your new password.",
      },
      signup: {
        title: "Create your account",
        body: "We'll email you a 6-digit code to confirm it's you.",
        emailLabel: "Email",
        emailPlaceholder: "you@example.com",
        passwordLabel: "Password",
        passwordPlaceholder: "At least 8 characters",
        button: "Create account",
        toLogin: "Already have an account? Log in",
        passwordTooShort: "Use at least 8 characters.",
        emailInvalid: "Enter a valid email address.",
      },
      otp: {
        title: "Enter your code",
        body: (email: string) => `We sent a 6-digit code to ${email}.`,
        placeholder: "6-digit code",
        button: "Verify",
        resend: "Resend code",
        resendIn: (s: number) => `Resend code in ${s}s`,
        resent: "A new code is on its way.",
        cooldown: "Please wait a minute before requesting another code.",
        invalid: "That code is invalid or has expired.",
        tooMany: "Too many attempts. Request a new code.",
      },
      networkError: "Couldn't reach the server. Check your connection and try again.",
      logout: "Log out",
      loggedOut: "You're logged out.",
    },

    // Device-side encryption key + its recovery phrase. This is key backup, NOT
    // login/auth (no accounts yet). Honest: we genuinely cannot recover it.
    security: {
      hub: {
        title: "Set up your recovery key",
        body: "Lighthouse encrypts your family's data with a key that only lives on your devices. Your 12-word recovery phrase is the backup. Set it up before you pair a device.",
        createButton: "Create my recovery key",
        restoreButton: "I already have a recovery phrase",
        securedTitle: "Recovery key is set up",
        securedBody: "Your key is stored in this phone's secure hardware, and your recovery phrase is your backup. Keep those 12 words somewhere safe.",
        publicKeyLabel: "Public key",
        notConfirmedNote: "You haven't confirmed your recovery phrase yet.",
        confirmNowButton: "Confirm it now",
        replaceButton: "Restore a different recovery phrase",
      },
      reveal: {
        title: "Your recovery phrase",
        body: "These 12 words are the only way to recover your data. Write them down in order and keep them somewhere safe and private.",
        warnTitle: "We can't reset this for you",
        warnBody: "Lighthouse never sees these words. If you lose them, your encrypted data is gone for good. No support team, not even us, can bring it back.",
        savedButton: "I've written it down",
      },
      confirm: {
        title: "Confirm your phrase",
        body: "Quick check so we know it's saved. Enter the words below from your recovery phrase.",
        wordLabel: (n: number) => `Word #${n}`,
        wordPlaceholder: "type the word",
        verifyButton: "Confirm",
        error: "Those don't match your phrase. Check your written copy and try again.",
        successTitle: "Recovery phrase confirmed",
        successBody: "Your recovery key is backed up. Keep those 12 words safe.",
        doneButton: "Continue",
      },
      restore: {
        title: "Restore from recovery phrase",
        body: "Enter your 12-word recovery phrase, in order, separated by spaces. This re-creates your encryption key on this device.",
        inputLabel: "Recovery phrase",
        inputPlaceholder: "word1 word2 word3 ...",
        restoreButton: "Restore my key",
        error: "That recovery phrase isn't valid. Check the 12 words and spacing, then try again.",
        // Shown when an identity already exists on this device.
        overwriteTitle: "This replaces your current key",
        overwriteBody: "There's already a recovery key on this device. Restoring a different phrase replaces it — you'll lose access to anything encrypted with the old key. This can't be undone.",
        overwriteConfirm: "Replace my key",
        overwriteCancel: "Cancel",
        successTitle: "Key restored",
        successBody: "Your encryption key is back on this device.",
        publicKeyLabel: "Public key",
        doneButton: "Continue",
      },
      entryRow: {
        label: "Recovery key",
        sublabel: "Encryption key & recovery phrase",
      },
    },

    pair: {
      headline: "Pair a device",
      body: "Works on phones, tablets, and laptops. Open Lighthouse on the device and scan this code.",
      orEnterCode: "Or enter code",
      code: "483 921",
      expiry: (mmss: string) => `Expires in ${mmss}`,
      simulateScan: "Simulate scan ▸",
      shareLink: "Share link instead",
      footer: "They will see your email address (ope@fastforward.fund) when they link.",
    },

    // Phase 0 to 2 pairing flow (UI only, the real key exchange is Phase 4).
    pairFlow: {
      title: "Pair your child's phone",
      body: "Open Lighthouse on your child's Android phone and scan this code. The phone needs to be in the same room.",
      expiry: "This code expires in 10 minutes.",
      refresh: "Refresh code",
      cancel: "Cancel",
      waiting: "Waiting for the child's phone to scan…",
      naming: {
        title: "Name this device",
        body: "Reports are per device, so give it a name you'll recognise.",
        placeholder: "e.g. Tobi's phone",
        assignLabel: "Who uses it?",
        shared: "Shared",
        unassigned: "Unassigned",
        addPerson: "+ Add someone",
        nameLabel: "Name",
        namePlaceholder: "e.g. Tobi",
        ageLabel: "Age",
        agePlaceholder: "e.g. 13",
        addCancel: "Cancel",
        addConfirm: "Add person",
        save: "Save device",
        errors: {
          deviceName: "Give the device a name.",
          personName: "Name is required.",
          ageRequired: "Age is required.",
          ageWhole: "Age must be a whole number.",
          ageRange: "Enter a real age (1 to 18).",
        },
      },
    },

    newDeviceModal: {
      header: "New device linked",
      deviceInfo: "Apple iPad Air · iPadOS 17 · Lagos · just now",
      nameLabel: "Name this device:",
      namePlaceholder: "Name this device",
      nameHelper: "e.g. 'Family iPad', 'Living room laptop', 'Tobi's phone', 'Amara's Chromebook'",
      usedByLabel: "Primarily used by (optional)",
      chips: ["Unassigned", "Tobi · 13", "Amara · 10", "Shared", "+ Add person"],
      taggingHint: "Tagging a user helps you read reports, it doesn't change what's captured.",
      emailReportLabel: "Email me the weekly report",
      emailReportSublabel: "Sent to your guardians. Manage them in Settings.",
      button: "Save & continue",
      skip: "Skip for now",
      renameHint: "You can rename this anytime in device settings.",
    },

    home: {
      deviceButtons: { settings: "Settings", pause: "Pause" },
      addDevice: "+ Pair another device",
      notifApprove: "Approve",
      notifDeny: "Deny",
      monitoring: "Monitoring",
      deviceNoData: "No activity yet",
      // Device health chip + tap-through guidance.
      // tone review (non-technical, calm cohort).
      health: {
        active: "Active",
        monitoringOff: "Monitoring off",
        notReporting: "Not reporting",
        monitoringOffTitle: "Monitoring is off",
        monitoringOffBody: (name: string) =>
          `Lighthouse monitoring was turned off on ${name}. Open Lighthouse on their phone and turn it back on.`,
        notReportingTitle: "Phone not reporting",
        notReportingBody: (name: string, since: string) =>
          `${name} hasn't checked in for ${since}. It may be off, out of battery, or Lighthouse may have been removed — check the phone is on and the app is still installed.`,
      },
      empty: {
        title: "Pair your first device",
        body: "Set up Lighthouse on your child's Android phone to start watching over their screen time.",
        cta: "Pair a device",
      },
    },

    pauseModal: {
      headline: (deviceName: string) => `Pause ${deviceName}`,
      body: "Stops monitoring and overlays on this device for the chosen window.",
      options: [
        "30 minutes",
        "1 hour",
        "Until tomorrow 6am",
        "School hours (Mon to Fri 8am to 3pm)",
        "Custom...",
      ],
      cancel: "Cancel",
    },

    activity: {
      dateRange: "Last 7 days",
      badge: "Generated on device",
      // Honest: we only ever log FLAGGED signals — benign content produces none —
      // so we report what was flagged, not a fabricated "% normal" (unknowable).
      summary: (total: number, severe: number, platforms: number, deviceLabel: string) =>
        `This week Lighthouse flagged ${total} ${total === 1 ? "signal" : "signals"} on ${deviceLabel}` +
        `${severe > 0 ? `, ${severe} high-severity` : ""}, across ${platforms} ${platforms === 1 ? "app" : "apps"}. ` +
        `Only flagged moments are logged — never normal activity.`,
      emptyTitle: "No activity yet",
      emptyBody: "Once this device reports, the week's signals appear here. Category, severity, app, and time only. Never the content.",
      topApps: "Top apps this week",
      // Legend so the red/amber/blue in the bars is explained — it's SEVERITY.
      legend: { caption: "Severity:", high: "High", review: "Review", low: "Low" },
      categories: "Categories",
      trend: "4 week trend",
      trendLabels: ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Now"],
      footer: "Email report sent Monday 7:00am",
      footerSub: "No content was captured or stored.",
    },

    drilldown: {
      signalsThisWeek: (n: number) => `${n} signals this week`,
      dailyBreakdown: "Daily breakdown",
      topCategories: "Top categories",
      empty: "No signals from this app this week.",
      privacyNotice:
        "Lighthouse observed category signals only. No video frames, images, or content were captured.",
      // Episode drill-down.
      episodes: "What happened",
      episodesEmpty: "No flagged episodes from this app this week.",
      // "47 flags" / "1 flag"
      episodeFlags: (n: number) => `${n} ${n === 1 ? "flag" : "flags"}`,
      // collapsed lower-priority line, e.g. "+ 38 lower-priority flags"
      lowerPriority: (n: number) => `+ ${n} lower-priority ${n === 1 ? "flag" : "flags"}`,
      severityHigh: "High",
    },

    // Real location only; no geofences (not built).
    location: {
      headline: "Location",
      sub: (n: number) => (n === 1 ? "1 device · latest location" : `${n} devices · latest location`),
      devicesLabel: "Devices",
      // Honest empty states.
      emptyTitle: "No location yet",
      emptyBody:
        "When monitoring is on and location is allowed on their phone, their latest position appears here.",
      deviceNoFix: "No location yet",
      lastUpdated: (rel: string) => `Updated ${rel}`,
      // Shown when location data exists but the map component isn't in this build
      // yet (parent app needs the rebuild that bundles the native map).
      mapNeedsUpdateTitle: "Map needs an update",
      mapNeedsUpdate: "Location is syncing — update the app to this build to view it on the map.",
      // Privacy note — accurate: server-side encryption, NOT end-to-end (we hold the key).
      disclaimer:
        "Location is encrypted and private to your account. Accuracy depends on the phone's GPS and signal.",
    },

    settings: {
      headline: "Household settings",
      sub: (n: number) => `Applies to all ${n} devices · Monitoring & alerts`,
      sub2: "These rules apply to every connected device.",
      alertsLabel: "Alerts",
      pushToggle: "Push me when something is flagged",
      pushSub: "Get a notification the moment a signal meets your severity threshold (set above) on a paired device.",
      pushOn: "Alerts on.",
      pushOff: "Alerts off.",
      pushDenied: "Allow notifications in system settings to get alerts.",
      pushError: "Couldn't turn on alerts. Try again.",
      overlayLabel: "Protective overlay",
      overlayToggle: "Block high-risk content",
      overlaySub:
        "When a flagged signal meets your severity threshold, cover it with a calm 'take a break' screen instead of only flagging it. Needs the 'display over other apps' permission on their phone. Changes apply when their phone next checks in (usually within a couple of minutes), or instantly when they open Lighthouse.",
      overlayNeedsPermission: "Turn on 'display over other apps' on their phone for this to work.",
      severityLabel: "Severity threshold",
      severitySub: "Sets how serious a signal must be before Lighthouse acts — this drives BOTH alerts and the protective overlay.",
      severityOptions: ["Mild", "Moderate", "Severe Only"],
      perPlatformLabel: "Per platform",
      // Per-app monitoring (real, per-device — drives the child's native filter).
      monitoredAppsLabel: "Monitored apps",
      monitoredAppsFooter: (name: string) =>
        `Choose which apps Lighthouse watches on ${name}. Turning one off stops new flags from that app.`,
      monitoredAppsAllOff: "No apps selected — Lighthouse won't flag anything on this device.",
      guardiansLabel: "Guardians",
      guardianAction: "Edit",
      addGuardian: "Invite co-guardian +",
      guardiansFooter: "Guardians receive weekly reports and severe alerts.",
      weeklyReportLabel: "Weekly report",
      previewEmail: "Preview weekly email",
      sendTest: "Send test report",
      sendTestToast: "Test report sent to your guardians.",
      previewToast: "Email preview coming next.",
      weeklyReportFooter: "Sent to all guardians · Monday 7:00am.",

      // Screen time
      screenTimeLabel: "Screen time",
      dailyCap: "Daily cap",
      dailyCapHelper: "Total across all apps. Per-app caps coming in v1.1.",
      bedtime: "Bedtime",
      bedtimeTo: "to",
      blockApps: "Block apps during bedtime",
      askExtra: "Let child ask for +15 min",
      askExtraHelper: "You'll get a push to approve or deny.",

      // Inactivity alerts
      inactivityLabel: "Inactivity alerts",
      alertIf: "Alert me if no signals for",
      inactivityOptions: ["12hr", "24hr", "48hr"],
      smsFallback: "SMS fallback",
      smsHelper: "We'll text this number if Lighthouse loses signal.",

      // Content filtering, keyed by canonical CategoryName (see categoryLabels).
      contentFilterLabel: "Content filtering",
      contentFilterFooter: "Turn a category off and Lighthouse won't flag, report, or cover it.",

      // ⓘ tooltips, plain-language explanations for parents.
      tooltips: {
        overlay:
          "Lighthouse covers harmful content on your child's screen before they fully see it. It reads what's on screen, it does not block websites or track which sites they visit.",
        severity:
          "One threshold for everything: how serious a signal must be before Lighthouse alerts you AND covers it with the protective overlay. 'Severe only' = just the worst; 'Mild' = more.",
        contentFiltering:
          "Which kinds of risk Lighthouse watches for. Turn one off and it won't be flagged, reported, or covered.",
        inactivity:
          "We'll warn you if Lighthouse goes quiet, phone off, no internet, or the app was removed.",
        screenTime: "Daily time limit and bedtime hours. Time limits only, not content.",
      },
    },

    // Parent-friendly labels for the 8 canonical risk categories (CategoryName).
    categoryLabels: {
      Violence: "Violence",
      "Sexual Content": "Sexual content",
      "Self-Harm": "Self-harm",
      "Eating Disorders": "Eating disorders",
      "Substance Use": "Drugs & alcohol",
      "Hate Speech": "Hate speech",
      Gambling: "Gambling",
      "Graphic Content": "Graphic / disturbing",
    },

    // Weekly email preview: a live preview of the Sunday digest email.
    email: {
      inbox: "Inbox",
      time: "9:41 AM",
      from: "reports@lighthouse.app",
      digestSubject: "Your Lighthouse weekly summary · last 7 days",
      digestSummaryLive: (total: number, severe: number, platforms: number) =>
        `${total} signals this week, ${severe} severe, across ${platforms} ${platforms === 1 ? "platform" : "platforms"}. Full breakdown below.`,
      emptyDigest: "No activity this week yet. When this account's devices report, the weekly breakdown appears here.",
      processedNote: "Processed on device, no content was captured.",
      viewInApp: "View full report in app",
    },
  },

  child: {
    // Production child onboarding: parent enters their contact on THIS device
    // (no parent app). QR pairing was retired with the parent app.
    onboarding: {
      headline: "Lighthouse helps your family stay connected online.",
      body: "It reads what's on your screen right here on this phone to spot anything unsafe. Never saved, never sent. Your parent never sees the actual content.",
      tagline: "I look out for you.",
      scanButton: "Set up with a parent",
      footer: "Ask a parent to help you set this up.",
    },

    // Parent-contact setup — the parent enters their email + WhatsApp on the
    // child's phone. Replaces QR pairing now that there's no separate parent app.
    pairing: {
      title: "Set up with a parent",
      bubble: "Hi! Let's get your parent set up. No app for them, just email.",
      emailLabel: "Parent's email",
      emailPlaceholder: "parent@example.com",
      whatsappLabel: "Parent's WhatsApp number",
      whatsappPlaceholder: "0803 123 4567",
      whatsappHint: "Local numbers are fine. We turn them into the full format for you.",
      submit: "Link this phone",
      linking: "Linking this phone",
      footer: "They get a confirmation email first. Nothing is sent until they tap it.",
      invalidEmail: "Enter a valid email address.",
      invalidWhatsapp: "Enter a valid phone number, or leave it blank.",
      networkError: "Couldn't reach Lighthouse. Check the connection and try again.",
      genericError: "Something went wrong. Please try again.",
    },

    scan: {
      requestingCamera: "Camera access is needed to scan the pairing code.",
      grantCamera: "Allow camera",
      instructions: "Point your camera at the QR code on the parent's phone.",
      linking: "Linking this device…",
      invalidCode: "That isn't a valid Lighthouse pairing code.",
      expired: "This pairing code has expired. Ask your parent to refresh it.",
      used: "This code was already used. Ask your parent for a new one.",
      networkError: "Couldn't reach Lighthouse. Check the connection and try again.",
      unlinked: "This device was unlinked. Ask your parent to pair it again.",
    },

    linked: {
      title: "Phone linked",
      body: "We've emailed your parent a link to confirm. Next, we'll ask for a few permissions so Lighthouse can do its job.",
      bodyAlreadyConfirmed: "Your parent's email is already confirmed, so no new email this time. Next, we'll ask for a few permissions so Lighthouse can do its job.",
      bodyNoEmail: "We couldn't email your parent just now. You can still continue. Next, we'll ask for a few permissions so Lighthouse can do its job.",
      button: "Continue",
    },

    // Parent settings, surfaced inside the child app (no separate parent app).
    settings: {
      open: "Parent settings",
      title: "Parent settings",
      subtitle: "Set by a parent. Changes apply to this phone.",
      severityLabel: "How much to flag",
      // Order matches the enum [severe, moderate, all].
      severityOptions: ["Serious only", "Moderate", "Everything"],
      overlayLabel: "Pause the screen on risky content",
      overlaySub: "Shows a cover the child can dismiss.",
      emailLabel: "Email me alerts",
      emailSub: "An email the moment something serious is flagged.",
      appsLabel: "Apps to watch",
      appsSub: "Solid tiles are watched. Dashed tiles are off.",
      save: "Save changes",
      saved: "Settings saved",
      saveError: "Couldn't save. Check the connection and try again.",
      reportBug: "Report a bug",
      disconnect: "Disconnect from parent",
    },

    // OTP gate shown before email alerts can be switched OFF (board 39).
    otpGate: {
      title: "Turning off email alerts needs a code",
      body: "I just emailed a 6 digit code to the parent. Enter it here to confirm this change came from them.",
      confirm: "Confirm",
      keepOn: "Keep alerts on",
      footer: "This stops anyone but the parent from silencing safety alerts. Urgent alerts stay on until the code is confirmed.",
      invalid: "That code is not right. Check the email and try again.",
      sendError: "Couldn't send the code. Check the connection and try again.",
    },

    // Report a bug (board 30). POST /feedback.
    reportBug: {
      title: "Something not working?",
      bubble: "Tell me what went wrong. I'll pass it to the team.",
      chips: {
        bug: "App problem",
        wrong_flag: "Wrong flag",
        idea: "An idea",
      },
      placeholder: "The app stopped after the phone restarted...",
      note: "Your report goes to the Lighthouse team with the app version and phone model. Never your messages.",
      send: "Send report",
      sent: "Thanks. Your report is on its way.",
      empty: "Tell us a little about what happened first.",
      sendError: "Couldn't send it. Check the connection and try again.",
    },

    // Child home (board 21): mascot hero + speech bubble + quiet days.
    home: {
      // Mascot speech lines, per real state.
      bubbleAllClear: "All clear today. I'm keeping watch.",
      bubbleFlagged: "A few things came up. Your parent saw them too.",
      bubblePaused: "Some switches are off, so I can't keep watch right now.",
      bubbleChecking: "One second, just checking things.",
      statusFix: "Turn monitoring back on",
      quietDaysLabel: (n: number) => (n === 1 ? "quiet day this week" : "quiet days this week"),
      weekCard: "Your week",
      transparencyCard: "What I can and can't see",
      visionCard: "Screen checks today",
      visionCount: (n: number) => `${n} checked`,
      visionOff: "Off",
      visionOld: "Needs Android 11",
      linkedCard: "Linked to your parent",
      linkedActive: "Active",
      linkedPaused: "Paused",
      footer: "Checked on this phone. Never saved, never sent. Your parent never sees the actual content.",
      disconnectTitle: "Disconnect this phone?",
      disconnectBody:
        "This unlinks the phone from your parent and stops monitoring. You can set it up again with a parent afterwards.",
      disconnectCancel: "Cancel",
      disconnectConfirm: "Disconnect",
    },

    // "Active" badge (Screen6ActiveBadge), Lighthouse running over other apps.
    activeBadge: {
      simulatedContent: "(simulated app content)",
      pill: "Lighthouse active",
      sheetTitle: "What Lighthouse is doing right now",
      sheetBody: "Watching for category signals while TikTok is open.",
      reportsNote: "Reports go to your guardians.",
    },

    // Content-blocking overlay (board 22), shown when the cover pauses content.
    overlay: {
      category: "Graphic violence",
      bubble: "Let's skip this one.",
      title: "Lighthouse paused this before it loaded.",
      body: "You didn't do anything wrong. You can head back, or keep going if you're okay.",
      goBack: "Go back",
      continueAnyway: "Continue anyway",
      continueHold: "hold 3s",
      footer: "Your parent sees the category, never the content.",
    },

    // Weekly view (board 25) — kid's own week, driven by real device signals.
    weekly: {
      title: "Your week",
      // Mascot speech, per real state.
      bubbleQuiet: "A quiet week. Nothing needed a second look.",
      bubbleFlagged: (day: string) =>
        `Mostly a calm week. ${day} got a little loud. Your parent saw it too.`,
      bubbleFlaggedMany: "A busy week. A few days got loud. Your parent saw them too.",
      quietDays: "quiet days",
      acrossApps: "Across your apps",
      talkTitle: (day: string) => `Want to talk about ${day}?`,
      talkTitleGeneric: "Want to talk about it?",
      talkBody: "A parent is a good person to start with. They are already in the loop.",
      talkButton: "Talk to a parent",
      noPhone: "Ask your parent in person. They are already in the loop.",
      footer: "Checked right here on this phone. Your parent only sees flagged moments, never the actual words or videos.",
      // First week (board 45): day one filled, the rest dashed. No fake data.
      firstWeekTitle: "We just met",
      firstWeekBody: "Your first week fills in as we go. Come back Sunday for the full picture.",
      // Every app switched off in Parent settings (board 45).
      noAppsTitle: "I'm not watching anything",
      noAppsBody: "Every app is switched off in Parent settings, so nothing is being checked right now.",
      noAppsButton: "Choose apps",
    },

    // Sequential permission wizard. Order matters, cannot skip.
    permissions: {
      grant: "Open settings",
      granted: "I've turned it on",
      notYetError: "That one isn't on yet. Tap the button, switch it on, then come back here.",
      bridgeMissing:
        "This copy of Lighthouse is out of date and can't open settings. Please reinstall the latest build, then try again.",
      openFallback: (search: string) =>
        `This phone hides that page. In Settings, search for ${search}, then tap Lighthouse.`,
      // The exact app label as it appears in the system lists.
      appLabel: "Lighthouse",
      findHint: "Look for this in the list",
      howLabel: "Once settings open",
      // `search` = the word to type into Settings search in the universal
      // fallback. Menu labels vary by skin, so wording stays generic ("find and
      // tap Lighthouse in the list") which is true on every Android skin.
      steps: {
        notifications: {
          title: "Notification access",
          bubble: "Lighthouse needs permission to read notifications on this phone.",
          note: "Lighthouse reads notifications on this phone to spot risk. They are checked here and never saved, never sent. Your parent only ever sees a safety category.",
          do: [
            "Open Settings on your phone.",
            "Find and tap Lighthouse in the list.",
            "Turn the switch on, then confirm.",
          ],
          cta: "Open settings",
          search: "Notification access",
        },
        accessibility: {
          title: "Accessibility",
          bubble: "Lighthouse needs permission to read words shown in apps on this phone.",
          // Prominent disclosure for the Accessibility Service (Google Play User Data
          // policy): stated in-context, before the permission is enabled.
          note: "Lighthouse uses Android's Accessibility Service to read on screen text and take a quick look at the screen every few seconds in the apps it watches, on this phone only. Words and pictures are checked here, then thrown away. Never saved, never sent. Your parent only ever sees a safety category.",
          // Explicit two-button consent gate shown BEFORE we send the user to enable
          // the Accessibility Service. Google Play requires affirmative consent for
          // the AccessibilityService API: a clear dialog, two distinct choices, and
          // dismissing/backing out must NOT count as consent (a single button or a
          // bare toggle is non-compliant).
          consent: {
            title: "Allow Lighthouse to use Accessibility?",
            body:
              "To keep Amara safe, Lighthouse needs Android's Accessibility Service to read on screen text and take a quick look at the screen every few seconds in the apps it watches, only on this phone. Words and pictures are checked on this device, then thrown away. They are never saved, never sent, and never shown to your parent. Only a safety category, like bullying, is recorded. Tap I agree to open Android settings and turn it on. You can turn it off any time.",
            accept: "I agree",
            decline: "Not now",
          },
          do: [
            "Open Settings on your phone.",
            "Find and tap Lighthouse in the list.",
            "Turn the switch on, then confirm.",
          ],
          cta: "Open settings",
          search: "Accessibility",
        },
        usage: {
          title: "Usage access",
          bubble: "Lighthouse needs permission to count time spent in each app.",
          note: "I only count time per app on this phone. Your parent sees time totals, never what happens inside the apps.",
          do: [
            "Open Settings on your phone.",
            "Find and tap Lighthouse in the list.",
            "Turn the switch on.",
          ],
          cta: "Open settings",
          search: "Usage access",
        },
        location: {
          title: "Location",
          bubble: "Lighthouse needs permission to share where this phone is.",
          note: "Location is encrypted and private to your parent's account. It is never used for anything else.",
          do: [
            "Tap Allow location below.",
            "When the phone asks, choose Allow.",
            "While using the app is fine here. The next step turns on the rest.",
          ],
          cta: "Allow location",
          search: "Location",
        },
        backgroundLocation: {
          title: "Location, all the time",
          bubble: "Lighthouse needs permission to check location even when the app is closed.",
          // PROMINENT DISCLOSURE — required by Google Play before requesting
          // background location. Shown in a highlighted box at this step, in
          // plain language, naming the data, who sees it, and that it's ongoing.
          note: "Lighthouse collects this phone's location in the background, including when the app is closed or not in use, and shares it with you, the linked parent, so you can see where Amara is. Location is encrypted and private to your account. It is never used for anything else.",
          do: [
            "Open Settings on your phone.",
            "Tap Permissions, then Location.",
            "Choose Allow all the time.",
          ],
          cta: "Open settings",
          search: "Location",
        },
        overlay: {
          title: "Display over other apps",
          bubble: "Lighthouse needs permission to cover risky content on this phone.",
          note: "The cover only appears over risky content, and it can always be dismissed. Turn it off any time in Parent settings.",
          do: [
            "Open Settings on your phone.",
            "Find and tap Lighthouse in the list.",
            "Turn on Allow display over other apps.",
          ],
          cta: "Open settings",
          search: "Display over other apps",
        },
        battery: {
          title: "Unrestricted battery use",
          bubble: "Lighthouse needs permission to keep running in the background.",
          note: "This stops Android from putting me to sleep. I use very little battery, and it keeps the protection on all day.",
          do: [
            "Tap Allow battery use below.",
            "Tap Allow on the popup that appears.",
            "No popup? Search Settings for Battery, then allow Lighthouse.",
          ],
          cta: "Allow battery use",
          search: "Battery",
        },
        autostart: {
          title: "Keep Lighthouse running",
          bubble: "Lighthouse needs permission to start again after this phone restarts.",
          search: "Auto start",
          // Shown only when we have no OEM data for this phone (unknown skin / offline).
          fallback: [
            "Open Settings on your phone.",
            "Search Settings for Auto start, or Battery.",
            "Find Lighthouse and allow it to auto start.",
          ],
          dkmaLabel: (name: string) => `Steps for ${name} phones`,
          dkmaLoading: "Finding the right steps for your phone",
          cta: "Open settings",
          // Shown when no OEM autostart manager exists on this phone (Samsung,
          // Pixel…): there is genuinely nothing to set, so say so instead of
          // dead-ending the parent in generic Settings.
          noManager:
            "Good news. This phone doesn't have an auto start switch to find. The battery step you just did already keeps me running. You're covered.",
          noManagerSteps: [
            "Nothing to set here on this phone.",
            "On Tecno and Infinix phones I'll show the exact steps instead.",
          ],
          noManagerCta: "Continue",
          openAnyway: "Open settings anyway",
        },
      },
      // Always present under every settings step: skins hide and rename pages,
      // so this escape hatch (Settings search) works no matter the OEM.
      universalFallback: {
        label: "Can't find it?",
        body: (term: string) =>
          `Open Settings, tap the search bar, type “${term}”, then tap Lighthouse in the results.`,
        openButton: "Open Settings",
      },
      stepLabel: (n: number, total: number) => `Step ${n} of ${total}`,
      // Generic "I've handled this" confirmation for steps we can't auto-detect
      // (the OEM autostart/battery step).
      playProtectDone: "I've done this",
      allSet: {
        bubble: "I'm watching over this phone now.",
        headline: "You're all set",
        body: "Lighthouse is looking out for Amara on this phone. You can see exactly what's shared, anytime.",
        button: "Go to home",
      },
    },

    // "What I can and can't see" (board 40). Always reachable from Home and the
    // persistent foreground-service notification.
    transparency: {
      headline: "What I can and can't see",
      bubble: "No secrets between us. Here's exactly how it works.",
      canSeeLabel: "Your parent can see",
      canSee: [
        "The kind of thing that came up, like bullying or nudity",
        "Which app it happened in, and when",
        "Whether this phone is on and protected",
      ],
      cantSeeLabel: "Your parent can never see",
      cantSee: [
        "The actual words in your messages",
        "What you search, type, or watch",
        "Your photos, or any picture of your screen",
      ],
      note: "I read the words on this phone and take a quick look at the screen every few seconds in the apps I watch. Each look is checked right here and thrown away. Nothing is saved. Nothing is sent. Only a safety category ever leaves.",
    },
  },
} as const;

export type Strings = typeof strings;
