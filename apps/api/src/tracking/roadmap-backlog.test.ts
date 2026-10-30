import { describe, expect, it } from 'vitest';
import { expandFeatureIds, featureCatalog, parseRoadmap, planBacklog } from './roadmap-backlog.js';

const roadmap = `# 7. Roadmap

Offen aus Phase 2: Favoriten für Boards; Kürzel abschalten.

## Phase 3: Wiki (6 Wochen) → ◆ MVP

| Inhalt | Feature-IDs |
| --- | --- |
| Druckansicht | W-EXP-04 |

## Phase 4: Konfigurierbarkeit (6–8 Wochen)

**Ziel:** Alles pro Projekt anpassbar.

| Inhalt | Feature-IDs |
| --- | --- |
| **Grafischer Workflow-Editor**, Bedingungen | T-WF-02, -04 bis -05 |
| Lasttests, Handbuch |  |

**Fertig, wenn:** Ein Admin richtet ein Projekt ohne Code ein.

## Phase 6: Betrieb (6 Wochen) → ◆ v1.0

| Inhalt | Feature-IDs |
| --- | --- |
| \`tl\`-CLI | D-CLI-01 |

## Phase 7: Ausbau (laufend, P3)

- Service-Desk-Modul

## Risiken

- Kein Teil des Backlogs
`;

const features = `| ID | Feature | Prio |
| --- | --- | --- |
| T-WF-02 | **Grafischer Editor** | P2 |
| T-WF-04 | Bedingungen | P2 |
| T-WF-05 | Validatoren \\| Post-Funktionen | P2 |`;

describe('roadmap backlog', () => {
  it('expand feature ID lists with ranges', () => {
    expect(expandFeatureIds('T-WF-02, -04 bis -06, -08')).toEqual([
      'T-WF-02',
      'T-WF-04',
      'T-WF-05',
      'T-WF-06',
      'T-WF-08',
    ]);
    expect(expandFeatureIds('T-QRY-07, P-NTF-04, -05')).toEqual([
      'T-QRY-07',
      'P-NTF-04',
      'P-NTF-05',
    ]);
    expect(expandFeatureIds('T-RPT-04 bis -06, D-MCP-02')).toEqual([
      'T-RPT-04',
      'T-RPT-05',
      'T-RPT-06',
      'D-MCP-02',
    ]);
    expect(expandFeatureIds('')).toEqual([]);
  });

  it('read phases, rows, bullets and leftovers', () => {
    const parsed = parseRoadmap(roadmap);
    expect(parsed.leftovers).toEqual(['Favoriten für Boards', 'Kürzel abschalten']);
    expect(parsed.phases.map((phase) => [phase.number, phase.title, phase.milestone])).toEqual([
      [3, 'Wiki', 'MVP'],
      [4, 'Konfigurierbarkeit', null],
      [6, 'Betrieb', 'v1.0'],
      [7, 'Ausbau', null],
    ]);
    expect(parsed.phases[1]?.rows).toEqual([
      { content: '**Grafischer Workflow-Editor**, Bedingungen', ids: 'T-WF-02, -04 bis -05' },
      { content: 'Lasttests, Handbuch', ids: '' },
    ]);
    expect(parsed.phases[3]?.rows).toEqual([{ content: 'Service-Desk-Modul', ids: '' }]);
  });

  it('plan epics and stories for the open phases with features and versions', () => {
    const epics = planBacklog(parseRoadmap(roadmap), featureCatalog([features]), {
      fromPhase: 4,
      version: '1.0',
    });
    expect(epics.map((epic) => [epic.summary, epic.fixVersion, epic.stories.length])).toEqual([
      ['Reste aus Phase 1–3', '1.0', 2],
      ['Phase 4: Konfigurierbarkeit', '1.0', 2],
      ['Phase 6: Betrieb', '1.0', 1],
      ['Phase 7: Ausbau', null, 1],
    ]);
    expect(epics[1]?.description).toBe(
      '**Ziel:** Alles pro Projekt anpassbar.\n\n**Fertig, wenn:** Ein Admin richtet ein Projekt ohne Code ein.',
    );
    const story = epics[1]?.stories[0];
    expect(story?.summary).toBe('Grafischer Workflow-Editor, Bedingungen');
    expect(story?.description).toBe(
      [
        'Aus der Roadmap, Phase 4 (Konfigurierbarkeit). **Grafischer Workflow-Editor**, Bedingungen',
        '| ID | Feature | Prio |\n| --- | --- | --- |\n| T-WF-02 | **Grafischer Editor** | P2 |\n| T-WF-04 | Bedingungen | P2 |\n| T-WF-05 | Validatoren \\| Post-Funktionen | P2 |',
      ].join('\n\n'),
    );
    expect(epics[2]?.stories[0]?.summary).toBe('tl-CLI');
    expect(epics[2]?.stories[0]?.description).toContain(
      '| D-CLI-01 | (nicht in den Feature-Listen) |  |',
    );
  });
});
