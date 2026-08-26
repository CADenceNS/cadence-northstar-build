# PP-1B-F2A1 catalog reconciliation

The owner-supplied 87-product PP-1A template catalog remains the sole catalog seed. Its product families are represented under the required top-level categories: `FIX`, `REM`, `IMP`, `ORT`, `SLP`, `DIA`, `SPL`, and `AUX`.

Fixed work includes crowns, bridges, veneers, inlay/onlay, provisionals, and post/core; removable work includes complete/partial dentures, relines, rebases, and repairs; implant work includes abutments, crowns, full-arch/hybrid, overdentures, and verification; orthodontic, sleep, diagnostics/digital, splint, and auxiliary records retain their corresponding PP-1A families.

No PP-1A template rows, SKU identifiers, price versions, or lifecycle states are rewritten by F2A1. Hybrid products remain implant-family records rather than being duplicated across categories. Product-specific selection metadata remains tenant-copied catalog configuration, and Case Intake now consumes that authoritative tenant catalog instead of maintaining a flat restoration/material selector.

Catalog gaps are not fabricated in this phase: a tenant administrator can add a tenant-specific product through Product & Pricing Administration, with its own category, family, configuration, TAT, lifecycle, and effective-dated price version.
