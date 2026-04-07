// ==========================================
// SORA Orchestrator
// MissionDesk — sora.js
// ==========================================
// Single-entry-point pipeline that runs the complete SORA v2.5 risk
// assessment by co-ordinating all five compliance modules in the correct
// order.
//
// Evaluation order:
//   0. Category gate     (category.js) — Open / Specific / Certified
//   ↓ [only if Specific]
//   1. Ground risk       (igrc.js)     — Steps #2–3:  iGRC → Final GRC
//   2. Air risk + SAIL   (arc.js)      — Steps #4–7:  ARC, TMPR, SAIL
//   3. Containment       (containment.js) — Step #8:  Adjacent area
//   4. OSOs              (oso.js)      — Step #9:  Robustness requirements
//
// Abort-on-error semantics:
//   If any step produces an out-of-scope or Certified result the pipeline
//   stops immediately and returns with `completed: false` and a `blockers`
//   array explaining why.
//
// Verified against:
//   - SORA v2.5 Main Body, Sections 4.1–4.10 (process flow)
//   - EU 2019/947, Articles 3–6 (category definitions)
//
// Exposes:
//   window.runSORA(input)  — main pipeline entry point
// ==========================================

(function () {
  'use strict';

  // ── Module dependency aliases ───────────────────────────────────────────
  // These are resolved at call-time (not at parse-time) so loading order
  // within index.html does not matter as long as all modules are loaded
  // before the first runSORA() call.
  function classifyOperation(p)  { return window.classifyOperation(p); }
  function computeGroundRisk(p)  { return window.computeGroundRisk(p); }
  function computeAirRisk(p)     { return window.computeAirRisk(p); }
  function computeContainment(p) { return window.computeContainment(p); }
  function getOSOSummary(sail, opts) { return window.getOSOSummary(sail, opts); }

  // ---------------------------------------------------------------------------
  // SECTION 1 — PIPELINE STATUS HELPERS
  // ---------------------------------------------------------------------------
  const STEP_NAMES = {
    category:    'Step #0 — Category Classification',
    groundRisk:  'Steps #2–3 — Ground Risk (iGRC / Final GRC)',
    airRisk:     'Steps #4–7 — Air Risk (ARC / TMPR / SAIL)',
    containment: 'Step #8 — Containment Requirements',
    oso:         'Step #9 — Operational Safety Objectives',
  };

  function makeBlocker(step, reason) {
    return { step: STEP_NAMES[step] || step, reason };
  }

  // ---------------------------------------------------------------------------
  // SECTION 2 — MAIN ENTRY POINT
  // ---------------------------------------------------------------------------
  /**
   * runSORA(input)
   * Runs the complete SORA v2.5 pipeline from category classification
   * through OSO identification in a single call.
   *
   * @param {object} input  — See SoraInput typedef in the JSDoc comment block
   * @returns {object}      — SoraResult with per-step sub-results and getters
   */
  window.runSORA = function runSORA(input) {
    const blockers = [];

    // ── Normalise defaults ─────────────────────────────────────────────────
    const p = {
      overAssemblies:        false,
      overUninvolved:        false,
      dangerousGoods:        false,
      crashProtected:        false,
      transportsPeople:      false,
      dropsMaterial:         false,
      hasLowSpeedMode:       false,
      atypical:              false,
      aboveFL600:            false,
      airportEnv:            false,
      classBCD:              false,
      above150m:             false,
      modeSVeilOrTMZ:        false,
      controlled:            false,
      urban:                 false,
      shelteringApplicable:  false,
      controlledGround:      false,
      sparselyPopulated:     false,
      hasAirspaceObservers:  false,
      lowMannedAircraftRisk: true,
      useEAROSOs:            false,
      mitigations:           {},
      ...input,
    };

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 0 — Category classification
    // ═══════════════════════════════════════════════════════════════════════
    let categoryResult;
    try {
      categoryResult = classifyOperation(p);
    } catch (err) {
      blockers.push(makeBlocker('category', `Unexpected error: ${err.message}`));
      return _buildResult({ input: p, completed: false, blockers, step: 'category' });
    }

    // Certified → hard stop
    if (categoryResult.category === 'Certified') {
      blockers.push(makeBlocker('category',
        'Operation is in the Certified category. SORA does not apply. ' +
        (categoryResult.certifiedTriggers || []).join(' | ')
      ));
      return _buildResult({
        input: p, completed: false, blockers, step: 'category',
        categoryResult,
      });
    }

    // Open → pipeline complete after step 0 (no SORA needed)
    if (categoryResult.category === 'Open') {
      return _buildResult({
        input: p, completed: true, blockers, step: 'category',
        categoryResult,
        summary: _openSummary(categoryResult),
      });
    }

    // Specific, STS eligible → pipeline complete after step 0
    if (categoryResult.sts01Eligible || categoryResult.sts02Eligible) {
      const stsType = categoryResult.sts01Eligible ? 'STS-01' : 'STS-02';
      return _buildResult({
        input: p, completed: true, blockers, step: 'sts',
        categoryResult,
        summary: _stsSummary(categoryResult, stsType),
      });
    }

    // Specific, full SORA required → continue pipeline

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1 — Ground risk (Steps #2–3)
    // ═══════════════════════════════════════════════════════════════════════
    let groundResult;
    try {
      groundResult = computeGroundRisk({
        dimMeters:   p.dimMeters,
        speedMs:     p.speedMs,
        massGrams:   p.massGrams,
        popDensity:  p.popDensity,
        popQual:     p.popQual,
        mitigations: p.mitigations,
      });
    } catch (err) {
      blockers.push(makeBlocker('groundRisk', err.message));
      return _buildResult({ input: p, completed: false, blockers, step: 'groundRisk', categoryResult });
    }

    if (groundResult.outOfScope) {
      blockers.push(makeBlocker('groundRisk',
        `Ground risk out of SORA scope: ${groundResult.reason || 'iGRC combination not in SORA table'}`
      ));
      return _buildResult({
        input: p, completed: false, blockers, step: 'groundRisk',
        categoryResult, groundResult,
      });
    }

    if (groundResult.finalGRC > 7) {
      blockers.push(makeBlocker('groundRisk',
        `Final GRC ${groundResult.finalGRC} > 7 — operation requires Certified category. ` +
        '[SORA v2.5 Main Body, Section 4.3.4(g)]'
      ));
      return _buildResult({
        input: p, completed: false, blockers, step: 'groundRisk',
        categoryResult, groundResult,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2 — Air risk + SAIL (Steps #4–7)
    // ═══════════════════════════════════════════════════════════════════════
    let airResult;
    try {
      airResult = computeAirRisk({
        atypical:             p.atypical,
        aboveFL600:           p.aboveFL600,
        airportEnv:           p.airportEnv,
        classBCD:             p.classBCD,
        above150m:            p.above150m,
        modeSVeilOrTMZ:       p.modeSVeilOrTMZ,
        controlled:           p.controlled,
        urban:                p.urban,
        authorityOverrideARC: p.authorityOverrideARC,
        strategicMitigation:  p.strategicMitigation,
        isVLOS:               p.isVLOS,
        finalGRC:             groundResult.finalGRC,
      });
    } catch (err) {
      blockers.push(makeBlocker('airRisk', err.message));
      return _buildResult({ input: p, completed: false, blockers, step: 'airRisk', categoryResult, groundResult });
    }

    if (airResult.sailOutOfScope) {
      blockers.push(makeBlocker('airRisk',
        airResult.sailReason || 'SAIL determination out of scope.'
      ));
      return _buildResult({
        input: p, completed: false, blockers, step: 'airRisk',
        categoryResult, groundResult, airResult,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3 — Containment (Step #8)
    // ═══════════════════════════════════════════════════════════════════════
    let containmentResult;
    try {
      containmentResult = computeContainment({
        dimMeters:            p.dimMeters,
        speedMs:              p.speedMs,
        massGrams:            p.massGrams,
        shelteringApplicable: p.shelteringApplicable,
        sail:                 airResult.sail,
        adjPopDensity:        p.adjPopDensity  ?? 0,
        assemblySize:         p.assemblySize   ?? 0,
        groundRiskBufferKm:   p.groundRiskBufferKm,
      });
    } catch (err) {
      blockers.push(makeBlocker('containment', err.message));
      return _buildResult({
        input: p, completed: false, blockers, step: 'containment',
        categoryResult, groundResult, airResult,
      });
    }

    if (containmentResult.outOfScope) {
      blockers.push(makeBlocker('containment',
        containmentResult.outOfScopeGuidance ||
        'Containment assessment is out of scope for this operation.'
      ));
      return _buildResult({
        input: p, completed: false, blockers, step: 'containment',
        categoryResult, groundResult, airResult, containmentResult,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4 — OSOs (Step #9)
    // ═══════════════════════════════════════════════════════════════════════
    let osoResult;
    try {
      osoResult = getOSOSummary(airResult.sail, { useEAR: p.useEAROSOs });
    } catch (err) {
      blockers.push(makeBlocker('oso', err.message));
      return _buildResult({
        input: p, completed: false, blockers, step: 'oso',
        categoryResult, groundResult, airResult, containmentResult,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SUCCESS — all steps complete
    // ═══════════════════════════════════════════════════════════════════════
    return _buildResult({
      input: p,
      completed: true,
      blockers,
      step: 'complete',
      categoryResult,
      groundResult,
      airResult,
      containmentResult,
      osoResult,
      summary: _soraSummary({ groundResult, airResult, containmentResult, osoResult }),
    });
  };

  // ---------------------------------------------------------------------------
  // SECTION 3 — RESULT BUILDER
  // ---------------------------------------------------------------------------
  function _buildResult({
    input,
    completed,
    blockers,
    step,
    categoryResult    = null,
    groundResult      = null,
    airResult         = null,
    containmentResult = null,
    osoResult         = null,
    summary           = null,
  }) {
    return {
      // ── Top-level status ─────────────────────────────────────────────────
      completed,        // true = full pipeline ran without blockers
      lastStep: step,   // which step was last to run
      blockers,         // array of { step, reason } — empty when completed

      // ── Human-readable summary (populated on success or Open/STS paths) ─
      summary,

      // ── Per-step results (null if step was not reached) ──────────────────
      category:    categoryResult,
      groundRisk:  groundResult,
      airRisk:     airResult,
      containment: containmentResult,
      oso:         osoResult,

      // ── Quick-access getters for dashboard display ───────────────────────
      get operationCategory()  { return categoryResult?.category         ?? null; },
      get subcategory()        { return categoryResult?.subcategory      ?? null; },
      get igrc()               { return groundResult?.igrc               ?? null; },
      get finalGRC()           { return groundResult?.finalGRC           ?? null; },
      get initialARC()         { return airResult?.initialARC            ?? null; },
      get residualARC()        { return airResult?.residualARC           ?? null; },
      get sail()               { return airResult?.sail                  ?? null; },
      get sailRoman()          { return airResult?.sailRoman             ?? null; },
      get tmpr()               { return airResult?.tmpr                  ?? null; },
      get containmentRobust()  { return containmentResult?.robustness    ?? null; },
      get requiredOSOs()       { return osoResult?.requiredCount         ?? null; },
    };
  }

  // ---------------------------------------------------------------------------
  // SECTION 4 — SUMMARY BUILDERS
  // ---------------------------------------------------------------------------
  function _openSummary(cat) {
    return {
      headline:   `Operation is Open category — subcategory ${cat.subcategory}`,
      regulation: 'EU 2019/947, Article 4 and Annex Part A',
      nextStep:   cat.nextStep,
      warnings:   cat.warnings,
      notes:      cat.notes,
    };
  }

  function _stsSummary(cat, stsType) {
    return {
      headline:   `Operation is Specific category — ${stsType} declaration eligible`,
      regulation: `EU 2019/947, Article 5(5) and Annex Appendix 1 (${stsType})`,
      nextStep:   cat.nextStep,
      warnings:   cat.warnings,
      notes:      cat.notes,
    };
  }

  function _soraSummary({ groundResult, airResult, containmentResult, osoResult }) {
    return {
      headline:
        `SORA complete — SAIL ${airResult.sailRoman} | ` +
        `Final GRC ${groundResult.finalGRC} | ` +
        `Residual ARC-${airResult.residualARC.toUpperCase()} | ` +
        `Containment: ${containmentResult.robustness} | ` +
        `${osoResult.requiredCount} OSOs required`,
      regulation: 'SORA v2.5 (JARUS); EU 2019/947, Article 11',
      nextStep:
        'Compile Comprehensive Safety Portfolio (CSP) for Steps #2–9 and submit ' +
        'to the competent authority for operational authorisation. ' +
        '[SORA v2.5 Main Body, Section 4.10]',
      keyOutputs: {
        igrc:                groundResult.igrc,
        finalGRC:            groundResult.finalGRC,
        m1FloorApplied:      groundResult.m1FloorApplied,
        initialARC:          airResult.initialARC,
        effectiveInitialARC: airResult.effectiveInitialARC,
        residualARC:         airResult.residualARC,
        tmpr:                airResult.tmpr,
        tmprRobustness:      airResult.tmprRobustness,
        sail:                airResult.sail,
        sailRoman:           airResult.sailRoman,
        containment:         containmentResult.robustness,
        adjacentAreaKm:      containmentResult.adjacentAreaKm,
        osoTableSource:      osoResult.tableSource,
        totalOSOs:           osoResult.totalOSOs,
        requiredOSOs:        osoResult.requiredCount,
        byRobustness:        osoResult.byRobustness,
      },
      operationalLimits: containmentResult.operationalLimits,
      warnings: [
        ...(airResult.strategicMitWarning
            ? [airResult.strategicMitWarning] : []),
        ...(airResult.authorityOverrideNote && airResult.authorityOverrideApplied
            ? [airResult.authorityOverrideNote] : []),
        ...(groundResult.m1FloorApplied
            ? [`Ground risk column floor applied — M1 mitigation credit was capped at GRC ${groundResult.columnFloor}.`]
            : []),
      ],
    };
  }

})();
