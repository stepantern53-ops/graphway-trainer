# Browser acceptance

Run only after the integration owner releases `graphway_test`: root `npm run test:e2e` owns safe test-only reset/migration/provision/start. One serial browser project targets assembled API/web at loopback 3002, not dev DB. Do not launch alongside server integration suites.

- `auth-game.spec.ts`: actual registration, live controls/incomplete values, keyboard menu Escape/Continue focus return, frozen paused ride, arrival-only POST, network retry, reload/current, real expired session/same-user retry, different-user reset and explicit logout after cookie expiry.
- `progression.spec.ts`: all L01–L12/Q01–Q12 through real UI using test-only curriculum witnesses, broad alternate solutions, locked direct access, all-complete and replay. Q10 wrong-middle candidate `2x²−3x−1` matches both endpoints and has a safe pit-free route; the actual validator is checked with endpoint-only exact conditions before the unchanged UI must reject its middle point.
- `responsive.spec.ts`: real 1440×900 / 844×390 / 667×375 viewports, maximum-width valid synthetic nickname, focused portrait rotation and keyboard-height state retention, focus/touch targets, reduced-motion, same-model no-WebGL fallback, current home layout. Long-nickname overflow remains a central browser measurement, not a pre-emptive CSS workaround.
- `admin.spec.ts`: programmatic read of `.local/test-admin-access.json` only; all-open access still requires valid mathematics. No screenshots or output of admin identity/credentials.
- `helpers.ts`: schema-validated API observations and real UI actions. Four synthetic student signups total per clean suite, no throttle bypass.

Trace/video/automatic screenshots are off. Explicit visual screenshots contain synthetic ordinary students only and go to ignored `.local/e2e-artifacts`. A physical phone is not exercised by browser viewport tests.
