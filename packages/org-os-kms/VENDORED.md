source: org-os (github.com/regen-coordination/org-os-template)
tag: kms-atproto-v0.1-rc2
commit: c41900bd8a94b551716863969289319b3084fbf5
date: 2026-09-19
note: packages/toolkit-framework and packages/org-os-kms are unedited copies of the org-os tree at this commit (byte-identical blobs); this file is the only addition and is not part of org-os. rc2 = port of regen-toolkit's framework changes + fix pass (federate-add in place, held not publishable, no-op upserts skipped, bridge withholds unpublished pages, peer subscriptions opt-in, cursors sidecar). The e2e against a live PDS has not run yet, so the final kms-atproto-v0.1 tag does not exist; re-vendor and update this file when it does. Do not edit these packages here: change org-os, tag, re-vendor.
