# CADence Dental XYZ Convention — Version 1

`CADENCE_DENTAL_XYZ_V1` is the persisted case coordinate convention used by Design Studio registration. It does not modify imported artifact coordinates; the project stores a versioned rigid transform from the immutable source/case frame into dental XYZ.

| Axis | Positive direction | Estimation evidence |
|---|---|---|
| X | Patient left | Broad arch PCA axis; raw file +X resolves only the otherwise unobservable left/right sign |
| Y | Posterior | In-plane arch axis, with sign selected from the correlation between lateral spread and arch depth |
| Z | Superior, toward maxillary gingiva | Occlusal-plane normal; winding-derived average normals and maxillary/mandibular role resolve the sign |

The origin is the component-wise median of sampled registered arch geometry. X, Y, and Z are orthonormal and right-handed. The estimated transform maps the origin to `[0, 0, 0]` and records its confidence, version, evidence history, lock state, and any user corrections.

Automatic estimation uses deterministic sampling, covariance PCA, arch-symmetry correlation, source-normal evidence, and the assigned maxillary or mandibular role. It reports confidence instead of claiming certainty. Users can correct the occlusal plane and midline, reverse the anterior direction, lock the result, reset it, or return to imported coordinates. Every correction increments the coordinate-system version and is retained in project and recovery persistence.

This convention is an engineering geometry frame. It is not a clinical diagnosis, occlusal approval, manufacturing approval, or regulatory assertion.
