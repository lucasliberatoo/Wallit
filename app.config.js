// The Android build number comes from CI (one per build) so each APK can
// install over the previous one.
module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, versionCode: Number(process.env.ANDROID_VERSION_CODE ?? 1) },
});
