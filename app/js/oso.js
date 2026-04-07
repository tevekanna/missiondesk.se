// ==========================================
// MISSIONDESK — OSO MODULE (Step #9)
// ==========================================
// SORA v2.5 Step #9: Identification of Operational Safety Objectives (OSOs).
//
// Verified against:
//   - SORA v2.5 Main Body, Section 4.9, Table 14 (pp. 54–55)  ← PRIMARY SOURCE
//   - Easy Access Rules (EU 2019/947), Section 2.5.2, Table 6 (pp. 62–63)
//
// ─── IMPORTANT: TWO VERSIONS OF THE OSO TABLE EXIST ────────────────────────
//
// SORA v2.5 Main Body (JARUS, Table 14) contains 17 OSOs:
//   #01–09, #13, #16–20, #23–24
//
// Easy Access Rules (EASA, Table 6) contains 24 OSOs:
//   #01–24  (adds #10, #11, #12, #14, #15, #21, #22)
//
// The 7 additional OSOs in EAR Table 6 that are NOT in Main Body Table 14:
//   OSO#10 – Safe recovery from a technical issue
//   OSO#11 – Procedures for deterioration of external systems
//   OSO#12 – UAS designed to manage deterioration of external systems
//   OSO#14 – Operational procedures (human error group)
//   OSO#15 – Remote crew trained re: human error
//   OSO#21 – Operational procedures (adverse conditions group)
//   OSO#22 – Remote crew trained to identify critical environmental conditions
//
// `getOSOsForSAIL()` uses Main Body Table 14 by default.
// Pass `{ useEAR: true }` to use the fuller EAR Table 6 instead.
//
// Robustness codes:
//   'NR' = Not Required (but applicant encouraged to consider at low integrity)
//   'L'  = Low robustness recommended
//   'M'  = Medium robustness recommended
//   'H'  = High robustness recommended
//
// Public API exposed on window.*.
// ---------------------------------------------------------------------------

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // SECTION 1 — OSO DEFINITIONS: SORA v2.5 MAIN BODY TABLE 14
  // Source: SORA v2.5 Main Body, Table 14 (pp. 54–55)
  //
  // sail: [SAIL_I, SAIL_II, SAIL_III, SAIL_IV, SAIL_V, SAIL_VI]  (index 0–5)
  // ---------------------------------------------------------------------------

  const OSO_DEFINITIONS_MAIN_BODY = [

    // ── Technical issue with the UAS ─────────────────────────────────────────

    {
      id:          1,
      title:       'Ensure the Operator is competent and/or proven',
      group:       'Technical issue with the UAS',
      sail:        ['NR', 'L',  'M',  'H',  'H',  'H'],
      responsible: ['operator'],
      annex_e_ref: [],
      source:      'both',
    },
    {
      id:          2,
      title:       'UAS manufactured by competent and/or proven entity',
      group:       'Technical issue with the UAS',
      sail:        ['NR', 'NR', 'L',  'M',  'H',  'H'],
      responsible: ['designer'],
      annex_e_ref: [],
      source:      'both',
    },
    {
      id:          3,
      title:       'UAS maintained by competent and/or proven entity',
      group:       'Technical issue with the UAS',
      sail:        ['L',  'L',  'M',  'M',  'H',  'H'],
      responsible: ['operator'],
      annex_e_ref: ['Crit.1 (operator)', 'Crit.2 (operator)', 'Crit.1 (designer)'],
      source:      'both',
    },
    {
      id:          4,
      title:       'UAS components essential to safe operations are designed to an Airworthiness Design Standard (ADS)',
      group:       'Technical issue with the UAS',
      sail:        ['NR', 'NR', 'NR', 'L',  'M',  'H'],
      responsible: ['designer'],
      annex_e_ref: [],
      source:      'both',
      note:        'Competent authority may accept that recognised standards are not met for experimental flights investigating new technical solutions.',
    },
    {
      id:          5,
      title:       'UAS is designed considering system safety and reliability',
      group:       'Technical issue with the UAS',
      sail:        ['NR', 'NR', 'L',  'M',  'H',  'H'],
      responsible: ['designer'],
      annex_e_ref: [],
      source:      'both',
      note:        'SAIL II shows NR(c) in Table 14: for novel/complex UAS with limited operational experience intending to operate at SAIL II, see SORA Main Body Section 4.9.4(c) for additional guidance.',
    },
    {
      id:          6,
      title:       'C3 link characteristics are appropriate for the operation',
      group:       'Technical issue with the UAS',
      sail:        ['NR', 'L',  'L',  'M',  'H',  'H'],
      responsible: ['operator', 'designer'],
      annex_e_ref: [],
      source:      'both',
    },
    {
      id:          7,
      title:       'Conformity check of the UAS configuration',
      group:       'Technical issue with the UAS',
      sail:        ['L',  'L',  'M',  'M',  'H',  'H'],
      responsible: ['operator'],
      annex_e_ref: ['Crit.1 (operator)', 'Crit.2 (operator)', 'Crit.1 (designer)'],
      source:      'both',
    },
    {
      id:          8,
      title:       'Operational procedures are defined, validated and adhered to',
      group:       'Technical issue with the UAS',
      sail:        ['L',  'M',  'H',  'H',  'H',  'H'],
      responsible: ['operator'],
      annex_e_ref: ['Crit.1 (operator)'],
      source:      'both',
    },
    {
      id:          9,
      title:       'Remote crew trained and current',
      group:       'Technical issue with the UAS',
      sail:        ['L',  'L',  'M',  'M',  'H',  'H'],
      responsible: ['operator', 'training_org'],
      annex_e_ref: [],
      source:      'both',
    },

    // ── Deterioration of external systems ────────────────────────────────────

    {
      id:          13,
      title:       'External services supporting UAS operations are adequate to the operation',
      group:       'Deterioration of external systems supporting UAS operations',
      sail:        ['L',  'L',  'M',  'H',  'H',  'H'],
      responsible: ['operator'],
      annex_e_ref: [],
      source:      'both',
    },

    // ── Human error ──────────────────────────────────────────────────────────

    {
      id:          16,
      title:       'Multi crew coordination',
      group:       'Human error',
      sail:        ['L',  'L',  'M',  'M',  'H',  'H'],
      responsible: ['operator'],
      annex_e_ref: ['Crit.1 (operator)', 'Crit.3 (operator)', 'Crit.2 (designer)'],
      source:      'both',
    },
    {
      id:          17,
      title:       'Remote crew is fit to operate',
      group:       'Human error',
      sail:        ['L',  'L',  'M',  'M',  'H',  'H'],
      responsible: ['operator'],
      annex_e_ref: [],
      source:      'both',
    },
    {
      id:          18,
      title:       'Automatic protection of the flight envelope from human errors',
      group:       'Human error',
      sail:        ['NR', 'NR', 'L',  'M',  'H',  'H'],
      responsible: ['designer'],
      annex_e_ref: [],
      source:      'both',
    },
    {
      id:          19,
      title:       'Safe recovery from human error',
      group:       'Human error',
      sail:        ['NR', 'NR', 'L',  'M',  'M',  'H'],
      responsible: ['designer'],
      annex_e_ref: [],
      source:      'both',
    },
    {
      id:          20,
      title:       'A Human Factors evaluation has been performed and the HMI found appropriate for the mission',
      group:       'Human error',
      sail:        ['NR', 'L',  'L',  'M',  'M',  'H'],
      responsible: ['operator', 'designer'],
      annex_e_ref: [],
      source:      'both',
    },

    // ── Adverse operating conditions ─────────────────────────────────────────

    {
      id:          23,
      title:       'Environmental conditions for safe operations defined, measurable and adhered to',
      group:       'Adverse operating conditions',
      sail:        ['L',  'L',  'M',  'M',  'H',  'H'],
      responsible: ['operator', 'training_org'],
      annex_e_ref: [],
      source:      'both',
    },
    {
      id:          24,
      title:       'UAS designed and qualified for adverse environmental conditions',
      group:       'Adverse operating conditions',
      sail:        ['NR', 'NR', 'M',  'H',  'H',  'H'],
      responsible: ['designer'],
      annex_e_ref: [],
      source:      'both',
    },
  ];

  // ---------------------------------------------------------------------------
  // SECTION 2 — ADDITIONAL OSOs IN EAR TABLE 6 (NOT IN MAIN BODY TABLE 14)
  // Source: Easy Access Rules (EU 2019/947), Table 6 (pp. 62–63)
  //
  // These 7 OSOs exist in EAR Table 6 but are absent from Main Body Table 14.
  // Their absence from the Main Body is deliberate — JARUS chose a more compact
  // set. Included here so MissionDesk can present the fuller EAR view if the
  // competent authority requests it.
  // ---------------------------------------------------------------------------

  const OSO_DEFINITIONS_EAR_ONLY = [
    {
      id:          10,
      title:       'Safe recovery from a technical issue',
      group:       'Technical issue with the UAS',
      sail:        ['L',  'L',  'M',  'M',  'H',  'H'],
      responsible: ['operator'],
      annex_e_ref: [],
      source:      'ear',
    },
    {
      id:          11,
      title:       'Procedures are in place to handle the deterioration of external systems supporting UAS operations',
      group:       'Deterioration of external systems supporting UAS operations',
      sail:        ['L',  'M',  'H',  'H',  'H',  'H'],
      responsible: ['operator'],
      annex_e_ref: [],
      source:      'ear',
    },
    {
      id:          12,
      title:       'The UAS is designed to manage the deterioration of external systems supporting UAS operations',
      group:       'Deterioration of external systems supporting UAS operations',
      sail:        ['L',  'L',  'M',  'M',  'H',  'H'],
      responsible: ['designer'],
      annex_e_ref: [],
      source:      'ear',
    },
    {
      id:          14,
      title:       'Operational procedures are defined, validated and adhered to (human error group)',
      group:       'Human error',
      sail:        ['L',  'M',  'H',  'H',  'H',  'H'],
      responsible: ['operator'],
      annex_e_ref: [],
      source:      'ear',
      note:        'Thematically similar to OSO#08 but listed separately in EAR Table 6 under the Human Error threat group.',
    },
    {
      id:          15,
      title:       'Remote crew trained and current and able to control the abnormal situation (human error group)',
      group:       'Human error',
      sail:        ['L',  'L',  'M',  'M',  'H',  'H'],
      responsible: ['operator'],
      annex_e_ref: [],
      source:      'ear',
      note:        'Thematically similar to OSO#09 but listed separately in EAR Table 6 under the Human Error threat group.',
    },
    {
      id:          21,
      title:       'Operational procedures are defined, validated and adhered to (adverse conditions group)',
      group:       'Adverse operating conditions',
      sail:        ['L',  'M',  'H',  'H',  'H',  'H'],
      responsible: ['operator'],
      annex_e_ref: [],
      source:      'ear',
      note:        'Listed in EAR Table 6 under the Adverse Operating Conditions threat group.',
    },
    {
      id:          22,
      title:       'The remote crew is trained to identify critical environmental conditions and to avoid them',
      group:       'Adverse operating conditions',
      sail:        ['L',  'L',  'M',  'M',  'M',  'H'],
      responsible: ['operator'],
      annex_e_ref: [],
      source:      'ear',
    },
  ];

  // ---------------------------------------------------------------------------
  // SECTION 3 — COMBINED AND SORTED OSO LIST
  // ---------------------------------------------------------------------------

  const ALL_OSO_DEFINITIONS = [
    ...OSO_DEFINITIONS_MAIN_BODY,
    ...OSO_DEFINITIONS_EAR_ONLY,
  ].sort((a, b) => a.id - b.id);

  // ---------------------------------------------------------------------------
  // SECTION 4 — CORE LOOKUP FUNCTION
  // ---------------------------------------------------------------------------

  /**
   * Returns the full OSO list with the applicable robustness level for a
   * given SAIL, annotated with compliance status.
   *
   * @param {number}  sail             - SAIL integer 1–6
   * @param {object}  [options]
   * @param {boolean} [options.useEAR] - Use EAR Table 6 instead of Main Body Table 14
   * @returns {Array}
   */
  function getOSOsForSAIL(sail, { useEAR = false } = {}) {
    if (sail < 1 || sail > 6) {
      throw new Error('Invalid SAIL: ' + sail + '. Must be an integer 1–6.');
    }
    const sailIndex  = sail - 1;
    const definitions = useEAR ? ALL_OSO_DEFINITIONS : OSO_DEFINITIONS_MAIN_BODY;
    return definitions.map(oso => ({
      id:          oso.id,
      title:       oso.title,
      group:       oso.group,
      robustness:  oso.sail[sailIndex],
      responsible: oso.responsible,
      annex_e_ref: oso.annex_e_ref,
      source:      oso.source,
      note:        oso.note,
      required:    oso.sail[sailIndex] !== 'NR',
    }));
  }

  // ---------------------------------------------------------------------------
  // SECTION 5 — FILTERED VIEWS
  // ---------------------------------------------------------------------------

  /**
   * Returns only OSOs that are required (robustness ≠ 'NR') for the given SAIL.
   */
  function getRequiredOSOs(sail, options = {}) {
    return getOSOsForSAIL(sail, options).filter(oso => oso.required);
  }

  /**
   * Returns OSOs for a given SAIL grouped by threat category.
   */
  function getOSOsByGroup(sail, { useEAR = false, requiredOnly = false } = {}) {
    const all      = getOSOsForSAIL(sail, { useEAR });
    const filtered = requiredOnly ? all.filter(o => o.required) : all;
    return filtered.reduce((groups, oso) => {
      if (!groups[oso.group]) groups[oso.group] = [];
      groups[oso.group].push(oso);
      return groups;
    }, {});
  }

  /**
   * Returns OSOs for a given SAIL grouped by responsible organisation.
   */
  function getOSOsByResponsible(sail, options = {}) {
    const all    = getOSOsForSAIL(sail, options);
    const result = { operator: [], designer: [], training_org: [] };
    for (const oso of all) {
      for (const r of oso.responsible) {
        if (result[r]) result[r].push(oso);
      }
    }
    return result;
  }

  /**
   * Returns headline counts and the full list for a given SAIL.
   */
  function getOSOSummary(sail, { useEAR = false } = {}) {
    const osos         = getOSOsForSAIL(sail, { useEAR });
    const byRobustness = { NR: 0, L: 0, M: 0, H: 0 };
    for (const oso of osos) {
      byRobustness[oso.robustness] = (byRobustness[oso.robustness] || 0) + 1;
    }
    return {
      sail,
      totalOSOs:     osos.length,
      requiredCount: osos.filter(o => o.required).length,
      nrCount:       byRobustness['NR'],
      byRobustness,
      tableSource:   useEAR
        ? 'Easy Access Rules (EU 2019/947), Table 6 — 24 OSOs'
        : 'SORA v2.5 Main Body, Table 14 — 17 OSOs',
      osos,
    };
  }

  // ---------------------------------------------------------------------------
  // SECTION 6 — ROBUSTNESS ORDERING HELPERS
  // ---------------------------------------------------------------------------

  const ROBUSTNESS_ORDER = { NR: 0, L: 1, M: 2, H: 3 };

  /**
   * Returns true if `actual` meets or exceeds `required` robustness.
   */
  function robustnessAtLeast(actual, required) {
    return (ROBUSTNESS_ORDER[actual] ?? -1) >= (ROBUSTNESS_ORDER[required] ?? -1);
  }

  /**
   * Returns a human-readable label for a robustness code.
   */
  function robustnessLabel(code) {
    const labels = { NR: 'Not Required', L: 'Low', M: 'Medium', H: 'High' };
    return labels[code] ?? code;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------
  window.OSO_DEFINITIONS_MAIN_BODY = OSO_DEFINITIONS_MAIN_BODY;
  window.OSO_DEFINITIONS_EAR_ONLY  = OSO_DEFINITIONS_EAR_ONLY;
  window.ALL_OSO_DEFINITIONS       = ALL_OSO_DEFINITIONS;
  window.getOSOsForSAIL            = getOSOsForSAIL;
  window.getRequiredOSOs           = getRequiredOSOs;
  window.getOSOsByGroup            = getOSOsByGroup;
  window.getOSOsByResponsible      = getOSOsByResponsible;
  window.getOSOSummary             = getOSOSummary;
  window.robustnessAtLeast         = robustnessAtLeast;
  window.robustnessLabel           = robustnessLabel;

})();
