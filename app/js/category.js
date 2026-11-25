// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Lars Wallström

// ==========================================
// MISSIONDESK — OPERATION CATEGORY MODULE
// ==========================================
// Determines the applicable EU UAS operational category (Open / Specific /
// Certified), checks Standard Scenario (STS-01/STS-02) eligibility and checks
// the predefined risk assessments (PDRA-S01, PDRA-G01, PDRA-G02).
//
// Verified against:
//   - EU 2019/947 (UAS Operations Regulation), Articles 3–6
//   - EU 2019/947 Annex, Part A — UAS.OPEN.010–040 (Open category rules)
//   - EU 2019/947 Annex, Appendix 1 — UAS.STS-01 and UAS.STS-02
//   - EU 2019/945 (UAS Design), Article 40 (Certified category triggers)
//   - Easy Access Rules (EASA), GM1 Article 3 (category boundaries)
//   - AMC2, AMC3 and AMC4 to Article 11 of EU 2019/947 — PDRA-G01, PDRA-G02
//     and PDRA-S01, October 2026 editions — and GM1 to AMC1 Article 11,
//     Table 2 — AMC & GM Issue 1, Amendment 5 (ED Decision 2026/010/R)
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
  // SECTION 3b — PREDEFINED RISK ASSESSMENTS (PDRA), OCTOBER 2026 EDITIONS
  // Source: AMC & GM to EU 2019/947, Issue 1, Amendment 5 (ED Decision
  //         2026/010/R): GM1 to AMC1 Article 11 (Table 2), AMC2 Article 11
  //         (PDRA-G01), AMC3 Article 11 (PDRA-G02), AMC4 Article 11 (PDRA-S01).
  //
  // Amendment 5 rebuilt the PDRAs on SORA 2.5:
  //   - PDRA-S01, PDRA-G01 and PDRA-G02 have new October 2026 editions.
  //     The UA limit is now 3 m and a maximum speed of 35 m/s; the former
  //     34 kJ kinetic-energy limit (and, for S01, the 25 kg limit) is gone.
  //   - PDRA-S02 and PDRA-G03 are DELETED from Table 2. The previous AMC4 and
  //     AMC5 (Amendment 2) cease to be acceptable means of compliance from
  //     1 January 2027 [ED Decision 2026/010/R, Article 2(3)].
  //
  // A PDRA is an AMC: the limits below are the scope of the predefined
  // assessment. An operation outside them needs a full SORA
  // [AMC1 Article 11, point (d)].
  //
  // All three PDRAs share: SAIL II, low containment, adjacent ground area of
  // 6.3 km, one remote pilot per UA, no dangerous goods, UA not tethered, and
  // no outdoor assembly of more than 40 000 people within 1 km of the
  // operational volume.
  // ---------------------------------------------------------------------------

  const PDRA_EDITION = 'October 2026';

  const PDRA_DEFINITIONS = {
    'PDRA-S01': {
      amc:         'AMC4 Article 11',
      edition:     PDRA_EDITION,
      summary:     'VLOS over a controlled ground area (same type of operation as STS-01, without the C5 class mark).',
      flight:      'VLOS',
      igrc:        1,
      finalGRC:    1,
      residualARC: 'b',
      sail:        2,
      containment: 'low',
      pilot:       'STS theoretical certificate and STS-01 practical accreditation',
    },
    'PDRA-G01': {
      amc:         'AMC2 Article 11',
      edition:     PDRA_EDITION,
      summary:     'BVLOS within the detection line of sight (DLOS) of the remote pilot or an airspace observer, in uncontrolled airspace.',
      flight:      'BVLOS within DLOS',
      igrc:        3,   // 4 is accepted when M1(A) sheltering (low) brings the final GRC to 3
      finalGRC:    3,
      residualARC: 'b',
      sail:        2,
      containment: 'low',
      pilot:       'STS theoretical certificate and STS-02 practical accreditation',
    },
    'PDRA-G02': {
      amc:         'AMC3 Article 11',
      edition:     PDRA_EDITION,
      summary:     'BVLOS in an atypical air environment (airspace reserved or segregated for the UAS operation, or close to obstacles).',
      flight:      'BVLOS',
      igrc:        3,   // 4 is accepted when M1(A) sheltering (low) brings the final GRC to 3
      finalGRC:    3,
      residualARC: 'a',
      sail:        2,
      containment: 'low',
      pilot:       'STS theoretical certificate and STS-02 practical accreditation',
    },
  };

  // PDRAs removed from GM1 to AMC1 Article 11, Table 2 by Amendment 5.
  const PDRA_WITHDRAWN = {
    'PDRA-S02': 'Deleted by Amendment 5 (ED Decision 2026/010/R). The former AMC5 Article 11 ceases to be an acceptable means of compliance from 1 January 2027.',
    'PDRA-G03': 'Deleted from Table 2 of GM1 to AMC1 Article 11 by Amendment 5 (ED Decision 2026/010/R).',
  };

  /**
   * Check an operation against the scope of PDRA-S01, PDRA-G01 and PDRA-G02
   * (October 2026 editions).
   *
   * Only limits that can be evaluated from the inputs are checked. Items the
   * application cannot know (remote pilot competency, operations manual) are
   * returned in `toVerify`.
   *
   * @param {object}  p
   * @param {number}  p.dimMeters                 - Maximum characteristic dimension (m)
   * @param {number}  p.speedMs                   - Maximum speed (m/s)
   * @param {number}  [p.mtomGrams]               - MTOM in grams
   * @param {boolean} p.isVLOS
   * @param {boolean} [p.withinDLOS]              - BVLOS within DLOS of the remote pilot or an AO
   * @param {boolean} [p.controlledGround]        - Operation over a controlled ground area
   * @param {number}  [p.popDensity]              - Max population density in operational volume + ground risk buffer
   * @param {boolean} [p.shelteringApplicable]    - M1(A) low: vast majority of people sheltered
   * @param {number}  [p.adjPopDensity]           - Average population density of the adjacent ground area
   * @param {number}  [p.popBelow]                - Declared upper bound instead of a measured popDensity (e.g. 50 = "below 50")
   * @param {number}  [p.adjPopBelow]             - Declared upper bound instead of a measured adjPopDensity
   * @param {boolean} [p.adjShelteringApplicable] - Sheltering applicable in the adjacent ground area (defaults to shelteringApplicable)
   * @param {boolean} [p.largeAssemblyWithin1km]  - Outdoor assembly of more than 40 000 people within 1 km
   * @param {boolean} [p.controlled]              - Controlled airspace
   * @param {boolean} [p.atypical]                - Atypical air environment (reserved/segregated, or close to obstacles)
   * @param {boolean} [p.lowMannedAircraftRisk]   - Low encounter rate with manned aircraft
   * @param {number}  [p.maxHeightM]              - Maximum height of the contingency volume (m AGL)
   * @param {boolean} [p.dangerousGoods]
   * @returns {object} { 'PDRA-S01': { eligible, failures, toVerify, definition }, ... }
   */
  function checkPDRAEligibility(p) {
    const {
      dimMeters, speedMs, mtomGrams = null, isVLOS,
      withinDLOS = false, controlledGround = false,
      popDensity = null, shelteringApplicable = false,
      adjPopDensity = null, largeAssemblyWithin1km = false,
      controlled = false, atypical = false, lowMannedAircraftRisk = true,
      maxHeightM = null, dangerousGoods = false,
    } = p;
    const adjSheltering = p.adjShelteringApplicable === undefined ? shelteringApplicable : p.adjShelteringApplicable;
    const popBelow    = (p.popBelow    === undefined || p.popBelow    === null) ? null : p.popBelow;
    const adjPopBelow = (p.adjPopBelow === undefined || p.adjPopBelow === null) ? null : p.adjPopBelow;

    // A density is either measured (must be BELOW the limit) or declared as a band
    // "below X" (X must not exceed the limit). Returns { fail, text } or { unknown }.
    function densityCheck(measured, below, limit) {
      if (measured !== null) {
        return measured >= limit ? { fail: true, text: `${measured} people/km² is` } : { fail: false };
      }
      if (below !== null) {
        const band = below === Infinity ? 'the selected band (no upper limit) is' : `the selected band (below ${below} people/km²) is`;
        return below > limit ? { fail: true, text: band } : { fail: false };
      }
      return { unknown: true };
    }

    const out = {};
    for (const id of Object.keys(PDRA_DEFINITIONS)) {
      out[id] = { eligible: false, failures: [], toVerify: [], definition: PDRA_DEFINITIONS[id] };
    }
    const all = (msg) => Object.values(out).forEach(r => r.failures.push(msg));

    // ── Common limits ──────────────────────────────────────────────────────────
    if (dimMeters > 3) {
      all(`UA characteristic dimension ${dimMeters} m > 3 m. [AMC2/AMC3/AMC4 Article 11, point (a)(1)]`);
    }
    if (speedMs > 35) {
      all(`Maximum speed ${speedMs} m/s > 35 m/s. [AMC2/AMC3/AMC4 Article 11, point (a)(1)]`);
    }
    if (dangerousGoods) {
      all('Transport of dangerous goods is not covered by the PDRAs. [PDRA application form, box 2.5]');
    }
    if (largeAssemblyWithin1km) {
      all('An outdoor assembly of more than 40 000 people within 1 km of the operational volume is not allowed. [AMC2/AMC3 Article 11, point (a)(5)(iii) and (a)(6)(iii); AMC4 Article 11, point (a)(3)]');
    }

    // ── PDRA-S01 (AMC4 Article 11) ──────────────────────────────────────────────
    const s01 = out['PDRA-S01'];
    if (!isVLOS) {
      s01.failures.push('PDRA-S01 requires VLOS of the remote pilot. [AMC4 Article 11, point (a)(2)]');
    }
    if (!controlledGround) {
      s01.failures.push('PDRA-S01 requires a controlled ground area. [AMC4 Article 11, point (a)(3)]');
    }
    const s01Adj = densityCheck(adjPopDensity, adjPopBelow, 500);
    if (s01Adj.fail) {
      s01.failures.push(`Adjacent area average population density: ${s01Adj.text} not below 500. [AMC4 Article 11, point (a)(3)]`);
    }
    if (!atypical) {
      if (!lowMannedAircraftRisk) {
        s01.failures.push('Airspace must have a low encounter rate with manned aircraft. [AMC4 Article 11, point (a)(6)]');
      }
      if (maxHeightM !== null && maxHeightM > 150) {
        s01.failures.push(`Contingency volume height ${maxHeightM} m > 150 m AGL. [AMC4 Article 11, point (a)(6)]`);
      }
    }
    if (maxHeightM !== null && maxHeightM > 120 && maxHeightM <= 150) {
      s01.toVerify.push('Unless additional justification is provided, the flight geography should be set at no more than 120 m AGL. [AMC4 Article 11, footnote to point (a)(6)]');
    }
    if (s01Adj.unknown) {
      s01.toVerify.push('Adjacent area average population density must be below 500 people/km². [AMC4 Article 11, point (a)(3)]');
    }
    s01.toVerify.push('Remote pilot holds an STS theoretical certificate and an STS-01 practical accreditation. [AMC4 Article 11, point (a)(5)]');

    // ── Ground limits shared by PDRA-G01 and PDRA-G02 ────────────────────────────
    // MTOM ≤ 25 kg AND vast majority of people sheltered:
    //   < 50 people/km² in the operational volume and ground risk buffer;
    //   adjacent area < 5 000 people/km² (< 500 where sheltering is not
    //   applicable in the adjacent area).
    // Otherwise:
    //   < 5 people/km²; adjacent area < 500 people/km².
    // [AMC2 and AMC3 Article 11, points (a)(5) and (a)(6)]
    const lightAndSheltered = mtomGrams !== null && mtomGrams <= 25000 && shelteringApplicable;
    const popLimit = lightAndSheltered ? 50 : 5;
    const adjLimit = (lightAndSheltered && adjSheltering) ? 5000 : 500;
    const groundFailures = [];
    const groundToVerify = [];
    const basis = lightAndSheltered
      ? 'MTOM ≤ 25 kg with sheltering (M1(A) low)'
      : 'MTOM > 25 kg or sheltering not applicable';
    const gPop = densityCheck(popDensity, popBelow, popLimit);
    if (gPop.fail) {
      groundFailures.push(`Population density in the operational volume and ground risk buffer: ${gPop.text} not below ${popLimit} (${basis}). [point (a)(5)(i) / (a)(6)(i)]`);
    } else if (gPop.unknown) {
      groundToVerify.push(`Maximum population density in the operational volume and ground risk buffer must be below ${popLimit} people/km² (${basis}). [point (a)(5)(i) / (a)(6)(i)]`);
    }
    const gAdj = densityCheck(adjPopDensity, adjPopBelow, adjLimit);
    if (gAdj.fail) {
      groundFailures.push(`Adjacent area average population density: ${gAdj.text} not below ${adjLimit}. [point (a)(5)(ii) / (a)(6)(ii)]`);
    } else if (gAdj.unknown) {
      groundToVerify.push(`Adjacent area average population density must be below ${adjLimit} people/km². [point (a)(5)(ii) / (a)(6)(ii)]`);
    }
    if (mtomGrams === null) {
      groundToVerify.push('MTOM unknown — the stricter limits (5 and 500 people/km²) were applied.');
    }

    // ── PDRA-G01 (AMC2 Article 11) ──────────────────────────────────────────────
    const g01 = out['PDRA-G01'];
    if (isVLOS) {
      g01.failures.push('PDRA-G01 covers BVLOS within the detection line of sight (DLOS) of the remote pilot or an airspace observer. [AMC2 Article 11, point (a)(2)]');
    } else if (!withinDLOS) {
      g01.failures.push('BVLOS operation must stay within the detection line of sight (DLOS) of the remote pilot or an airspace observer. [AMC2 Article 11, point (a)(2)]');
    }
    if (controlled) {
      g01.failures.push('PDRA-G01 is limited to uncontrolled airspace. [AMC2 Article 11, point (a)(7)]');
    }
    if (!lowMannedAircraftRisk) {
      g01.failures.push('Airspace must have a low encounter rate with manned aircraft. [AMC2 Article 11, point (a)(7)]');
    }
    if (maxHeightM !== null && maxHeightM > 150) {
      g01.failures.push(`Contingency volume height ${maxHeightM} m > 150 m AGL. [AMC2 Article 11, point (a)(7)]`);
    }
    g01.failures.push(...groundFailures.map(m => m.replace('[point', '[AMC2 Article 11, point')));
    g01.toVerify.push(...groundToVerify.map(m => m.replace('[point', '[AMC2 Article 11, point')));
    g01.toVerify.push('Remote pilot holds an STS theoretical certificate and an STS-02 practical accreditation. [AMC2 Article 11, point (a)(4)]');

    // ── PDRA-G02 (AMC3 Article 11) ──────────────────────────────────────────────
    const g02 = out['PDRA-G02'];
    if (isVLOS) {
      g02.failures.push('PDRA-G02 covers BVLOS operations. [AMC3 Article 11, point (a)(2)]');
    }
    if (!atypical) {
      g02.failures.push('PDRA-G02 requires an atypical air environment: airspace reserved or segregated for the UAS operation, or close to an obstacle. [AMC3 Article 11, point (a)(2)]');
    }
    g02.failures.push(...groundFailures.map(m => m.replace('[point', '[AMC3 Article 11, point')));
    g02.toVerify.push(...groundToVerify.map(m => m.replace('[point', '[AMC3 Article 11, point')));
    g02.toVerify.push('Remote pilot holds an STS theoretical certificate and an STS-02 practical accreditation. [AMC3 Article 11, point (a)(4)]');

    for (const r of Object.values(out)) r.eligible = r.failures.length === 0;
    return out;
  }

  // ---------------------------------------------------------------------------
  // SECTION 4 — MAIN ENTRY POINT: classifyOperation()
  // ---------------------------------------------------------------------------
  // Evaluation order:
  //   1. Certified hard triggers (C1–C3)
  //   2. Open category criteria (general + A1/A2/A3 subcategory)
  //   3. If neither → Specific; check STS-01/STS-02 eligibility and the PDRAs
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

    // Step 3 — Specific category + STS check + PDRA check
    const stsResult  = checkSTSEligibility(params);
    const pdraResult = checkPDRAEligibility(params);
    const pdraEligible = Object.keys(pdraResult).filter(id => pdraResult[id].eligible);
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
    } else if (pdraEligible.length > 0) {
      nextStep =
        `Operation is Specific category — within the scope of ${pdraEligible.join(' / ')} ` +
        `(${PDRA_EDITION} edition), subject to the items listed under "to verify". An operational ` +
        'authorisation is still required, but the application may be based on the PDRA application ' +
        'form and compliance matrix instead of a full SORA safety case. ' +
        '[EU 2019/947, Art. 12; AMC1 Article 11 and AMC2–AMC4 Article 11, Amendment 5]';
    } else {
      nextStep =
        'Operation is Specific category — does not qualify for STS-01 or STS-02 and is outside ' +
        'the scope of PDRA-S01, PDRA-G01 and PDRA-G02. ' +
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
      pdra:              pdraResult,
      pdraEligible,
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
  window.checkPDRAEligibility   = checkPDRAEligibility;
  window.PDRA_DEFINITIONS       = PDRA_DEFINITIONS;
  window.PDRA_WITHDRAWN         = PDRA_WITHDRAWN;
  window.classifyOperation      = classifyOperation;

})();
