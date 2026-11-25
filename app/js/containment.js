// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Lars Wallström

// ==========================================
// MISSIONDESK — CONTAINMENT MODULE (Step #8)
// ==========================================
// Adjacent ground area assessment and required containment robustness.
//
// Verified against:
//   - AMC1 Article 11 of Regulation (EU) 2019/947 (SORA 2.5), point S.4.8.3
//     and Tables 8 to 13 — AMC & GM Issue 1, Amendment 5
//     (ED Decision 2026/010/R). Amendment 5 does not change these tables;
//     they were introduced by ED Decision 2025/018/R.
//   - JARUS SORA v2.5 Main Body (JAR-doc-25), Section 4.8.3, Tables 8–13
//     (used for the column layout of the tables).
//
// How the tables work [S.4.8.3(c)–(d)]:
//   Each column is a pair of OPERATIONAL LIMITS the operator commits to:
//     - the maximum AVERAGE population density of the adjacent ground area,
//     - the maximum size of OUTDOOR ASSEMBLIES within 1 km of the
//       operational volume.
//   The required containment robustness is read at the intersection of that
//   column and the SAIL. The most stringent of the two limits governs.
//   A HIGHER SAIL gives a LOWER containment requirement, because the UAS is
//   already less likely to leave the operational volume.
//
// All references are cited inline. Public API is exposed on window.*.
// ---------------------------------------------------------------------------

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // SECTION 1 — ADJACENT GROUND AREA SIZE
  // Source: AMC1 Article 11, S.4.8.3(b)(i)
  //
  // Distance flown in 3 minutes at MAXIMUM speed, measured outwards from the
  // operational volume: less than 5 km → use 5 km; more than 35 km → use 35 km.
  // ---------------------------------------------------------------------------

  /**
   * Calculate the lateral outer limit of the adjacent ground area.
   * @param {number} speedMs - Maximum UA speed in m/s
   * @returns {number} Distance in km, clamped to [5, 35]
   */
  function calcAdjacentAreaKm(speedMs) {
    const raw = ((Number(speedMs) || 0) * 180) / 1000; // 3 min = 180 s
    return Math.max(5, Math.min(35, raw));
  }

  // ---------------------------------------------------------------------------
  // SECTION 2 — TABLE SELECTION
  // Source: AMC1 Article 11, Tables 8–13 (table headings)
  //
  // The table is chosen from the maximum characteristic dimension AND the
  // maximum speed, using the same classes as the iGRC table (Step #2).
  // ---------------------------------------------------------------------------

  const SIZE_CLASSES = [
    { sizeClass: 0, dimLimit:  1, speedLimit:  25, label: '1 m UA (< 25 m/s)'   },
    { sizeClass: 1, dimLimit:  3, speedLimit:  35, label: '3 m UA (< 35 m/s)'   },
    { sizeClass: 2, dimLimit:  8, speedLimit:  75, label: '8 m UA (< 75 m/s)'   },
    { sizeClass: 3, dimLimit: 20, speedLimit: 120, label: '20 m UA (< 120 m/s)' },
    { sizeClass: 4, dimLimit: 40, speedLimit: 200, label: '40 m UA (< 200 m/s)' },
  ];

  /**
   * Determine the containment size class (0–4) from dimension and speed.
   * @param {number} dimMeters - Maximum characteristic dimension in metres
   * @param {number} [speedMs] - Maximum speed in m/s (omit to classify on dimension only)
   * @returns {number|null} Size class, or null when outside Tables 8–13
   */
  function getContainmentSizeClass(dimMeters, speedMs) {
    const speed = (speedMs === undefined || speedMs === null) ? 0 : speedMs;
    for (const c of SIZE_CLASSES) {
      if (dimMeters <= c.dimLimit && speed <= c.speedLimit) return c.sizeClass;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // SECTION 3 — CONTAINMENT TABLES 8–13
  // Source: AMC1 Article 11, S.4.8.3, Tables 8–13
  //
  // columns[]: ordered left → right exactly as printed.
  //   popLimit      — average population density allowed in the adjacent
  //                   ground area, people/km² (Infinity = no upper limit)
  //   assemblyRank  — largest outdoor assembly allowed within 1 km:
  //                   2 = more than 400 000, 1 = 40 000 to 400 000,
  //                   0 = fewer than 40 000
  //
  // rows[sail]: required robustness per column.
  //   'H' = high, 'M' = medium, 'L' = low, 'X' = out of scope
  // ---------------------------------------------------------------------------

  const INF = Infinity;

  const TABLE_8 = {
    tableRef: 'Table 8 — UA up to 1 m (< 25 m/s), shelter assumed applicable',
    columns: [
      { popLimit: INF,   assemblyRank: 2 },
      { popLimit: INF,   assemblyRank: 1 },
      { popLimit: 50000, assemblyRank: 0 },
    ],
    rows: {
      1: ['H', 'M', 'L'],
      2: ['H', 'M', 'L'],
      3: ['M', 'L', 'L'],
      4: ['L', 'L', 'L'],
      5: ['L', 'L', 'L'],
      6: ['L', 'L', 'L'],
    },
  };

  const TABLE_9 = {
    tableRef: 'Table 9 — UA up to 3 m (< 35 m/s), shelter applicable in the adjacent ground area',
    columns: [
      { popLimit: INF,   assemblyRank: 2 },
      { popLimit: INF,   assemblyRank: 1 },
      { popLimit: 50000, assemblyRank: 0 },
      { popLimit: 5000,  assemblyRank: 0 },
    ],
    rows: {
      1: ['X', 'H', 'M', 'L'],
      2: ['X', 'H', 'M', 'L'],
      3: ['X', 'M', 'L', 'L'],
      4: ['M', 'L', 'L', 'L'],
      5: ['L', 'L', 'L', 'L'],
      6: ['L', 'L', 'L', 'L'],
    },
  };

  const TABLE_10 = {
    tableRef: 'Table 10 — UA up to 3 m (< 35 m/s), shelter not applicable in the adjacent ground area',
    columns: [
      { popLimit: INF,   assemblyRank: 2 },
      { popLimit: 50000, assemblyRank: 1 },
      { popLimit: 5000,  assemblyRank: 0 },
      { popLimit: 500,   assemblyRank: 0 },
    ],
    rows: {
      1: ['X', 'H', 'M', 'L'],
      2: ['X', 'H', 'M', 'L'],
      3: ['X', 'M', 'L', 'L'],
      4: ['M', 'L', 'L', 'L'],
      5: ['L', 'L', 'L', 'L'],
      6: ['L', 'L', 'L', 'L'],
    },
  };

  // Tables 11–13 share one column layout.
  const LARGE_UA_COLUMNS = [
    { popLimit: INF,   assemblyRank: 2 },
    { popLimit: 50000, assemblyRank: 1 },
    { popLimit: 5000,  assemblyRank: 0 },
    { popLimit: 500,   assemblyRank: 0 },
    { popLimit: 50,    assemblyRank: 0 },
  ];

  const TABLE_11 = {
    tableRef: 'Table 11 — UA up to 8 m (< 75 m/s)',
    columns: LARGE_UA_COLUMNS,
    rows: {
      1: ['X', 'X', 'H', 'M', 'L'],
      2: ['X', 'X', 'H', 'M', 'L'],
      3: ['X', 'X', 'M', 'L', 'L'],
      4: ['X', 'M', 'L', 'L', 'L'],
      5: ['M', 'L', 'L', 'L', 'L'],
      6: ['L', 'L', 'L', 'L', 'L'],
    },
  };

  const TABLE_12 = {
    tableRef: 'Table 12 — UA up to 20 m (< 120 m/s)',
    columns: LARGE_UA_COLUMNS,
    rows: {
      1: ['X', 'X', 'X', 'H', 'M'],
      2: ['X', 'X', 'X', 'H', 'M'],
      3: ['X', 'X', 'X', 'M', 'L'],
      4: ['X', 'X', 'M', 'L', 'L'],
      5: ['X', 'M', 'L', 'L', 'L'],
      6: ['M', 'L', 'L', 'L', 'L'],
    },
  };

  const TABLE_13 = {
    tableRef: 'Table 13 — UA up to 40 m (< 200 m/s)',
    columns: LARGE_UA_COLUMNS,
    rows: {
      1: ['X', 'X', 'X', 'X', 'H'],
      2: ['X', 'X', 'X', 'X', 'H'],
      3: ['X', 'X', 'X', 'X', 'M'],
      4: ['X', 'X', 'X', 'M', 'L'],
      5: ['X', 'X', 'M', 'L', 'L'],
      6: ['X', 'M', 'L', 'L', 'L'],
    },
  };

  const ROBUSTNESS       = { L: 'low', M: 'medium', H: 'high' };
  const ROBUSTNESS_INDEX = { L: 1, M: 2, H: 3 };

  // ---------------------------------------------------------------------------
  // SECTION 4 — INPUT NORMALISATION
  // ---------------------------------------------------------------------------

  // Upper bounds of the population bands printed in the table headers.
  const POP_BANDS = [50, 500, 5000, 50000];

  /**
   * Convert an average population density into the band it falls in.
   * Accepts a number (people/km²) or one of '50' | '500' | '5000' | '50000' |
   * 'nolimit' (the values used by the Step #8 selector in the app).
   * @returns {number|null} Exclusive upper bound of the band (Infinity above
   *                        50 000), or null when no value was given.
   */
  function normalisePopBand(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value === 'nolimit') return INF;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return null;
    // A selector value IS the band's upper bound; a measured density is
    // placed in the first band whose upper bound it stays below.
    if (typeof value === 'string' && POP_BANDS.includes(n)) return n;
    for (const bound of POP_BANDS) {
      if (n < bound) return bound;
    }
    return INF;
  }

  /**
   * Convert an outdoor-assembly size into a rank 0–2.
   * Accepts a head count or 'under40k' | '40k_400k' | 'over400k'.
   * @returns {number|null}
   */
  function normaliseAssemblyRank(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value === 'under40k') return 0;
    if (value === '40k_400k') return 1;
    if (value === 'over400k') return 2;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return null;
    if (n < 40000)   return 0;
    if (n <= 400000) return 1;
    return 2;
  }

  function describeColumn(col) {
    const pop = col.popLimit === INF
      ? 'no upper limit on the average population density of the adjacent ground area'
      : `average population density of the adjacent ground area below ${col.popLimit.toLocaleString('en-GB')} people/km²`;
    const assembly = [
      'no outdoor assembly of more than 40,000 people within 1 km of the operational volume',
      'no outdoor assembly of more than 400,000 people within 1 km of the operational volume',
      'no limit on outdoor assemblies within 1 km of the operational volume',
    ][col.assemblyRank];
    return [pop, assembly];
  }

  // ---------------------------------------------------------------------------
  // SECTION 5 — TABLE LOOKUP
  // Source: AMC1 Article 11, S.4.8.3(d) — "considering the most stringent
  // between the value of the average population density and the outdoor
  // assembly of people".
  //
  // The right-most column whose two limits both cover the actual adjacent
  // area is the least demanding column the operator may claim.
  // ---------------------------------------------------------------------------

  /**
   * Look up the required containment robustness.
   * @param {object} table         - One of TABLE_8 … TABLE_13
   * @param {number} sail          - SAIL 1–6
   * @param {number} popBand       - From normalisePopBand()
   * @param {number} assemblyRank  - From normaliseAssemblyRank()
   * @returns {{ code, robustness, robustnessIndex, outOfScope, columnIndex, column, limitedBy }}
   */
  function lookupContainment(table, sail, popBand, assemblyRank) {
    const row = table.rows[sail];
    if (!row) throw new Error('Invalid SAIL for containment lookup: ' + sail);

    let columnIndex = 0;
    for (let i = table.columns.length - 1; i >= 0; i--) {
      const col = table.columns[i];
      if (popBand <= col.popLimit && assemblyRank <= col.assemblyRank) { columnIndex = i; break; }
    }

    // Which of the two inputs stopped us from moving further right?
    let limitedBy = null;
    const next = table.columns[columnIndex + 1];
    if (next) {
      const popBlocks      = popBand > next.popLimit;
      const assemblyBlocks = assemblyRank > next.assemblyRank;
      limitedBy = popBlocks && assemblyBlocks ? 'both' : popBlocks ? 'population' : 'assembly';
    }

    const code = row[columnIndex];
    return {
      code,
      robustness:      code === 'X' ? null : ROBUSTNESS[code],
      robustnessIndex: code === 'X' ? null : ROBUSTNESS_INDEX[code],
      outOfScope:      code === 'X',
      columnIndex,
      column: table.columns[columnIndex],
      limitedBy,
    };
  }

  // ---------------------------------------------------------------------------
  // SECTION 6 — FULL STEP #8 PIPELINE
  // ---------------------------------------------------------------------------

  const GUIDANCE = {
    low:    'Low robustness — see Annex E, Section 4 of AMC1 Article 11 for the containment requirements.',
    medium: 'Medium robustness — see Annex E, Section 4 of AMC1 Article 11 for the containment requirements.',
    high:   'High robustness — see Annex E, Section 4 of AMC1 Article 11 for the containment requirements.',
  };

  function baseResult(adjacentAreaKm) {
    return {
      adjacentAreaKm,
      sizeClass:          null,
      tableRef:           null,
      robustness:         null,   // 'low' | 'medium' | 'high' | null
      robustnessIndex:    null,   // 1–3 | null
      outOfScope:         false,
      outOfScopeGuidance: null,
      incomplete:         false,  // true when an input is still missing
      under250g:          false,
      columnIndex:        null,
      limitedBy:          null,
      shelterDecision:    null,
      operationalLimits:  [],     // limits the operator must document and respect
      guidance:           null,
      note:               null,
    };
  }

  /**
   * Full SORA Step #8 containment pipeline.
   *
   * @param {object}  params
   * @param {number}  params.dimMeters             - Maximum characteristic dimension (m)
   * @param {number}  params.speedMs               - Maximum speed (m/s)
   * @param {number}  [params.massGrams]           - Take-off mass in grams (null = unknown)
   * @param {number}  params.sail                  - SAIL 1–6 from Step #7
   * @param {number|string} params.adjPopDensity   - Average population density of the adjacent
   *                                                 ground area, or a selector band value
   * @param {number|string} params.assemblySize    - Largest outdoor assembly within 1 km of the
   *                                                 operational volume, or a selector value
   * @param {boolean} [params.shelteringApplicable] - Sheltering applicable in the adjacent
   *                                                 ground area (3 m UA only; Table 9 vs 10)
   * @returns {object} See baseResult()
   */
  function computeContainment(params) {
    const {
      dimMeters            = 0,
      speedMs              = 0,
      massGrams            = null,
      sail                 = 0,
      adjPopDensity        = null,
      assemblySize         = null,
      shelteringApplicable = false,
    } = params || {};

    const result = baseResult(calcAdjacentAreaKm(speedMs));

    // -------------------------------------------------------------------------
    // Take-off mass below 250 g — AMC1 Article 11, S.4.8.3(a):
    // "apply low containment with no required operational limitations for the
    //  population in the adjacent ground area and go to Step #9".
    // -------------------------------------------------------------------------
    if (massGrams !== null && massGrams !== undefined && massGrams < 250) {
      result.under250g       = true;
      result.robustness      = 'low';
      result.robustnessIndex = 1;
      result.tableRef        = 'S.4.8.3(a) — take-off mass below 250 g';
      result.guidance        = GUIDANCE.low;
      result.note            = 'Take-off mass below 250 g: low containment applies, with no operational limitations for the population in the adjacent ground area. [AMC1 Article 11, S.4.8.3(a)]';
      return result;
    }

    const sizeClass = getContainmentSizeClass(dimMeters, speedMs);
    result.sizeClass = sizeClass;

    if (sizeClass === null) {
      result.outOfScope = true;
      result.outOfScopeGuidance =
        `UA with characteristic dimension ${dimMeters} m and maximum speed ${speedMs} m/s is not covered by ` +
        'Tables 8 to 13 (maximum 40 m and 200 m/s). [AMC1 Article 11, S.4.8.3]';
      return result;
    }

    if (!sail || sail < 1 || sail > 6) {
      result.incomplete = true;
      result.note = 'SAIL not yet determined — complete Steps #2 to #7 first.';
      return result;
    }

    const popBand      = normalisePopBand(adjPopDensity);
    const assemblyRank = normaliseAssemblyRank(assemblySize);
    if (popBand === null || assemblyRank === null) {
      result.incomplete = true;
      result.note = 'Select the average population density of the adjacent ground area and the size of outdoor assemblies within 1 km.';
      return result;
    }

    // Table selection. Only the 3 m class distinguishes shelter / no shelter.
    let table;
    if (sizeClass === 1) {
      table = shelteringApplicable ? TABLE_9 : TABLE_10;
      result.shelterDecision = shelteringApplicable
        ? 'Sheltering applicable in the adjacent ground area — Table 9 used.'
        : 'Sheltering not applicable in the adjacent ground area — Table 10 used.';
    } else {
      table = [TABLE_8, null, TABLE_11, TABLE_12, TABLE_13][sizeClass];
    }
    result.tableRef = table.tableRef;

    const lookup = lookupContainment(table, sail, popBand, assemblyRank);
    result.columnIndex = lookup.columnIndex;
    result.limitedBy   = lookup.limitedBy;

    if (lookup.outOfScope) {
      result.outOfScope = true;
      result.outOfScopeGuidance =
        'Out of scope: with this adjacent ground area the operation cannot be conducted in the ‘specific’ category. ' +
        'Consider another location or a higher SAIL. [AMC1 Article 11, S.4.8.3, ' + table.tableRef.split(' — ')[0] + ']';
      return result;
    }

    result.robustness        = lookup.robustness;
    result.robustnessIndex   = lookup.robustnessIndex;
    result.operationalLimits = describeColumn(lookup.column);
    result.guidance          = GUIDANCE[lookup.robustness];
    if (lookup.limitedBy === 'assembly') {
      result.note = 'The size of outdoor assemblies within 1 km is the governing limit.';
    } else if (lookup.limitedBy === 'population') {
      result.note = 'The average population density of the adjacent ground area is the governing limit.';
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------
  window.calcAdjacentAreaKm      = calcAdjacentAreaKm;
  window.getContainmentSizeClass = getContainmentSizeClass;
  window.normalisePopBand        = normalisePopBand;
  window.normaliseAssemblyRank   = normaliseAssemblyRank;
  window.lookupContainment       = lookupContainment;
  window.computeContainment      = computeContainment;
  window.CONTAINMENT_TABLES      = { TABLE_8, TABLE_9, TABLE_10, TABLE_11, TABLE_12, TABLE_13 };
  window.CONTAINMENT_ROBUSTNESS  = ROBUSTNESS;

})();
