<!--
Sync Impact Report
Version change: none -> 1.0.0 (adopted from react-svg-worldmap constitution 1.1.0)
Modified principles:
- II. Political and Geopolitical Neutrality: region alignment check and docs/map-data.md
- IV. Accessible, Lightweight React Library: optional add-on, lazy per-country data
- V. Release Integrity and Compatibility: peer range across majors, generated data check
Added sections: none
Removed sections: none
Templates requiring updates: none (this repository has no Spec Kit templates)
Follow-up TODOs: None
-->

# react-svg-worldmap-regions Constitution

This package is the optional regions (admin-1) companion of `react-svg-worldmap`. It adopts the `react-svg-worldmap` constitution, version 1.1.0, with the adjustments below; where the two differ, the stricter rule applies.

## Core Principles

### I. Open Source Stewardship

`react-svg-worldmap-regions` MUST remain usable, inspectable, and maintainable as an open-source package. Public APIs, generated package contents, documentation, examples, and release notes MUST make user-visible behavior clear enough for external contributors and downstream consumers to review without private context. Contributions MUST preserve the MIT-licensed project model and MUST not add dependencies, generated assets, or licensing terms that make the package harder to redistribute under the published license.

Rationale: This project is a public npm package. Users need transparent source, repeatable builds, and contribution paths that do not depend on maintainer-only knowledge.

### II. Political and Geopolitical Neutrality

Map data, country names, region handling, and documentation MUST avoid implying legal, diplomatic, or sovereignty endorsement. Changes that affect countries, territories, borders, names, codes, disputed areas, or recognition-sensitive cases MUST follow `react-svg-worldmap`'s `docs/map-data-policy.md`, MUST keep every region inside the country that `react-svg-worldmap` draws it in (checked by the data generator), and MUST record recognition-sensitive cases in `docs/map-data.md`. The default map MUST be described as a small-scale thematic visualization, not as an authoritative boundary reference.

Rationale: A world map component can unintentionally make political claims. Neutrality requires documented sources, reviewable overrides, and careful language whenever geopolitical content changes.

### III. Quality Gates Are Non-Negotiable

Code changes MUST pass formatting, linting, type checking, unit tests, package build, package smoke tests, website build when affected, and coverage checks before merge or release. Coverage MUST stay above 80% for lines, functions, branches, and statements; the repository MAY enforce stricter thresholds, and contributors MUST not lower them to pass a change. Warnings from package managers, builds, tests, TypeScript, linting, unsupported runtimes, deprecated dependencies, or peer dependency resolution MUST be resolved or explicitly documented with a maintainer-approved rationale.

Rationale: This package is consumed by other applications. Hidden warnings, unsupported dependencies, or untested behavior become downstream defects.

### IV. Accessible, Lightweight React Library

The package MUST stay an optional add-on: `react-svg-worldmap` MUST work the same without it, and region data MUST load only for the countries a map needs, when it needs them (one lazily loaded file per country, never in the entry chunk). The package MUST stay focused on client-side SVG thematic visualization for React. Public behavior MUST preserve accessibility responsibilities documented for the SVG output, including meaningful titles and compatibility with host page landmarks. New features MUST avoid heavyweight runtime services, hosted map API dependencies, or avoidable bundle growth unless the plan documents why the library's core use case cannot be met otherwise.

Rationale: The package's value is a simple, bundled, accessible map component that works without a map platform dependency.

### V. Release Integrity and Compatibility

Published artifacts MUST match the documented package API: ESM, CJS, TypeScript declarations, README content, and npm package contents MUST be generated and verified before release. Breaking API, peer dependency, runtime support, or map policy changes MUST use an appropriate semantic version change and include consumer-facing documentation. The peer dependency range MUST cover every supported `react-svg-worldmap` major (currently `^2.7.0 || ^3.0.0`). Generated files (`lib/README.md`, `lib/src/regions/`, `lib/src/loaders.ts`) MUST stay in sync with their sources; CI checks them.

Rationale: Consumers rely on package metadata, module formats, and docs matching the release they install.

## Project Constraints

The repository is a Yarn workspace with `lib` as the published package (`react-svg-worldmap-regions`) and `website` as its example site. Node `>=18` is the minimum supported development and package runtime baseline unless a future governance amendment changes it.

Feature plans MUST identify whether a change affects the published package, website, map data policy, release process, or generated documentation. Plans that touch map geometry or geopolitical naming MUST include a neutrality review. Plans that touch package outputs MUST include build, packaging, and smoke-test validation.

Dependencies MUST be justified by package value, maintenance status, license compatibility, bundle impact, and support window. Out-of-support or deprecated components MUST be replaced, upgraded, or documented with an explicit migration plan before release.

## Development Workflow and Review Gates

Every feature specification MUST include independently testable user scenarios and measurable success criteria. Code-bearing tasks MUST include tests unless the plan documents that the change is documentation-only, generated-only, or otherwise has no executable behavior.

Every implementation plan MUST pass a Constitution Check before design work and again before implementation. The check MUST cover open-source compatibility, geopolitical neutrality impact, quality gates, accessibility and bundle impact, and release integrity.

Every pull request or release candidate MUST run the relevant commands from the repository scripts, including `yarn build`, `yarn lint`, `yarn typecheck`, `yarn format-check`, `yarn spellcheck`, and `yarn test:coverage` when code or testable behavior changes. Region data updates MUST be verified with `yarn workspace react-svg-worldmap-regions check:detailed-data`.

## Governance

This constitution supersedes conflicting project practices, feature plans, and task templates. Amendments require a documented change to this file, a Sync Impact Report, and updates to affected Spec Kit templates or runtime guidance.

Versioning follows semantic versioning for governance:

- MAJOR: Removes or redefines a core principle or weakens a mandatory gate.
- MINOR: Adds a principle, section, required review area, or materially expands governance requirements.
- PATCH: Clarifies language without changing obligations.

Compliance review is required during specification, planning, implementation, and release validation. A change that cannot satisfy a principle MUST document the violation, rejected alternatives, mitigation plan, and maintainer approval before implementation proceeds.

**Version**: 1.0.0 | **Ratified**: 2026-11-27 | **Last Amended**: 2026-11-27
