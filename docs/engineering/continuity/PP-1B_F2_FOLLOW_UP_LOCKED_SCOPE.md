# PP-1B-F2 locked follow-up scope

Status: recorded during PP-1B-F2A1-F5 owner-review corrections; not implemented by F5.

F5 is limited to authoritative Catalog selection, tenant-owned restoration subtype
navigation, structured clinical configuration libraries, intelligent Product Line
semantics, and due-date visibility. It does not authorize lifecycle, files,
fulfillment, vendor-send, or KPI implementation.

The immediate follow-up must preserve immutable Case Product Line snapshots and
separate Case Relationship from lifecycle state. Its authorized design scope is:

- Case lifecycle: Place on Hold, controlled Hold Reason, Release Hold, Cancel
  Case, controlled Cancellation Reason, and a full audit history.
- Intake method: DIGITAL, PHYSICAL, and HYBRID.
- Permanent, versioned case assets with authorized upload, view, download, print
  where supported, controlled sharing, original filename/source metadata, and
  derived-file lineage. Geometry may only be derived through supported workflows;
  images, X-rays, or DICOM are not assumed to be STL.
- Product-Line fulfillment routing: IN-HOUSE, OUTSOURCED, or SPLIT / HYBRID.
- Controlled vendor case packages with selected authorized files, Product Lines,
  instructions, delivery pathway, tracking state, and send audit.
- KPI foundations by period, intake method, relationship, category, subtype,
  Product/SKU, material, fulfillment route, vendor, hold/cancellation reason,
  TAT, doctor, practice, and top-client drill-down. Financial KPIs remain blocked
  until PP-1C has an authoritative billing source.

No billing, PP-1C, Design Studio, or automatic clinical decision behavior is
authorized by this record.
