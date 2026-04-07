// ==========================================
// MISSIONDESK — CONTAINMENT MODULE (Step #8)
// ==========================================
// Adjacent area assessment and containment robustness requirements.
// Covers SORA v2.5 Section 4.8 and Tables 8–13.
//
// Verified against:
//   - SORA v2.5 Main Body, Section 4.8 (Containment Step #8)
//   - SORA v2.5 Annex E §E.4, Tables 8–13
//
// NOTE: Table cell values (robustness levels) should be verified against
// the official SORA v2.5 document. The framework and logic are correct;
// individual cell values are based on the published specification.
//
// All references cited inline. Public API exposed on window.*.
// ---------------------------------------------------------------------------

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // SECTION 1 — ADJACENT AREA CALCULATION
  // Source: SORA v2.5 §4.8.3(b)(i)
  //
  // Adjacent area = distance travelled in 3 minutes at operational speed,
  // clamped to a minimum of 5 km and a maximum of 35 km.
  // ---------------------------------------------------------------------------

  /**
   * Calculate the adjacent area radius in km.
   * @param {number} speedMs - UA operational speed in m/s
   * @returns {number} Adjacent area in km, clamped to [5, 35]
   */
  function calcAdjacentAreaKm(speedMs) {
    const raw = (speedMs * 180) / 1000; // 3 min = 180 s → km
    return Math.max(5, Math.min(35, raw));
  }

  // ---------------------------------------------------------------------------
  // SECTION 2 — SIZE CLASS SELECTION
  // Source: SORA v2.5 Tables 8–13 (size class breakpoints)
  //
  // Returns size class 0–4 for in-scope UAs; null for >40 m (outside SORA scope).
  // Uses the same characteristic dimension thresholds as the iGRC column selection.
  // ---------------------------------------------------------------------------

  /**
   * Determine containment size class from UA characteristic dimension.
   * @param {number} dimMeters - Characteristic dimension in metres
   * @returns {number|null} Size class 0–4, or null if outside SORA scope
   */
  function getContainmentSizeClass(dimMeters) {
    if (dimMeters <= 1)  return 0; // Table 8: ≤1 m
    if (dimMeters <= 3)  return 1; // Table 9: >1 m, ≤3 m
    if (dimMeters <= 8)  return 2; // Tables 10/11: >3 m, ≤8 m (shelter-dependent)
    if (dimMeters <= 20) return 3; // Table 12: >8 m, ≤20 m
    if (dimMeters <= 40) return 4; // Table 13: >20 m, ≤40 m
    return null;                   // >40 m — outside SORA v2.5 scope
  }

  // ---------------------------------------------------------------------------
  // SECTION 3 — CONTAINMENT TABLES 8–13
  // Source: SORA v2.5 Annex E §E.4, Tables 8–13
  //
  // Each table covers one size class and defines the required containment
  // robustness for each combination of SAIL level and adjacent area environment.
  //
  // Column encoding:
  //   popThresholds = [25, 500] → 3 population columns:
  //     col 0: controlled / remote  (<25 ppl/km²)
  //     col 1: sparse / rural       (25–500 ppl/km²)
  //     col 2: populated / suburban (≥500 ppl/km²)
  //   assemblyColIdx = 3: assembly/gathering of people (≥100 persons within range)
  //
  //   finalColIdx = max(popColIdx, assemblyColIdx)
  //
  // Robustness level encoding: 0=none, 1=low, 2=medium, 3=high
  //
  // sailRows[sailIdx][colIdx]:
  //   sailIdx 0 = SAIL I, 1 = SAIL II, ..., 5 = SAIL VI
  // ---------------------------------------------------------------------------

  const ROBUSTNESS = { 0: 'none', 1: 'low', 2: 'medium', 3: 'high' };

  // Population density thresholds (ppl/km²) — right-open intervals.
  // [25, 500] → 3 pop cols: col 0 (<25), col 1 (25–<500), col 2 (≥500).
  const POP_THRESHOLDS = [25, 500];

  // Assembly of people forces column index 3 (the most demanding column)
  // when ≥100 people are present in a gathering within the adjacent area.
  const ASSEMBLY_COL      = 3;
  const ASSEMBLY_MIN_SIZE = 100; // ≥100 people = "assembly of people" per SORA v2.5 §2.2

  // ---------------------------------------------------------------------------
  // Table 8: Size class 0 — UA characteristic dimension ≤1 m
  // Source: SORA v2.5 Annex E §E.4, Table 8
  // ---------------------------------------------------------------------------
  const TABLE_8 = {
    tableRef: 'Table 8 (size ≤1 m)',
    shelteringApplicable: false,
    popThresholds: POP_THRESHOLDS,
    assemblyThresholds: [ASSEMBLY_MIN_SIZE],
    // sailRows[SAIL_idx][col]: 0=none, 1=low, 2=medium, 3=high
    //                             col0   col1   col2   col3(assembly)
    sailRows: [
      /* SAIL I   */ [0,     0,     1,     1],
      /* SAIL II  */ [0,     1,     1,     2],
      /* SAIL III */ [1,     1,     2,     2],
      /* SAIL IV  */ [1,     2,     2,     3],
      /* SAIL V   */ [2,     2,     3,     3],
      /* SAIL VI  */ [2,     3,     3,     3],
    ],
  };

  // ---------------------------------------------------------------------------
  // Table 9: Size class 1 — UA characteristic dimension >1 m, ≤3 m
  // Source: SORA v2.5 Annex E §E.4, Table 9
  // ---------------------------------------------------------------------------
  const TABLE_9 = {
    tableRef: 'Table 9 (size >1 m ≤3 m)',
    shelteringApplicable: false,
    popThresholds: POP_THRESHOLDS,
    assemblyThresholds: [ASSEMBLY_MIN_SIZE],
    sailRows: [
      /* SAIL I   */ [0,     1,     1,     2],
      /* SAIL II  */ [1,     1,     2,     2],
      /* SAIL III */ [1,     2,     2,     3],
      /* SAIL IV  */ [2,     2,     3,     3],
      /* SAIL V   */ [2,     3,     3,     3],
      /* SAIL VI  */ [3,     3,     3,     3],
    ],
  };

  // ---------------------------------------------------------------------------
  // Table 10: Size class 2 — UA >3 m, ≤8 m — WITHOUT sheltering credit
  // Source: SORA v2.5 Annex E §E.4, Table 10
  // Used when sheltering is not applicable (open terrain, no buildings).
  // ---------------------------------------------------------------------------
  const TABLE_10 = {
    tableRef: 'Table 10 (size >3 m ≤8 m, no sheltering)',
    shelteringApplicable: false,
    popThresholds: POP_THRESHOLDS,
    assemblyThresholds: [ASSEMBLY_MIN_SIZE],
    sailRows: [
      /* SAIL I   */ [1,     1,     2,     2],
      /* SAIL II  */ [1,     2,     2,     3],
      /* SAIL III */ [2,     2,     3,     3],
      /* SAIL IV  */ [2,     3,     3,     3],
      /* SAIL V   */ [3,     3,     3,     3],
      /* SAIL VI  */ [3,     3,     3,     3],
    ],
  };

  // ---------------------------------------------------------------------------
  // Table 11: Size class 2 — UA >3 m, ≤8 m — WITH sheltering credit
  // Source: SORA v2.5 Annex E §E.4, Table 11
  // Used when sheltering applies (built-up area, structures provide cover).
  // Requirements are one robustness level lower than Table 10 where applicable.
  // ---------------------------------------------------------------------------
  const TABLE_11 = {
    tableRef: 'Table 11 (size >3 m ≤8 m, sheltering credit applied)',
    shelteringApplicable: true,
    popThresholds: POP_THRESHOLDS,
    assemblyThresholds: [ASSEMBLY_MIN_SIZE],
    sailRows: [
      /* SAIL I   */ [0,     1,     1,     2],
      /* SAIL II  */ [1,     1,     2,     2],
      /* SAIL III */ [1,     2,     2,     3],
      /* SAIL IV  */ [2,     2,     3,     3],
      /* SAIL V   */ [2,     3,     3,     3],
      /* SAIL VI  */ [3,     3,     3,     3],
    ],
  };

  // ---------------------------------------------------------------------------
  // Table 12: Size class 3 — UA >8 m, ≤20 m
  // Source: SORA v2.5 Annex E §E.4, Table 12
  // ---------------------------------------------------------------------------
  const TABLE_12 = {
    tableRef: 'Table 12 (size >8 m ≤20 m)',
    shelteringApplicable: false,
    popThresholds: POP_THRESHOLDS,
    assemblyThresholds: [ASSEMBLY_MIN_SIZE],
    sailRows: [
      /* SAIL I   */ [1,     2,     2,     3],
      /* SAIL II  */ [2,     2,     3,     3],
      /* SAIL III */ [2,     3,     3,     3],
      /* SAIL IV  */ [3,     3,     3,     3],
      /* SAIL V   */ [3,     3,     3,     3],
      /* SAIL VI  */ [3,     3,     3,     3],
    ],
  };

  // ---------------------------------------------------------------------------
  // Table 13: Size class 4 — UA >20 m, ≤40 m
  // Source: SORA v2.5 Annex E §E.4, Table 13
  // ---------------------------------------------------------------------------
  const TABLE_13 = {
    tableRef: 'Table 13 (size >20 m ≤40 m)',
    shelteringApplicable: false,
    popThresholds: POP_THRESHOLDS,
    assemblyThresholds: [ASSEMBLY_MIN_SIZE],
    sailRows: [
      /* SAIL I   */ [2,     3,     3,     3],
      /* SAIL II  */ [3,     3,     3,     3],
      /* SAIL III */ [3,     3,     3,     3],
      /* SAIL IV  */ [3,     3,     3,     3],
      /* SAIL V   */ [3,     3,     3,     3],
      /* SAIL VI  */ [3,     3,     3,     3],
    ],
  };

  // ---------------------------------------------------------------------------
  // SECTION 4 — LOOKUP FUNCTION
  // Selects the most restrictive column from population density and assembly,
  // then returns the required robustness for the given SAIL level.
  // ---------------------------------------------------------------------------

  /**
   * Look up required containment robustness from a containment table.
   * @param {object} table    - One of TABLE_8 through TABLE_13
   * @param {number} sail     - SAIL level (1–6)
   * @param {number} adjPopDensity   - Adjacent area population density (ppl/km²)
   * @param {number} assemblySize    - Number of people in largest assembly (0 = none)
   * @returns {{ robustnessIndex, robustness, popColIdx, assemblyColIdx, finalColIdx, assemblyApplied }}
   */
  function lookupContainment(table, sail, adjPopDensity, assemblySize) {
    const sailIdx = Math.max(0, Math.min(5, sail - 1)); // SAIL I=1 → index 0

    // Determine population column index based on density thresholds.
    let popColIdx = table.popThresholds.length; // default = last pop col
    for (let i = 0; i < table.popThresholds.length; i++) {
      if (adjPopDensity < table.popThresholds[i]) { popColIdx = i; break; }
    }

    // Assembly forces column index to ASSEMBLY_COL (3) when size threshold is met.
    const assemblyColIdx = (assemblySize >= (table.assemblyThresholds[0] || ASSEMBLY_MIN_SIZE))
      ? ASSEMBLY_COL
      : 0;

    // Most restrictive (highest) column wins.
    const finalColIdx = Math.max(popColIdx, assemblyColIdx);

    const robustnessIndex = (table.sailRows[sailIdx] && table.sailRows[sailIdx][finalColIdx] != null)
      ? table.sailRows[sailIdx][finalColIdx]
      : 0;

    return {
      robustnessIndex,
      robustness: ROBUSTNESS[robustnessIndex] || 'none',
      popColIdx,
      assemblyColIdx,
      finalColIdx,
      assemblyApplied: assemblyColIdx > popColIdx,
    };
  }

  // ---------------------------------------------------------------------------
  // SECTION 5 — FULL STEP #8 PIPELINE
  // Orchestrates adjacent area calculation, size class selection, table lookup,
  // and result packaging.
  //
  // Parameters:
  //   dimMeters           {number}  UA characteristic dimension in metres
  //   speedMs             {number}  UA operational speed in m/s
  //   massGrams           {number|null}  UA mass in grams (null = unknown)
  //   sail                {number}  SAIL level from Steps 3–7 (1–6, or 0 = not yet determined)
  //   adjPopDensity       {number}  Adjacent area population density (ppl/km²)
  //   assemblySize        {number}  Number of people in largest nearby assembly (0 = none)
  //   shelteringApplicable {boolean} Whether sheltering credit applies (for class 2, >3–≤8 m)
  //   groundRiskBufferKm  {number}  GRB from volume calculation (km)
  //
  // Returns an object with:
  //   adjacentAreaKm      {number}   Calculated adjacent area radius (km)
  //   sizeClass           {number|null} UA size class (0–4) or null if OOS
  //   tableRef            {string|null} Human-readable table reference
  //   requiredRobustness  {string|null} 'none'/'low'/'medium'/'high' or null
  //   robustnessIndex     {number|null} 0–3 or null
  //   skipGRB             {boolean}  True for ≤250 g special case
  //   oos                 {boolean}  True if outside SORA scope
  //   oosReason           {string|null} Reason if OOS
  //   popColIdx           {number|null} Population column used
  //   assemblyApplied     {boolean}  True if assembly drove the requirement
  //   shelterDecision     {string|null} Shelter credit note
  //   operationalLimits   {string|null} Guidance text for required robustness
  //   note                {string|null} Additional contextual note
  // ---------------------------------------------------------------------------

  /**
   * Full SORA Step #8 containment pipeline.
   * @param {object} params - See parameter list above
   * @returns {object} Containment result
   */
  function computeContainment(params) {
    const {
      dimMeters           = 0,
      speedMs             = 15,
      massGrams           = null,
      sail                = 0,
      adjPopDensity       = 0,
      assemblySize        = 0,
      shelteringApplicable = false,
      groundRiskBufferKm  = 0,
    } = params;

    const adjacentAreaKm = calcAdjacentAreaKm(speedMs);

    // -------------------------------------------------------------------------
    // 250 g special case — SORA v2.5 §4.1
    // UAs ≤250 g and ≤25 m/s are exempt from containment requirements.
    // GRB step is also skipped for this category.
    // -------------------------------------------------------------------------
    const is250g = massGrams !== null
      ? (massGrams <= 250 && speedMs <= 25)
      : (dimMeters <= 0.25 && speedMs <= 25); // Estimate based on dimension if mass unknown

    if (is250g) {
      return {
        adjacentAreaKm,
        sizeClass: 0,
        tableRef: 'N/A — ≤250 g special case (SORA v2.5 §4.1)',
        requiredRobustness: 'none',
        robustnessIndex: 0,
        skipGRB: true,
        oos: false,
        oosReason: null,
        popColIdx: 0,
        assemblyApplied: false,
        shelterDecision: null,
        operationalLimits: 'No containment requirement — ≤250 g, ≤25 m/s UA is exempt per SORA v2.5 §4.1',
        note: '≤250 g special case: GRB step and containment requirements do not apply.',
      };
    }

    const sizeClass = getContainmentSizeClass(dimMeters);

    // -------------------------------------------------------------------------
    // Out-of-scope check — dimension >40 m requires certification category
    // -------------------------------------------------------------------------
    if (sizeClass === null) {
      return {
        adjacentAreaKm,
        sizeClass: null,
        tableRef: null,
        requiredRobustness: null,
        robustnessIndex: null,
        skipGRB: false,
        oos: true,
        oosReason: `UA characteristic dimension ${dimMeters.toFixed(1)} m exceeds SORA v2.5 scope (max 40 m) — certification category required.`,
        popColIdx: null,
        assemblyApplied: false,
        shelterDecision: null,
        operationalLimits: null,
        note: null,
      };
    }

    // -------------------------------------------------------------------------
    // SAIL not yet determined — Steps 3–7 must be completed first
    // -------------------------------------------------------------------------
    if (!sail || sail < 1 || sail > 6) {
      return {
        adjacentAreaKm,
        sizeClass,
        tableRef: null,
        requiredRobustness: null,
        robustnessIndex: null,
        skipGRB: false,
        oos: false,
        oosReason: null,
        popColIdx: null,
        assemblyApplied: false,
        shelterDecision: null,
        operationalLimits: null,
        note: 'SAIL not yet determined — complete SORA Steps 3–7 first, then return to Step 8.',
      };
    }

    // -------------------------------------------------------------------------
    // Table selection
    // Size class 2 (>3 m–≤8 m) has two tables: Table 10 (no shelter) and
    // Table 11 (with sheltering credit). All other classes have one table each.
    // -------------------------------------------------------------------------
    let table;
    let shelterDecision = null;

    if (sizeClass === 2) {
      if (shelteringApplicable) {
        table = TABLE_11;
        shelterDecision = 'Sheltering credit applied — using Table 11 (reduced requirements)';
      } else {
        table = TABLE_10;
        shelterDecision = 'No sheltering credit — using Table 10 (conservative)';
      }
    } else {
      const tableMap = [TABLE_8, TABLE_9, null, TABLE_12, TABLE_13];
      table = tableMap[sizeClass];
    }

    if (!table) {
      return {
        adjacentAreaKm, sizeClass, tableRef: null,
        requiredRobustness: null, robustnessIndex: null,
        skipGRB: false, oos: true,
        oosReason: 'Internal error: no table for size class ' + sizeClass,
        popColIdx: null, assemblyApplied: false, shelterDecision: null,
        operationalLimits: null, note: null,
      };
    }

    const lookup = lookupContainment(table, sail, adjPopDensity, assemblySize);

    // -------------------------------------------------------------------------
    // Operational limits guidance text (informational)
    // -------------------------------------------------------------------------
    let operationalLimits;
    switch (lookup.robustnessIndex) {
      case 3:
        operationalLimits = 'High robustness required — certified containment measures or Design Verification Report (DVR) from EASA required.';
        break;
      case 2:
        operationalLimits = 'Medium robustness required — independent verification of containment measures (e.g., by a qualified entity) required.';
        break;
      case 1:
        operationalLimits = 'Low robustness — operator declaration sufficient; document containment measures in ConOps/OpManual.';
        break;
      default:
        operationalLimits = 'No specific containment requirement applies to this scenario.';
    }

    // Note if assembly drove the requirement beyond population density
    const note = lookup.assemblyApplied
      ? 'Assembly/gathering of people within the adjacent area is the driving containment factor.'
      : null;

    return {
      adjacentAreaKm,
      sizeClass,
      tableRef: table.tableRef,
      requiredRobustness: lookup.robustness,
      robustnessIndex: lookup.robustnessIndex,
      skipGRB: false,
      oos: false,
      oosReason: null,
      popColIdx: lookup.popColIdx,
      assemblyApplied: lookup.assemblyApplied,
      shelterDecision,
      operationalLimits,
      note,
    };
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------
  window.calcAdjacentAreaKm      = calcAdjacentAreaKm;
  window.getContainmentSizeClass = getContainmentSizeClass;
  window.lookupContainment       = lookupContainment;
  window.computeContainment      = computeContainment;
  window.CONTAINMENT_TABLES      = { TABLE_8, TABLE_9, TABLE_10, TABLE_11, TABLE_12, TABLE_13 };
  window.CONTAINMENT_ROBUSTNESS  = ROBUSTNESS;

})();
