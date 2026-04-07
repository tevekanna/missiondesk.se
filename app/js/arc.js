// ==========================================
// MISSIONDESK — ARC CALCULATION MODULE
// ==========================================
// Air Risk Class (ARC) determination: initial ARC (Step #4),
// residual ARC after strategic mitigations (Step #5),
// Tactical Mitigation Performance Requirement (TMPR, Step #6),
// and SAIL determination (Step #7).
//
// Verified against:
//   - SORA v2.5 Main Body, Section 4.4–4.7, Figure 6, Tables 6–7
//   - SORA v2.5 Annex C (Easy Access Rules), Tables C.1 and C.2
//   - EASA Guidelines, Issue 3 (July 2025), Appendix V and VI
//
// All references cited inline. Public API exposed on window.*.
// ---------------------------------------------------------------------------

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // SECTION 1 — AIRSPACE ENCOUNTER CLASS (AEC) DEFINITIONS
  // ---------------------------------------------------------------------------
  // Source: SORA v2.5 Annex C, Table C.1 (p. 98)
  //         SORA v2.5 Main Body, Section 4.4.4, Figure 6 (p. 41)
  //
  // The 12 AECs map every combination of operational conditions to an initial ARC.
  // AEC 12 = atypical/segregated airspace → ARC-a
  // AEC 11 = above FL600                  → ARC-b
  // AEC 10 = < 150 m AGL, uncontrolled, rural → ARC-b  (reference environment)
  // AEC 9  = < 150 m AGL, uncontrolled, urban → ARC-c
  // AEC 8  = < 150 m AGL, controlled airspace → ARC-c
  // AEC 7  = < 150 m AGL, Mode-S veil / TMZ   → ARC-c
  // AEC 6  = airport/heliport in class E/F/G  → ARC-c
  // AEC 5  = > 150 m AGL, uncontrolled, rural → ARC-c
  // AEC 4  = > 150 m AGL, uncontrolled, urban → ARC-c
  // AEC 3  = > 150 m AGL, controlled (non-TMZ, non-airport) → ARC-d
  // AEC 2  = > 150 m AGL, Mode-S veil / TMZ → ARC-d
  // AEC 1  = airport/heliport in class B/C/D  → ARC-d
  const AEC_TABLE = {
    1:  { description: 'Airport/heliport environment in class B, C or D airspace',             densityRating: 5, initialARC: 'd' },
    2:  { description: 'OPS > 150 m AGL in Mode-S Veil or TMZ',                               densityRating: 5, initialARC: 'd' },
    3:  { description: 'OPS > 150 m AGL in controlled airspace',                               densityRating: 5, initialARC: 'd' },
    4:  { description: 'OPS > 150 m AGL, uncontrolled, over urban area',                       densityRating: 3, initialARC: 'c' },
    5:  { description: 'OPS > 150 m AGL, uncontrolled, over rural area',                       densityRating: 2, initialARC: 'c' },
    6:  { description: 'Airport/heliport environment in class E, F or G airspace',              densityRating: 3, initialARC: 'c' },
    7:  { description: 'OPS < 150 m AGL in Mode-S Veil or TMZ',                               densityRating: 3, initialARC: 'c' },
    8:  { description: 'OPS < 150 m AGL in controlled airspace',                               densityRating: 3, initialARC: 'c' },
    9:  { description: 'OPS < 150 m AGL, uncontrolled, over urban area',                       densityRating: 2, initialARC: 'c' },
    10: { description: 'OPS < 150 m AGL, uncontrolled, over rural area (reference)',            densityRating: 1, initialARC: 'b' },
    11: { description: 'OPS above FL600',                                                       densityRating: 1, initialARC: 'b' },
    12: { description: 'OPS in atypical or segregated airspace',                                densityRating: 1, initialARC: 'a' },
  };

  // ---------------------------------------------------------------------------
  // SECTION 2 — INITIAL ARC DECISION TREE (Figure 6)
  // ---------------------------------------------------------------------------
  // Source: SORA v2.5 Main Body, Figure 6 (p. 41) and Section 4.4.3
  //
  // Decision order mirrors Figure 6 exactly:
  //   1. Atypical/segregated? → ARC-a (AEC 12)
  //   2. Above FL600?         → ARC-b (AEC 11)
  //   3. Airport/heliport environment?
  //        Class B/C/D? → ARC-d (AEC 1)  |  Class E/F/G → ARC-c (AEC 6)
  //   4. Above 150 m AGL?
  //        Mode-S/TMZ?  → ARC-d (AEC 2)
  //        Controlled?  → ARC-d (AEC 3)
  //        Urban?       → ARC-c (AEC 4)
  //        Rural        → ARC-c (AEC 5)
  //   5. Below 150 m AGL:
  //        Mode-S/TMZ?  → ARC-c (AEC 7)
  //        Controlled?  → ARC-c (AEC 8)
  //        Urban?       → ARC-c (AEC 9)
  //        Rural        → ARC-b (AEC 10)

  /**
   * getInitialARC()
   * Determines the initial AEC and ARC from the decision tree in Figure 6.
   *
   * @param {object} params
   * @param {boolean} params.atypical       - Atypical/segregated airspace
   * @param {boolean} params.aboveFL600     - Max altitude > FL600
   * @param {boolean} params.airportEnv     - Within airport/heliport environment
   * @param {boolean} params.classBCD       - Class B, C or D (only when airportEnv)
   * @param {boolean} params.above150m      - Max altitude > 150 m AGL (below FL600)
   * @param {boolean} params.modeSVeilOrTMZ - Within Mode-S veil or TMZ
   * @param {boolean} params.controlled     - Controlled airspace (class A–E)
   * @param {boolean} params.urban          - Over urban area (false = rural)
   * @returns {{ aec, initialARC, description, densityRating }}
   */
  function getInitialARC(params) {
    const {
      atypical       = false,
      aboveFL600     = false,
      airportEnv     = false,
      classBCD       = false,
      above150m      = false,
      modeSVeilOrTMZ = false,
      controlled     = false,
      urban          = false,
    } = params;

    if (atypical)               return _arcResult(12);
    if (aboveFL600)             return _arcResult(11);
    if (airportEnv)             return classBCD ? _arcResult(1) : _arcResult(6);
    if (above150m) {
      if (modeSVeilOrTMZ)       return _arcResult(2);
      if (controlled)           return _arcResult(3);
      if (urban)                return _arcResult(4);
      return _arcResult(5);
    }
    if (modeSVeilOrTMZ)         return _arcResult(7);
    if (controlled)             return _arcResult(8);
    if (urban)                  return _arcResult(9);
    return _arcResult(10);      // Rural < 150 m — reference environment
  }

  function _arcResult(aec) {
    const e = AEC_TABLE[aec];
    return { aec, initialARC: e.initialARC, description: e.description, densityRating: e.densityRating };
  }

  // ---------------------------------------------------------------------------
  // SECTION 3 — STRATEGIC MITIGATIONS: RESIDUAL ARC (STEP #5)
  // ---------------------------------------------------------------------------
  // Source: SORA v2.5 Annex C, Table C.2 (p. 99) and Section C.6
  //
  // AECs 10, 11, 12 are NOT in Table C.2.
  // SORA does NOT allow ARC reduction via "common structures and rules"
  // for AECs 1, 2, 3, 4, 5 and 11. [Annex C, Section C.6.3]

  const ARC_REDUCTION_TABLE = {
    1:  { densityForArcC: 3, densityForArcB: 2, canReduceByCommonStructures: false },
    2:  { densityForArcC: 3, densityForArcB: 2, canReduceByCommonStructures: false },
    3:  { densityForArcC: 2, densityForArcB: 1, canReduceByCommonStructures: false },
    4:  { densityForArcC: null, densityForArcB: 1, canReduceByCommonStructures: false },
    5:  { densityForArcC: null, densityForArcB: 1, canReduceByCommonStructures: false },
    6:  { densityForArcC: null, densityForArcB: 1, canReduceByCommonStructures: true  },
    7:  { densityForArcC: null, densityForArcB: 1, canReduceByCommonStructures: true  },
    8:  { densityForArcC: null, densityForArcB: 1, canReduceByCommonStructures: true  },
    9:  { densityForArcC: null, densityForArcB: 1, canReduceByCommonStructures: true  },
    10: null, // Not in Table C.2 — reduction would reach ARC-a [Note 1]
    11: null, // Not in Table C.2
    12: null, // Already ARC-a
  };

  /**
   * getResidualARC()
   * Applies strategic mitigations to lower the initial ARC.
   * If no mitigation is claimed, residual ARC equals initial ARC.
   * [SORA v2.5 Main Body, Section 4.5; Annex C, Table C.2]
   *
   * @param {number} aec          - AEC from getInitialARC()
   * @param {string} initialARC   - Initial ARC ('a'|'b'|'c'|'d')
   * @param {object|null} mitigation
   * @param {number}  [mitigation.localDensityRating]  - Demonstrated local density (1–5)
   * @param {boolean} [mitigation.claimAtypical]       - Claim ARC-a via atypical demonstration
   * @returns {{ residualARC, mitigationApplied, warning, details }}
   */
  function getResidualARC(aec, initialARC, mitigation = null) {
    const details = [];
    if (!mitigation) {
      return { residualARC: initialARC, mitigationApplied: false, warning: null, details };
    }
    const { localDensityRating = null, claimAtypical = false } = mitigation;

    // Claim ARC-a via atypical/segregated demonstration [Annex C, Section C.6.1]
    if (claimAtypical) {
      details.push(
        'ARC-a claimed via atypical/segregated airspace demonstration. ' +
        'Operator must demonstrate compliance with competent authority requirements. ' +
        '[SORA Annex C, Section C.6.1]'
      );
      return { residualARC: 'a', mitigationApplied: true, warning: null, details };
    }

    // Density-based reduction via Table C.2
    if (localDensityRating !== null) {
      const entry = ARC_REDUCTION_TABLE[aec];
      if (entry === null) {
        const warn =
          `AEC ${aec} is not in Table C.2. No density-based reduction is available. ` +
          `[SORA Annex C, Table C.2, Note 1]`;
        details.push(warn);
        return { residualARC: initialARC, mitigationApplied: false, warning: warn, details };
      }
      if (localDensityRating <= entry.densityForArcB) {
        details.push(`Local density ${localDensityRating} ≤ ${entry.densityForArcB} → ARC-b [Annex C, Table C.2]`);
        return { residualARC: 'b', mitigationApplied: true, warning: null, details };
      }
      if (entry.densityForArcC !== null && localDensityRating <= entry.densityForArcC) {
        details.push(`Local density ${localDensityRating} ≤ ${entry.densityForArcC} → ARC-c [Annex C, Table C.2]`);
        return { residualARC: 'c', mitigationApplied: true, warning: null, details };
      }
      const warn =
        `Local density rating ${localDensityRating} does not meet any reduction threshold for AEC ${aec}. ` +
        `Residual ARC remains ARC-${initialARC.toUpperCase()}.`;
      details.push(warn);
      return { residualARC: initialARC, mitigationApplied: false, warning: warn, details };
    }

    return { residualARC: initialARC, mitigationApplied: false, warning: null, details };
  }

  // ---------------------------------------------------------------------------
  // SECTION 3b — AUTHORITY OVERRIDE ARC
  // ---------------------------------------------------------------------------
  // Source: SORA v2.5 Main Body, Section 4.4.4(d)
  //
  // "In some situations, the competent authority may raise the operational
  //  volume ARC to a level which is higher than that indicated by Figure 6.
  //  The ANSP should be consulted to assure that the assumptions related to
  //  the operational volume are accurate."
  //
  // This is a ONE-WAY override: the authority can only RAISE the ARC above
  // what the decision tree produces — never lower it through this mechanism.
  // The override is applied AFTER the initial ARC and BEFORE Step #5, so
  // the operator's strategic mitigations (Step #5) still apply afterwards.
  //
  // Practical examples:
  //   - A known military low-level route passes through the operational volume
  //   - Seasonal glider/paraglider activity makes the area busier than the
  //     generalised AEC suggests
  //   - A national NAA policy assigns a higher ARC to a specific region

  const ARC_ORDER = { a: 0, b: 1, c: 2, d: 3 };

  /**
   * applyAuthorityOverride()
   * Raises the ARC to the authority-mandated level if it is higher than the
   * ARC produced by the decision tree. A lower or equal override is ignored.
   * [SORA v2.5 Main Body, Section 4.4.4(d)]
   *
   * @param {string}      computedARC  - ARC from getInitialARC()
   * @param {string|null} overrideARC  - Authority-mandated ARC, or null if not set
   * @returns {{ effectiveInitialARC, overrideApplied, overrideNote }}
   */
  function applyAuthorityOverride(computedARC, overrideARC) {
    if (!overrideARC) {
      return { effectiveInitialARC: computedARC, overrideApplied: false, overrideNote: null };
    }
    if (!ARC_ORDER.hasOwnProperty(overrideARC)) {
      throw new Error(`Invalid authorityOverrideARC value: '${overrideARC}'. Must be 'a', 'b', 'c', or 'd'.`);
    }
    if (ARC_ORDER[overrideARC] > ARC_ORDER[computedARC]) {
      return {
        effectiveInitialARC: overrideARC,
        overrideApplied: true,
        overrideNote:
          `⚠ Authority override: ARC raised from ARC-${computedARC.toUpperCase()} to ` +
          `ARC-${overrideARC.toUpperCase()} by competent authority / ANSP. ` +
          `Verify with ANSP that assumptions for the operational volume are accurate. ` +
          `[SORA v2.5 Main Body, Section 4.4.4(d)]`,
      };
    }
    // Override equal or lower — silently ignore (cannot lower via this path)
    return {
      effectiveInitialARC: computedARC,
      overrideApplied: false,
      overrideNote:
        `Authority override ARC-${overrideARC.toUpperCase()} is not higher than ` +
        `computed ARC-${computedARC.toUpperCase()} — override ignored. ` +
        `[SORA v2.5 Main Body, Section 4.4.4(d)]`,
    };
  }

  // ---------------------------------------------------------------------------
  // SECTION 4 — TMPR DETERMINATION (STEP #6)
  // ---------------------------------------------------------------------------
  // Source: SORA v2.5 Main Body, Section 4.6, Table 6 (p. 45)
  //         SORA v2.5 Annex D, Table D.1 (p. 105)
  //
  // VLOS is an acceptable tactical mitigation for ALL ARC levels.
  // VLOS segments do NOT need to meet TMPR. [Section 4.6.3(a) and 4.6.4]

  const TMPR_TABLE = {
    d: { tmpr: 'High',   robustness: 'High',   riskRatio: 0.10  },
    c: { tmpr: 'Medium', robustness: 'Medium', riskRatio: 0.33  },
    b: { tmpr: 'Low',    robustness: 'Low',    riskRatio: 0.66  },
    a: { tmpr: 'None',   robustness: 'None',   riskRatio: null  },
  };

  /**
   * getTMPR()
   * Returns the Tactical Mitigation Performance Requirement.
   *
   * @param {string}  residualARC - 'a'|'b'|'c'|'d'
   * @param {boolean} isVLOS      - True for VLOS/EVLOS operations
   * @returns {{ tmpr, robustness, riskRatio, vlosExempt, note }}
   */
  function getTMPR(residualARC, isVLOS = false) {
    const entry = TMPR_TABLE[residualARC];
    if (!entry) throw new Error(`Unknown residual ARC: ${residualARC}`);
    if (isVLOS) {
      return {
        tmpr: 'N/A (VLOS)', robustness: 'N/A (VLOS)', riskRatio: null, vlosExempt: true,
        note: 'VLOS is an acceptable tactical mitigation for all ARC levels. ' +
              'A documented see-and-avoid scheme is still required. [SORA v2.5, Section 4.6.4(a)]',
      };
    }
    return {
      tmpr: entry.tmpr, robustness: entry.robustness, riskRatio: entry.riskRatio, vlosExempt: false,
      note: entry.tmpr === 'None'
        ? 'No TMPR required for ARC-a. [SORA Main Body, Section 4.6.4(d)]'
        : `TMPR ${entry.tmpr} required. System risk ratio objective: ≤${entry.riskRatio}. [Annex D, Table D.1]`,
    };
  }

  // ---------------------------------------------------------------------------
  // SECTION 5 — SAIL DETERMINATION (STEP #7)
  // ---------------------------------------------------------------------------
  // Source: SORA v2.5 Main Body, Section 4.7, Table 7 (p. 47)
  //
  //           ARC-a  ARC-b  ARC-c  ARC-d
  //  GRC ≤ 2    I     II     IV     VI
  //  GRC = 3   II     II     IV     VI
  //  GRC = 4  III    III     IV     VI
  //  GRC = 5   IV     IV     IV     VI
  //  GRC = 6    V      V      V     VI
  //  GRC = 7   VI     VI     VI     VI
  //  GRC > 7 → Certified category required

  const SAIL_MATRIX = {
    2: { a: 1, b: 2, c: 4, d: 6 },
    3: { a: 2, b: 2, c: 4, d: 6 },
    4: { a: 3, b: 3, c: 4, d: 6 },
    5: { a: 4, b: 4, c: 4, d: 6 },
    6: { a: 5, b: 5, c: 5, d: 6 },
    7: { a: 6, b: 6, c: 6, d: 6 },
  };

  const SAIL_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

  /**
   * getSAIL()
   * Determines SAIL from final GRC and residual ARC.
   * [SORA v2.5 Main Body, Section 4.7, Table 7]
   *
   * @param {number} finalGRC    - Final GRC from igrc.js
   * @param {string} residualARC - 'a'|'b'|'c'|'d'
   * @returns {{ sail, sailRoman, outOfScope, reason }}
   */
  function getSAIL(finalGRC, residualARC) {
    if (finalGRC > 7) {
      return {
        sail: null, sailRoman: null, outOfScope: true,
        reason: `Final GRC ${finalGRC} > 7 — operation requires the Certified category. [SORA Main Body, Section 4.7.3]`,
      };
    }
    const grcKey = Math.max(2, Math.min(7, finalGRC));
    const sail = SAIL_MATRIX[grcKey][residualARC];
    return { sail, sailRoman: SAIL_ROMAN[sail], outOfScope: false, reason: null };
  }

  // ---------------------------------------------------------------------------
  // SECTION 6 — MAIN ENTRY POINT: computeAirRisk()
  // ---------------------------------------------------------------------------

  /**
   * computeAirRisk()
   * Complete pipeline: Steps #4 → #5 → #6 → #7.
   *
   * @param {object} params  - See getInitialARC() and getResidualARC() for fields.
   *   Additional fields:
   *   @param {object}  [params.strategicMitigation] - Optional: { localDensityRating?, claimAtypical? }
   *   @param {boolean} params.isVLOS                - True for VLOS/EVLOS operations
   *   @param {number}  params.finalGRC              - Final GRC from igrc.js
   * @returns {object} Full air risk assessment result
   */
  function computeAirRisk(params) {
    const {
      atypical = false, aboveFL600 = false, airportEnv = false, classBCD = false,
      above150m = false, modeSVeilOrTMZ = false, controlled = false, urban = false,
      authorityOverrideARC = null,   // [SORA v2.5 Main Body, Section 4.4.4(d)]
      strategicMitigation = null,
      isVLOS  = false,
      finalGRC,
    } = params;

    // Step #4 — Initial ARC from decision tree
    const initialARCResult = getInitialARC({ atypical, aboveFL600, airportEnv, classBCD, above150m, modeSVeilOrTMZ, controlled, urban });

    // Step #4 post-processing — Authority override (can only raise, never lower)
    const overrideResult = applyAuthorityOverride(initialARCResult.initialARC, authorityOverrideARC);

    // Step #5 — Residual ARC applied to the effective initial ARC (after override)
    const residualARCResult = getResidualARC(initialARCResult.aec, overrideResult.effectiveInitialARC, strategicMitigation);

    const tmprResult = getTMPR(residualARCResult.residualARC, isVLOS);
    const sailResult = getSAIL(finalGRC, residualARCResult.residualARC);

    return {
      // Step #4 — decision tree
      aec:            initialARCResult.aec,
      aecDescription: initialARCResult.description,
      initialARC:     initialARCResult.initialARC,
      // Step #4 — authority override
      authorityOverrideApplied: overrideResult.overrideApplied,
      authorityOverrideNote:    overrideResult.overrideNote,
      effectiveInitialARC:      overrideResult.effectiveInitialARC,
      // Step #5
      residualARC:          residualARCResult.residualARC,
      strategicMitApplied:  residualARCResult.mitigationApplied,
      strategicMitDetails:  residualARCResult.details,
      strategicMitWarning:  residualARCResult.warning,
      // Step #6
      tmpr:           tmprResult.tmpr,
      tmprRobustness: tmprResult.robustness,
      tmprRiskRatio:  tmprResult.riskRatio,
      vlosExempt:     tmprResult.vlosExempt,
      tmprNote:       tmprResult.note,
      // Step #7
      sail:           sailResult.sail,
      sailRoman:      sailResult.sailRoman,
      sailOutOfScope: sailResult.outOfScope,
      sailReason:     sailResult.reason,
    };
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------
  window.AEC_TABLE              = AEC_TABLE;
  window.SAIL_ROMAN             = SAIL_ROMAN;
  window.getInitialARC          = getInitialARC;
  window.getResidualARC         = getResidualARC;
  window.applyAuthorityOverride = applyAuthorityOverride;
  window.getTMPR                = getTMPR;
  window.getSAIL                = getSAIL;
  window.computeAirRisk         = computeAirRisk;

})();
