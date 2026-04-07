// ==========================================
// MISSIONDESK — OPERATION CATEGORY MODULE
// ==========================================
// Determines the applicable EU UAS operational category (Open / Specific /
// Certified) and checks Standard Scenario (STS-01/STS-02) eligibility.
//
// Verified against:
//   - EU 2019/947 (UAS Operations Regulation), Articles 3–6
//   - EU 2019/947 Annex, Part A — UAS.OPEN.010–040 (Open category rules)
//   - EU 2019/947 Annex, Appendix 1 — UAS.STS-01 and UAS.STS-02
//   - EU 2019/945 (UAS Design), Article 40 (Certified category triggers)
//   - Easy Access Rules (EASA), GM1 Article 3 (category boundaries)
//
// Public API exposed on window.*.
// ---------------------------------------------------------------------------

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // SECTION 1 — CERTIFIED CATEGORY GATE
  // Source: EU 2019/947, Article 6(1)–(2); EU 2019/945, Article 40(1)(a)–(d)
  //
  // Hard triggers that mandate Certified category regardless of other factors:
  //   C1: UA ≥ 3 m AND operated over assemblies of people [Article 40(1)(a)]
  //   C2: Transport of people [Article 6(1)(b)(ii)]
  //   C3: Dangerous goods without crash-protected container [Article 6(1)(b)(iii)]
  //
  // Trigger C4 (competent authority determination from risk assessment) is a
  // process outcome and cannot be evaluated here pre-flight.
  // ---------------------------------------------------------------------------

  /**
   * Evaluate Certified category hard triggers.
   * @param {object}  p
   * @param {number}  p.dimMeters
   * @param {boolean} [p.overAssemblies]
   * @param {boolean} [p.transportsPeople]
   * @param {boolean} [p.dangerousGoods]
   * @param {boolean} [p.crashProtected]
   * @returns {{ certified: boolean, triggers: string[] }}
   */
  function checkCertifiedTriggers(p) {
    const triggers = [];

    // C1: Large UA over assemblies of people [EU 2019/945, Article 40(1)(a)]
    if (p.dimMeters >= 3 && p.overAssemblies) {
      triggers.push(
        `C1: UA characteristic dimension ${p.dimMeters} m ≥ 3 m AND operation over assemblies of people → Certified required. ` +
        `[EU 2019/945, Art. 40(1)(a); EU 2019/947, GM1 Art. 6(b)]`
      );
    }

    // C2: Transport of people [EU 2019/947, Article 6(1)(b)(ii)]
    if (p.transportsPeople) {
      triggers.push(
        `C2: Operation involves transport of people → Certified required. [EU 2019/947, Art. 6(1)(b)(ii)]`
      );
    }

    // C3: Dangerous goods without crash-protected container [EU 2019/947, Art. 6(1)(b)(iii)]
    if (p.dangerousGoods && !p.crashProtected) {
      triggers.push(
        `C3: Dangerous goods carried without crash-protected container → high risk for third parties → Certified required. ` +
        `[EU 2019/947, Art. 6(1)(b)(iii); AMC1 Art. 5]`
      );
    }

    return { certified: triggers.length > 0, triggers };
  }

  // ---------------------------------------------------------------------------
  // SECTION 2 — OPEN CATEGORY GATE
  // Source: EU 2019/947, Article 4; Annex Part A, UAS.OPEN.010–040
  //
  // General Open criteria (all must pass):
  //   O1: MTOM < 25 kg  [Article 4(1)(a)]
  //   O2: Max height ≤ 120 m AGL  [UAS.OPEN.010(2)]
  //   O3: VLOS  [Article 4(1)(d)]
  //   O4: No dangerous goods  [Article 4(1)(b)]
  //   O5: No material dropped  [Article 4(1)(c)]
  //
  // If all pass, subcategory A1 / A2 / A3 is determined.
  // ---------------------------------------------------------------------------

  /**
   * Check general Open criteria and determine subcategory.
   * @returns {{ isOpen, subcategory, failedCriteria, warnings, notes }}
   */
  function checkOpenCriteria(p) {
    const {
      mtomGrams, maxHeightM, isVLOS,
      dangerousGoods = false, dropsMaterial = false,
      uasClass, overAssemblies = false, overUninvolved = false,
      minDistPersonsM = null, hasLowSpeedMode = false, distFromUrbanM = null,
    } = p;

    const failedCriteria = [];
    const warnings       = [];
    const notes          = [];

    // O1: MTOM < 25 kg
    if (mtomGrams >= 25000) {
      failedCriteria.push(
        `O1: MTOM ${(mtomGrams / 1000).toFixed(1)} kg ≥ 25 kg — Open category not permitted. [EU 2019/947, Art. 4(1)(a)]`
      );
    }
    // O2: Height ≤ 120 m AGL
    if (maxHeightM > 120) {
      failedCriteria.push(
        `O2: Max height ${maxHeightM} m > 120 m AGL — Open category not permitted ` +
        `(unless within 50 m of obstacle > 105 m per UAS.OPEN.010(3)). [Annex, UAS.OPEN.010(2)]`
      );
    }
    // O3: VLOS
    if (!isVLOS) {
      failedCriteria.push(
        `O3: Operation is BVLOS/EVLOS — Open category requires VLOS. [EU 2019/947, Art. 4(1)(d)]`
      );
    }
    // O4: No dangerous goods
    if (dangerousGoods) {
      failedCriteria.push(
        `O4: UA carries dangerous goods — Open category not permitted. [EU 2019/947, Art. 4(1)(b)]`
      );
    }
    // O5: No material dropped
    if (dropsMaterial) {
      failedCriteria.push(
        `O5: UA drops material — Open category not permitted. [EU 2019/947, Art. 4(1)(c)]`
      );
    }

    if (failedCriteria.length > 0) {
      return { isOpen: false, subcategory: null, failedCriteria, warnings, notes };
    }

    // ── Subcategory determination (A1 → A2 → A3) ─────────────────────────────
    // A1: C0, C1, or private < 250 g; must not overfly assemblies [UAS.OPEN.020]
    const isA1Class = ['C0', 'C1'].includes(uasClass) || (uasClass === 'private' && mtomGrams < 250);
    if (isA1Class && !overAssemblies) {
      if (uasClass === 'C1' && overUninvolved) {
        warnings.push(
          'A1/C1: Remote pilot must reasonably expect no uninvolved person will be overflown. [UAS.OPEN.020(1)]'
        );
      }
      notes.push('Subcategory A1 applicable. [EU 2019/947 Annex, UAS.OPEN.020]');
      return { isOpen: true, subcategory: 'A1', failedCriteria: [], warnings, notes };
    }

    // A2: C2 (also C0/C1/private<250g); must not overfly uninvolved persons;
    //     min 30 m distance (5 m with active low-speed mode) [UAS.OPEN.030]
    const isA2Class = ['C2', 'C0', 'C1'].includes(uasClass) || (uasClass === 'private' && mtomGrams < 250);
    if (isA2Class && !overAssemblies && !overUninvolved) {
      if (minDistPersonsM !== null) {
        const minAllowed = hasLowSpeedMode ? 5 : 30;
        if (minDistPersonsM < minAllowed) {
          // Fall through to A3
        } else {
          notes.push(`Subcategory A2 applicable (dist. ${minDistPersonsM} m ≥ ${minAllowed} m). [EU 2019/947 Annex, UAS.OPEN.030]`);
          return { isOpen: true, subcategory: 'A2', failedCriteria: [], warnings, notes };
        }
      } else {
        warnings.push('A2: Verify minimum 30 m horizontal distance from uninvolved persons. [UAS.OPEN.030(1)]');
        notes.push('Subcategory A2 applicable. [EU 2019/947 Annex, UAS.OPEN.030]');
        return { isOpen: true, subcategory: 'A2', failedCriteria: [], warnings, notes };
      }
    }

    // A3: C3, C4, private < 25 kg (and lower classes); must not overfly uninvolved;
    //     ≥ 150 m from residential/commercial/industrial/recreational areas [UAS.OPEN.040]
    const isA3Class = ['C3', 'C4', 'C0', 'C1', 'C2'].includes(uasClass) ||
                      (uasClass === 'private' && mtomGrams < 25000);
    if (isA3Class && !overAssemblies) {
      if (distFromUrbanM !== null && distFromUrbanM < 150) {
        // Fall through — A3 fails
      } else {
        if (distFromUrbanM === null) {
          warnings.push('A3: Verify operation is ≥ 150 m from residential/commercial/industrial/recreational areas. [UAS.OPEN.040(3)]');
        }
        if (overUninvolved) {
          warnings.push('A3: Operation must be in an area where no uninvolved persons are present. [UAS.OPEN.040(1)]');
        }
        notes.push('Subcategory A3 applicable. [EU 2019/947 Annex, UAS.OPEN.040]');
        return { isOpen: true, subcategory: 'A3', failedCriteria: [], warnings, notes };
      }
    }

    // No subcategory matched → Specific
    failedCriteria.push(
      'No Open subcategory (A1/A2/A3) applies — operation must be conducted in the Specific category. [EU 2019/947, GM1 Art. 3(a)]'
    );
    return { isOpen: false, subcategory: null, failedCriteria, warnings, notes };
  }

  // ---------------------------------------------------------------------------
  // SECTION 3 — STANDARD SCENARIO (STS) CHECK
  // Source: EU 2019/947 Annex, Appendix 1 — UAS.STS-01 and UAS.STS-02
  //
  // STS-01: VLOS, C5 class (≤3 m, ≤25 kg), controlled ground area,
  //         ≤120 m AGL, low risk of manned aircraft encounter.
  //
  // STS-02: BVLOS permitted, C6 class (≤3 m, ≤25 kg), controlled ground area
  //         ENTIRELY in sparsely populated area, ≤120 m AGL, ≤2 km with AO / ≤1 km without.
  // ---------------------------------------------------------------------------

  /**
   * Check STS-01 and STS-02 eligibility for a Specific category operation.
   * @returns {{ sts01Eligible, sts02Eligible, sts01Failures, sts02Failures }}
   */
  function checkSTSEligibility(p) {
    const {
      uasClass, dimMeters, mtomGrams, isVLOS, controlledGround = false,
      sparselyPopulated = false, maxHeightM, dangerousGoods = false,
      hasAirspaceObservers = false, rangeFromPilotM = null,
      lowMannedAircraftRisk = true,
    } = p;

    const sts01Failures = [];
    const sts02Failures = [];

    // ── Common checks ─────────────────────────────────────────────────────────
    if (dimMeters > 3) {
      const m = `UA dimension ${dimMeters} m > 3 m (C5/C6 class requires ≤ 3 m). [Table 1, EU 2019/947 Annex Appendix 1]`;
      sts01Failures.push(m); sts02Failures.push(m);
    }
    if (mtomGrams > 25000) {
      const m = `MTOM ${(mtomGrams / 1000).toFixed(1)} kg > 25 kg (C5/C6 class requires ≤ 25 kg). [Table 1]`;
      sts01Failures.push(m); sts02Failures.push(m);
    }
    if (maxHeightM > 120) {
      const m = `Max height ${maxHeightM} m > 120 m AGL. [UAS.STS-01.010(1) / UAS.STS-02.010(1)]`;
      sts01Failures.push(m); sts02Failures.push(m);
    }
    if (dangerousGoods) {
      const m = 'Dangerous goods are not permitted under any Standard Scenario. [UAS.STS-01.010(4)]';
      sts01Failures.push(m); sts02Failures.push(m);
    }
    if (!controlledGround) {
      const m = 'A controlled ground area is required for both STS-01 and STS-02. [UAS.STS-01.020(1)(c)]';
      sts01Failures.push(m); sts02Failures.push(m);
    }
    if (!lowMannedAircraftRisk) {
      const m = 'Airspace must have low risk of encounter with manned aircraft. [Table 1]';
      sts01Failures.push(m); sts02Failures.push(m);
    }

    // ── STS-01 specific ────────────────────────────────────────────────────────
    if (uasClass !== 'C5') {
      sts01Failures.push(`STS-01 requires C5 class UA (found: ${uasClass}). [UAS.STS-01.010, Table 1]`);
    }
    if (!isVLOS) {
      sts01Failures.push('STS-01 requires VLOS at all times. [UAS.STS-01.020(1)(a)]');
    }

    // ── STS-02 specific ────────────────────────────────────────────────────────
    if (uasClass !== 'C6') {
      sts02Failures.push(`STS-02 requires C6 class UA (found: ${uasClass}). [UAS.STS-02.010, Table 1]`);
    }
    if (!sparselyPopulated) {
      sts02Failures.push('STS-02 requires the controlled ground area to be ENTIRELY in a sparsely populated area. [UAS.STS-02, Table 1]');
    }
    if (rangeFromPilotM !== null) {
      const maxRange = hasAirspaceObservers ? 2000 : 1000;
      if (rangeFromPilotM > maxRange) {
        sts02Failures.push(
          `STS-02 range ${rangeFromPilotM} m > ${maxRange} m limit ` +
          `(${hasAirspaceObservers ? '2 km with AO' : '1 km without AO'}). [Table 1]`
        );
      }
    }

    return {
      sts01Eligible: sts01Failures.length === 0,
      sts02Eligible: sts02Failures.length === 0,
      sts01Failures,
      sts02Failures,
    };
  }

  // ---------------------------------------------------------------------------
  // SECTION 4 — MAIN ENTRY POINT: classifyOperation()
  // ---------------------------------------------------------------------------
  // Evaluation order:
  //   1. Certified hard triggers (C1–C3)
  //   2. Open category criteria (general + A1/A2/A3 subcategory)
  //   3. If neither → Specific; check STS-01/STS-02 eligibility
  // ---------------------------------------------------------------------------

  /**
   * Complete category classification pipeline.
   * @param {object} params - Combined inputs from all three functions above
   * @returns {{
   *   category, subcategory, sts01Eligible, sts02Eligible,
   *   sts01Failures, sts02Failures, certifiedTriggers,
   *   openFailures, warnings, notes, nextStep
   * }}
   */
  function classifyOperation(params) {

    // Step 1 — Certified gate
    const certResult = checkCertifiedTriggers(params);
    if (certResult.certified) {
      return {
        category:          'Certified',
        subcategory:       null,
        sts01Eligible:     null,
        sts02Eligible:     null,
        sts01Failures:     [],
        sts02Failures:     [],
        certifiedTriggers: certResult.triggers,
        openFailures:      [],
        warnings:          [],
        notes:             [],
        nextStep:
          'Operation requires Certified category. UAS airworthiness certification, operator ' +
          'certification, and (where applicable) remote pilot licensing are required. ' +
          'SORA does not apply. [EU 2019/947, Art. 6; EU 2019/945, Art. 40]',
      };
    }

    // Step 2 — Open gate
    const openResult = checkOpenCriteria(params);
    if (openResult.isOpen) {
      return {
        category:          'Open',
        subcategory:       openResult.subcategory,
        sts01Eligible:     null,
        sts02Eligible:     null,
        sts01Failures:     [],
        sts02Failures:     [],
        certifiedTriggers: [],
        openFailures:      [],
        warnings:          openResult.warnings,
        notes:             openResult.notes,
        nextStep:
          `Operation is Open category, subcategory ${openResult.subcategory}. ` +
          `No operational authorisation required — comply with Open category rules. ` +
          `[EU 2019/947, Art. 4 and Annex Part A]`,
      };
    }

    // Step 3 — Specific category + STS check
    const stsResult = checkSTSEligibility(params);
    let nextStep;
    if (stsResult.sts01Eligible) {
      nextStep =
        'Operation qualifies for STS-01 declaration. No full SORA authorisation required — ' +
        'submit declaration to competent authority of Member State of registration. ' +
        '[EU 2019/947, Art. 5(5); Annex Appendix 1, UAS.STS-01]';
    } else if (stsResult.sts02Eligible) {
      nextStep =
        'Operation qualifies for STS-02 declaration. No full SORA authorisation required — ' +
        'submit declaration to competent authority of Member State of registration. ' +
        '[EU 2019/947, Art. 5(5); Annex Appendix 1, UAS.STS-02]';
    } else {
      nextStep =
        'Operation is Specific category — does not qualify for STS-01 or STS-02. ' +
        'A full SORA risk assessment and operational authorisation from the competent ' +
        'authority are required. [EU 2019/947, Art. 5(1)–(4) and Art. 11]';
    }

    return {
      category:          'Specific',
      subcategory:       null,
      sts01Eligible:     stsResult.sts01Eligible,
      sts02Eligible:     stsResult.sts02Eligible,
      sts01Failures:     stsResult.sts01Failures,
      sts02Failures:     stsResult.sts02Failures,
      certifiedTriggers: [],
      openFailures:      openResult.failedCriteria,
      warnings:          openResult.warnings,
      notes:             openResult.notes,
      nextStep,
    };
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------
  window.checkCertifiedTriggers = checkCertifiedTriggers;
  window.checkOpenCriteria      = checkOpenCriteria;
  window.checkSTSEligibility    = checkSTSEligibility;
  window.classifyOperation      = classifyOperation;

})();
