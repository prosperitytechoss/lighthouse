// Forces a low-memory Gradle configuration into android/gradle.properties at
// prebuild time so `eas build --local` can compile on a RAM-constrained Mac
// without the OS SIGKILL-ing the Gradle daemon ("Could not receive a message
// from the daemon"). EAS regenerates the android/ project on every local build,
// which discards GRADLE_OPTS and hand-edited gradle.properties — a config plugin
// is the only place these settings reliably persist.
const { withGradleProperties } = require("@expo/config-plugins");

const PROPS = {
  "org.gradle.jvmargs": "-Xmx2560m -XX:MaxMetaspaceSize=512m",
  "org.gradle.parallel": "false",
  "org.gradle.workers.max": "2",
};

module.exports = function withLowMemoryGradle(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(PROPS)) {
      // drop any existing entry for this key, then append ours
      cfg.modResults = cfg.modResults.filter(
        (item) => !(item.type === "property" && item.key === key)
      );
      cfg.modResults.push({ type: "property", key, value });
    }
    return cfg;
  });
};
