# Recorded workbench inputs

These captures show the AccessFinish workbench and synthetic booking data. They are retained so the v03 film can be reproduced and the v04 review can be inspected. They are recordings, not new model requests or execution evidence by themselves.

`v02/` supplies the actual JPEG panels and execution frames used by the v03 compositor. Their ordering is recorded in `media/capture-v02.json`.

`v04/01-opening-final.png`, `02-phone-final.png`, `03-phone-model-outcome.png`, `04-comparison-final.png`, and `06-browser-only-receipt.png` show the revised workbench and recorded receipt. The phone model run is `run-cdc03648724c4e20997aa8f90a2fe56f`; the earlier operator-reference receipt is a separate run.

Intermediate captures retain their original filenames. `01-opening-desktop.png` contains an intermediate stale error state found and fixed during testing. Despite its filename, `05-mobile-opening.png` is **not mobile verification**: the viewport override did not take effect. Current desktop review passed; a fresh mobile review of this revision has not been established by that capture.
