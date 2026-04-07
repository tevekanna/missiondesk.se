// ==========================================
// MISSIONDESK — iGRC CALCULATION MODULE
// ==========================================
// Intrinsic Ground Risk Class (iGRC) and Final GRC calculation.
//
// Verified against:
//   - SORA v2.5 Main Body, Table 2 (iGRC matrix) and Table 5 (mitigations)
//   - SORA v2.5 Annex F, Table 2 (iGRC), Table 8 (qualitative descriptors),
//     Table 12 (mitigation reductions), Equation 5 (analytical iGRC formula)
//
// All references are cited inline as: [Source, Section/Table]
// Public API is exposed on window.* for use by app.js.
// ---------------------------------------------------------------------------

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // SECTION 1 — iGRC LOOKUP TABLE
  // ---------------------------------------------------------------------------
  // Source: SORA v2.5 Main Body, Table 2 (p. 34) and Annex F, Table 2 (p. 14)
  //
  // Rows (index 0–6): Maximum population density bands
  //   0 = Controlled ground area
  //   1 = < 5     ppl/km²  (Remote)
  //   2 = < 50    ppl/km²  (Lightly populated)
  //   3 = < 500   ppl/km²  (Suburban / Residential lightly populated)
  //   4 = < 5,000 ppl/km²  (Low density metropolitan)
  //   5 = < 50,000 ppl/km² (High density metropolitan)
  //   6 = ≥ 50,000 ppl/km² (Assemblies of people)
  //
  // Columns (index 0–4): UA size class — leftmost column matching BOTH
  //   max characteristic dimension AND max speed [Annex F, Section 4.2.3(a)]
  //   0 = ≤1m  / 25 m/s
  //   1 = ≤3m  / 35 m/s
  //   2 = ≤8m  / 75 m/s
  //   3 = ≤20m / 120 m/s
  //   4 = ≤40m / 200 m/s
  //
  // null = outside SORA scope → requires Certified category
  //   [SORA v2.5 Main Body, Section 4.2.3(c)]
  //
  // Special rule: UA ≤ 250 g AND ≤ 25 m/s → iGRC = 1 regardless of population
  //   [SORA v2.5 Main Body, Table 2 footnote]
  const IGRC_MATRIX = [
    //  ≤1m    ≤3m    ≤8m    ≤20m   ≤40m
    [    1,     1,     2,     3,     3  ],  // Controlled
    [    2,     3,     4,     5,     6  ],  // < 5      (Remote)
    [    3,     4,     5,     6,     7  ],  // < 50     (Lightly populated)
    [    4,     5,     6,     7,     8  ],  // < 500    (Suburban)
    [    5,     6,     7,     8,     9  ],  // < 5,000  (Low density metro)
    [    6,     7,     8,     9,    10  ],  // < 50,000 (High density metro)
    [    7,     8,  null,  null,  null  ],  // ≥ 50,000 (Assemblies of people)
  ];

  // ---------------------------------------------------------------------------
  // SECTION 2 — UA SIZE / SPEED CLASS THRESHOLDS
  // ---------------------------------------------------------------------------
  // Source: SORA v2.5 Main Body, Table 2 column headers
  //         SORA v2.5 Annex F, Section 4.2.3 — "leftmost column matching
  //         both criteria: max characteristic dimension AND max speed"
  //
  // Selection rule: find the leftmost (lowest-index) column where BOTH
  // dimMeters ≤ dimLimit AND speedMs ≤ speedLimit.
  const SIZE_SPEED_THRESHOLDS = [
    { dimLimit:  1, speedLimit:  25, col: 0 },
    { dimLimit:  3, speedLimit:  35, col: 1 },
    { dimLimit:  8, speedLimit:  75, col: 2 },
    { dimLimit: 20, speedLimit: 120, col: 3 },
    { dimLimit: 40, speedLimit: 200, col: 4 },
  ];

  const COL_LABELS = [
    '≤1 m / 25 m/s',
    '≤3 m / 35 m/s',
    '≤8 m / 75 m/s',
    '≤20 m / 120 m/s',
    '≤40 m / 200 m/s',
  ];

  // ---------------------------------------------------------------------------
  // SECTION 3 — POPULATION DENSITY ROW SELECTION
  // ---------------------------------------------------------------------------
  // Source: SORA v2.5 Main Body, Table 3 (p. 36) and Annex F, Table 8 (p. 37)
  //
  // Always use the HIGHEST population density within the entire iGRC footprint
  // (operational volume + ground risk buffer). [SORA v2.5 Main Body, Section 4.2.3(c)]

  // Qualitative fallback mapping from descriptor to row index.
  // Use only when authoritative population density map data is unavailable.
  // [SORA v2.5 Main Body, Section 4.2.3(d) and Table 3]
  const QUALITATIVE_TO_ROW = {
    'controlled':  0,
    'remote':      1,  // < 5 ppl/km²
    'lightly':     2,  // < 50 ppl/km²
    'suburban':    3,  // < 500 ppl/km²
    'low_metro':   4,  // < 5,000 ppl/km²
    'high_metro':  5,  // < 50,000 ppl/km²
    'assemblies':  6,  // ≥ 50,000 ppl/km²
  };

  // Row labels for display (matches QUALITATIVE_TO_ROW order by index)
  const ROW_LABELS = [
    'Controlled',
    'Remote (<5 ppl/km²)',
    'Lightly populated (<50 ppl/km²)',
    'Suburban (<500 ppl/km²)',
    'Low density metro (<5,000 ppl/km²)',
    'High density metro (<50,000 ppl/km²)',
    'Assemblies of people (≥50,000 ppl/km²)',
  ];

  // ---------------------------------------------------------------------------
  // SECTION 4 — GROUND RISK MITIGATIONS
  // ---------------------------------------------------------------------------
  // Source: SORA v2.5 Main Body, Table 5 (p. 38)
  //         SORA v2.5 Annex F, Table 12 (p. 68)
  //
  //   Mitigation         | None | Low | Medium | High
  //   M1(A) Sheltering   |  0   |  -1 |   -2   |  N/A
  //   M1(B) Op.restr.    |  0   | N/A |   -1   |  -2
  //   M1(C) Ground obs.  |  0   |  -1 |  N/A   |  N/A
  //   M2   Impact dyn.   |  0   | N/A |   -1   |  -2
  //
  // null = this robustness level is not valid (N/A) for that mitigation.
  const MITIGATION_REDUCTIONS = {
    m1a: { none: 0, low:  1, medium: 2, high: null },  // Sheltering
    m1b: { none: 0, low: null, medium: 1, high: 2  },  // Operational restrictions
    m1c: { none: 0, low:  1, medium: null, high: null}, // Ground observation
    m2:  { none: 0, low: null, medium: 1, high: 2  },  // Impact dynamics reduced
  };

  // ---------------------------------------------------------------------------
  // INTERNAL HELPERS
  // ---------------------------------------------------------------------------

  /**
   * getDimCol — Returns the iGRC column index (0–4) for a given UA.
   * Returns null if the UA exceeds all thresholds (outside SORA scope).
   * [SORA v2.5 Annex F, Section 4.2.3]
   *
   * @param {number} dimMeters - Maximum characteristic dimension in metres
   * @param {number} speedMs   - Maximum speed in m/s (designer-defined maximum)
   * @returns {number|null}
   */
  function getDimCol(dimMeters, speedMs) {
    for (const t of SIZE_SPEED_THRESHOLDS) {
      if (dimMeters <= t.dimLimit && speedMs <= t.speedLimit) {
        return t.col;
      }
    }
    return null; // Outside SORA scope
  }

  /**
   * getPopRow — Returns the row index (0–6) in the iGRC matrix.
   * @param {number} popDensity - Population density in ppl/km²
   * @returns {number}
   */
  function getPopRow(popDensity) {
    if (popDensity < 5)      return 1; // Remote
    if (popDensity < 50)     return 2; // Lightly populated
    if (popDensity < 500)    return 3; // Suburban
    if (popDensity < 5000)   return 4; // Low density metropolitan
    if (popDensity < 50000)  return 5; // High density metropolitan
    return 6;                           // Assemblies of people (≥50,000)
  }

  /**
   * getIGRC — Looks up the intrinsic GRC from SORA v2.5 Table 2.
   * [SORA v2.5 Main Body, Table 2; Annex F, Table 2]
   *
   * @returns {{ igrc: number|null, outOfScope: boolean, reason?: string }}
   */
  function getIGRC(popRow, dimCol) {
    if (dimCol === null) {
      return { igrc: null, outOfScope: true, reason: 'UA exceeds maximum size/speed for SORA (>40 m or >200 m/s)' };
    }
    const value = IGRC_MATRIX[popRow][dimCol];
    if (value === null) {
      return { igrc: null, outOfScope: true, reason: 'Operation over assemblies of people with UA >3 m — outside SORA scope' };
    }
    return { igrc: value, outOfScope: false };
  }

  /**
   * getMitigationReduction — Returns the GRC reduction for a single mitigation.
   * Throws if an invalid (N/A) robustness level is specified.
   */
  function getMitigationReduction(mitigation, robustness) {
    const table = MITIGATION_REDUCTIONS[mitigation];
    if (!table) throw new Error(`Unknown mitigation: ${mitigation}`);
    const value = table[robustness];
    if (value === undefined) throw new Error(`Unknown robustness '${robustness}' for ${mitigation}`);
    if (value === null) {
      throw new Error(
        `Robustness level '${robustness}' is N/A for mitigation ${mitigation}. ` +
        `See SORA v2.5 Main Body, Table 5.`
      );
    }
    return value;
  }

  /**
   * calcFinalGRC — Applies all mitigations in correct sequence with the
   * column floor rule for M1.
   * [SORA v2.5 Main Body, Section 4.3.3, Table 5; Annex F, Table 12]
   *
   * @param {number} igrc        - Intrinsic GRC from getIGRC()
   * @param {number} dimCol      - Column index (needed for column floor)
   * @param {object} mitigations - { m1a, m1b, m1c, m2 } each 'none'|'low'|'medium'|'high'
   */
  function calcFinalGRC(igrc, dimCol, mitigations) {
    const { m1a = 'none', m1b = 'none', m1c = 'none', m2 = 'none' } = mitigations;
    const details = [];

    // Step 1 — M1 mitigations (applied first, subject to column floor)
    // Order: M1(A) → M1(B) → M1(C) [SORA v2.5 Main Body, Section 4.3.3(a)]
    const m1aRed = getMitigationReduction('m1a', m1a);
    const m1bRed = getMitigationReduction('m1b', m1b);
    const m1cRed = getMitigationReduction('m1c', m1c);
    const m1TotalRaw = m1aRed + m1bRed + m1cRed;

    if (m1aRed > 0) details.push(`M1(A) Sheltering [${m1a}]: −${m1aRed}`);
    if (m1bRed > 0) details.push(`M1(B) Operational restrictions [${m1b}]: −${m1bRed}`);
    if (m1cRed > 0) details.push(`M1(C) Ground observation [${m1c}]: −${m1cRed}`);

    // Column floor rule: M1 cannot reduce GRC below the "Controlled" row value
    // for the applicable column. [SORA v2.5 Main Body, Section 4.3.4(f)]
    const columnFloor = IGRC_MATRIX[0][dimCol]; // Row 0 = Controlled
    const grcAfterM1Uncapped = igrc - m1TotalRaw;
    const grcAfterM1 = Math.max(columnFloor, grcAfterM1Uncapped);
    const m1FloorApplied = grcAfterM1 > grcAfterM1Uncapped;
    const actualM1Reduction = igrc - grcAfterM1;

    if (m1FloorApplied) {
      details.push(
        `⚠ M1 column floor applied (floor = ${columnFloor}). ` +
        `Claimed −${m1TotalRaw} capped at −${actualM1Reduction}.`
      );
    }

    // Step 2 — M2 mitigation (applied after M1, NOT subject to column floor)
    // M2 reduces impact energy, not population exposure.
    // [SORA v2.5 Annex F, Section 4.6]
    const m2Red = getMitigationReduction('m2', m2);
    if (m2Red > 0) details.push(`M2 Impact dynamics [${m2}]: −${m2Red}`);

    const finalGRC = Math.max(1, grcAfterM1 - m2Red);
    const totalReduction = igrc - finalGRC;

    return {
      finalGRC,
      m1Reduction: actualM1Reduction,
      m2Reduction: m2Red,
      totalReduction,
      columnFloor,
      m1FloorApplied,
      details,
    };
  }

  /**
   * calcAnalyticalIGRC — Calculates iGRC analytically using Annex F Equation 5.
   * Use when the actual critical area is known (e.g. from CasEx).
   * [SORA v2.5 Annex F, Equation 5 (p. 14)]
   *
   * @param {number} popDensityPplPerKm2 - Population density in ppl/km²
   * @param {number} criticalAreaM2      - Critical area in m²
   * @returns {number} iGRC (integer ≥ 1)
   */
  function calcAnalyticalIGRC(popDensityPplPerKm2, criticalAreaM2) {
    const Dpop = popDensityPplPerKm2;
    const Ac   = criticalAreaM2 / 1_000_000; // Convert m² → km²
    const rawIGRC = 7 + Math.log10(Dpop * Ac);
    return Math.max(1, Math.ceil(rawIGRC - 0.5)); // Rounding constant [Annex F, Eq. 5]
  }

  /**
   * is250gSpecialCase — Returns true if the UA qualifies for automatic iGRC = 1.
   * [SORA v2.5 Main Body, Table 2 footnote]
   *
   * @param {number} massGrams - Maximum take-off mass in grams
   * @param {number} speedMs   - Maximum speed in m/s
   */
  function is250gSpecialCase(massGrams, speedMs) {
    return massGrams <= 250 && speedMs <= 25;
  }

  // ---------------------------------------------------------------------------
  // SECTION 5 — MAIN ENTRY POINT
  // ---------------------------------------------------------------------------

  /**
   * computeGroundRisk — Complete iGRC → Final GRC pipeline.
   *
   * @param {object} params
   * @param {number}   params.dimMeters     - Max characteristic dimension (m)
   * @param {number}   params.speedMs       - Max speed (m/s) — designer maximum
   * @param {number}   [params.massGrams]   - MTOM in grams (for 250 g rule check)
   * @param {number}   [params.popDensity]  - Population density in ppl/km²
   *                                          (use null to trigger qualitative fallback)
   * @param {string}   [params.popQual]     - Qualitative key (see QUALITATIVE_TO_ROW)
   *                                          Used only when popDensity is null.
   * @param {object}   [params.mitigations] - { m1a, m1b, m1c, m2 } robustness levels
   *                                          Defaults to all 'none' if omitted.
   * @returns {object} Full result — igrc, finalGRC, outOfScope, details, etc.
   */
  function computeGroundRisk(params) {
    const {
      dimMeters,
      speedMs,
      massGrams = null,
      popDensity = null,
      popQual = null,
      mitigations = {},
    } = params;

    // 250 g special case — iGRC = 1 regardless of population
    if (massGrams !== null && is250gSpecialCase(massGrams, speedMs)) {
      return {
        igrc: 1,
        finalGRC: 1,
        outOfScope: false,
        specialCase: '250g_rule',
        dimCol: 0,
        popRow: null,
        note: 'UA ≤250 g and ≤25 m/s: iGRC = 1 regardless of population density [SORA v2.5, Table 2 footnote]',
        m1Reduction: 0, m2Reduction: 0, totalReduction: 0,
        columnFloor: 1, m1FloorApplied: false,
        details: [],
      };
    }

    // Determine column from dimension + speed
    const dimCol = getDimCol(dimMeters, speedMs);

    // Determine row from population
    let popRow;
    if (popQual === 'controlled') {
      popRow = 0; // Controlled is a special condition, not a density number
    } else if (popDensity !== null) {
      popRow = getPopRow(popDensity);
    } else if (popQual !== null) {
      popRow = QUALITATIVE_TO_ROW[popQual];
      if (popRow === undefined) throw new Error(`Unknown qualitative descriptor: ${popQual}`);
    } else {
      throw new Error('Either popDensity or popQual must be provided to computeGroundRisk().');
    }

    // iGRC lookup
    const { igrc, outOfScope, reason } = getIGRC(popRow, dimCol);
    if (outOfScope) {
      return { igrc: null, finalGRC: null, outOfScope: true, reason, dimCol, popRow, details: [] };
    }

    // Apply mitigations
    const grcResult = calcFinalGRC(igrc, dimCol, mitigations);

    return {
      igrc,
      dimCol,
      popRow,
      outOfScope: false,
      specialCase: null,
      ...grcResult,
    };
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------
  window.IGRC_MATRIX         = IGRC_MATRIX;
  window.QUALITATIVE_TO_ROW  = QUALITATIVE_TO_ROW;
  window.COL_LABELS          = COL_LABELS;
  window.ROW_LABELS          = ROW_LABELS;
  window.getDimCol           = getDimCol;
  window.getPopRow           = getPopRow;
  window.getIGRC             = getIGRC;
  window.calcFinalGRC        = calcFinalGRC;
  window.calcAnalyticalIGRC  = calcAnalyticalIGRC;
  window.is250gSpecialCase   = is250gSpecialCase;
  window.computeGroundRisk   = computeGroundRisk;

})();
