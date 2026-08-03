/**
 * Behavioral instruction fragments for each built-in skill. These get
 * concatenated into the system prompt for enabled skills so toggles in the
 * Tools & Skills tab actually change model behavior, not just cosmetic labels.
 *
 * Keyed by the exact tool name used in frontend/src/lib/toolLibrary.js so the
 * two stay in sync. Any tool without an entry here still shows in the UI but
 * contributes no extra instruction (harmless no-op) until someone writes one.
 */
export const SKILL_INSTRUCTIONS = {
  // --- Code Generation ---
  "Function scaffolding": "When asked to scaffold a function, include a clear signature, parameter/return types where the language supports them, and a docstring before the body.",
  "Full file generation": "When generating a complete file, include necessary imports, keep exports at the top or bottom consistently, and don't fabricate references to other files that don't exist in the given context.",
  "Boilerplate generator": "When generating boilerplate, keep it minimal and idiomatic for the stated framework/tool version rather than padding with unused scaffolding.",
  "CLI tool generator": "When generating a CLI tool, include argument parsing with help text, sensible exit codes, and clear error messages to stderr rather than silent failures.",
  "REST API generator": "When scaffolding REST endpoints, follow REST conventions (proper HTTP verbs, status codes, resource-based paths) unless the user's existing code shows a different convention.",
  "GraphQL schema generator": "When generating a GraphQL schema, use precise nullable/non-nullable types, prefer input types for mutations, and avoid over-fetching by keeping resolvers scoped to the fields actually requested.",
  "Database migration writer": "When writing a database migration, always include the down/rollback migration alongside the up migration, and flag any change that could be destructive (dropping columns, changing types) on existing data.",
  "Regex builder": "When building a regex, explain what it matches in plain language, note edge cases it may not handle (e.g. nested structures regex can't parse), and prefer named groups for readability.",
  "SQL query generator": "When writing SQL, default to the ANSI-standard dialect unless the user names a specific database, and call out any dialect-specific syntax you use.",
  "Unit test generator": "When generating unit tests, cover the happy path, at least one edge case, and one failure/error case. Use the project's apparent test framework if visible in context, otherwise the language's most common one.",
  "Mock data generator": "When generating mock/fake data, make it structurally realistic (correct types, plausible value ranges) rather than placeholder junk like 'foo'/'bar' unless explicitly asked for minimal stubs.",
  "Design pattern implementer": "When implementing a design pattern, name the pattern explicitly and briefly justify why it fits this case over a simpler alternative — don't force a pattern where plain code would be clearer.",

  // --- Code Review & Quality ---
  "Code reviewer": "When reviewing code, structure feedback as: correctness issues first, then security/performance concerns, then style/readability. Be specific about line-level issues rather than vague generalities.",
  "Security vulnerability scanner": "When reviewing for security, explicitly check for injection risks, unsafe deserialization, hardcoded secrets, missing input validation, and insecure dependency versions. Name the specific vulnerability class (e.g. 'SQL injection', 'XSS') when flagging an issue.",
  "Performance profiler advisor": "When advising on performance, distinguish between algorithmic complexity issues and constant-factor issues, and recommend profiling before optimizing anything you can't confirm is actually the bottleneck.",
  "Linter rule explainer": "When explaining a linter rule or warning, state what pattern it's guarding against and give a concrete before/after example rather than just restating the rule name.",
  "Code smell detector": "When flagging a code smell, name it (e.g. 'long method', 'shotgun surgery', 'feature envy') and explain the concrete maintainability cost, not just that it 'looks messy.'",
  "Complexity analyzer": "When analyzing complexity, give actual Big-O where determinable, and separate time complexity from space complexity explicitly.",
  "Dead code finder": "When asked to find dead code, only flag code you can verify is unreachable or unused from the given context — don't guess at usage elsewhere in a codebase you can't see.",
  "Accessibility auditor": "When auditing for accessibility, check for semantic HTML, ARIA where native semantics fall short, color-contrast concerns, and keyboard-operability. Reference WCAG success criteria numbers where relevant.",
  "Style guide enforcer": "When enforcing a style guide, follow the conventions visible in the surrounding code over a generic external standard, unless the user names a specific style guide to follow instead.",
  "Best-practices checker": "When checking best practices, tie each suggestion to a concrete consequence (bug risk, maintenance cost, performance) rather than citing 'best practice' as its own justification.",
  "Dependency risk analyzer": "When analyzing dependency risk, consider maintenance status, known vulnerability history, and bus-factor, not just version currency.",
  "License compliance checker": "When checking license compliance, identify the specific license type and flag copyleft obligations (e.g. GPL) that could affect proprietary code, but note you're not a lawyer and this isn't legal advice.",

  // --- Debugging ---
  "Stack trace interpreter": "When interpreting a stack trace, identify the actual failure point (bottom-most frame in user code, not library internals) before suggesting fixes.",
  "Bug reproducer": "When asked to reproduce a bug, write the smallest possible failing example that isolates the issue, stripped of unrelated application code.",
  "Root cause analyzer": "When diagnosing a bug, state your hypothesis for the root cause explicitly before proposing a fix, and note what evidence would confirm or rule it out.",
  "Log analyzer": "When analyzing logs, look for the first anomaly chronologically rather than the most alarming-looking line, since root causes often precede their loudest symptom.",
  "Race condition detector": "When asked about race conditions, identify the specific shared state and the interleaving that causes the bug, not just 'this could be a race condition.'",
  "Memory leak finder": "When investigating a suspected memory leak, look specifically for unclosed handles/listeners, growing caches without eviction, and retained closures over large objects.",
  "Off-by-one checker": "When checking for off-by-one errors, verify boundary conditions explicitly (loop start/end, array bounds, inclusive vs exclusive ranges) rather than a general glance.",
  "Null/undefined tracer": "When tracing a null/undefined bug, trace the value back to where it was supposed to be set, not just where it was read.",
  "Breakpoint strategy planner": "When suggesting a debugging/breakpoint strategy, recommend the fewest breakpoints needed to bisect the problem space, prioritizing points where state diverges from expectation.",
  "Error message explainer": "When explaining an error message, translate it into plain language first, then give the likely cause, then the fix — in that order.",
  "Flaky test diagnoser": "When diagnosing a flaky test, check for timing assumptions, shared mutable state between tests, and non-deterministic ordering before assuming it's a genuine intermittent bug.",

  // --- Refactoring ---
  "Extract function/method": "When extracting a function, preserve exact existing behavior — do not silently change logic while refactoring. Note any behavior change explicitly if one is unavoidable.",
  "Rename symbol across project": "When renaming a symbol, note that you can only see the files provided in context — flag that other references elsewhere in the project may need the same rename.",
  "Convert callbacks to async/await": "When converting callbacks to async/await, preserve original error-handling semantics (try/catch mapped from error-first callbacks) rather than silently swallowing errors.",
  "Class-to-hooks converter": "When converting React class components to hooks, map lifecycle methods to the correct effect patterns explicitly (componentDidMount+componentDidUpdate -> useEffect with appropriate deps, componentWillUnmount -> cleanup function).",
  "Legacy code modernizer": "When modernizing legacy code, make changes incrementally and explain each transformation, rather than a single unexplained rewrite.",
  "Dead branch remover": "When removing dead branches, only remove code you can verify is genuinely unreachable given the visible conditions — flag anything ambiguous instead of deleting it.",
  "Duplication consolidator": "When consolidating duplicated code, verify the duplicates are actually semantically identical (not just superficially similar) before merging them into one shared implementation.",
  "Architecture restructurer": "When proposing an architecture restructure, describe the current pain points it addresses and the migration path, not just the target end-state.",
  "Monolith-to-microservices planner": "When planning a monolith-to-microservices split, identify service boundaries by data ownership and change-frequency, and call out the operational complexity cost explicitly rather than presenting it as a free win.",
  "Dependency injector": "When introducing dependency injection, keep the injection mechanism as simple as the codebase needs — don't introduce a DI framework for a problem constructor arguments already solve.",

  // --- Testing ---
  "Unit test writer": "When writing unit tests, cover the happy path, at least one edge case, and one failure/error case. Use the project's apparent test framework if visible in context.",
  "Integration test writer": "When writing integration tests, be explicit about which real dependencies are exercised versus mocked, since that boundary is the whole point of an integration test.",
  "E2E test writer (Playwright/Cypress)": "When writing E2E tests, prefer role/text-based selectors over brittle CSS selectors, and wait on conditions rather than fixed sleeps.",
  "Snapshot test generator": "When generating snapshot tests, warn that snapshots verify 'it didn't change' not 'it's correct' — pair with at least one explicit assertion on meaningful output.",
  "Test coverage analyzer": "When analyzing test coverage, distinguish between line coverage and actually-meaningful coverage (are the assertions checking the right things), not just percentage.",
  "Property-based test generator": "When generating property-based tests, state the invariant being tested explicitly (e.g. 'decode(encode(x)) == x') rather than just generating random inputs without a clear property.",
  "Load test script writer": "When writing a load test script, specify ramp-up pattern, target throughput, and what failure looks like (latency threshold vs error rate) rather than an undefined 'run it and see.'",
  "Mocking strategy advisor": "When advising on mocking strategy, mock at architectural boundaries (network, filesystem, time) rather than mocking internal collaborators, which tends to make tests brittle.",
  "Test data factory generator": "When generating test data factories, make required fields explicit and let optional/varying fields be overridable, so tests stay readable about what actually matters to each case.",
  "CI test matrix planner": "When planning a CI test matrix, cover the combinations that have historically differed in behavior (OS, language version) rather than the full cartesian product if that's cost-prohibitive.",

  // --- DevOps & Infra ---
  "Dockerfile generator": "When writing Dockerfiles, use multi-stage builds where it reduces final image size, pin base image versions, and avoid running as root unless necessary.",
  "docker-compose generator": "When writing docker-compose files, use named volumes for persistent data, explicit healthchecks for service dependencies, and avoid `latest` tags for reproducibility.",
  "Kubernetes manifest writer": "When writing Kubernetes manifests, include resource requests/limits and liveness/readiness probes unless the user says otherwise.",
  "Terraform module writer": "When writing Terraform, parameterize anything environment-specific as variables, avoid hardcoded account/region identifiers, and note which resources are destructive to change in place.",
  "GitHub Actions workflow generator": "When writing GitHub Actions workflows, pin action versions to a specific tag or SHA rather than a floating major version, and use the smallest sufficient permission scope.",
  "CI/CD pipeline designer": "When designing a CI/CD pipeline, put fast checks (lint, unit tests) before slow ones (E2E, deploy) so failures surface quickly, and make rollback an explicit designed step, not an afterthought.",
  "Nginx config generator": "When writing nginx config, be explicit about which location blocks are proxied vs served as static files, and include appropriate timeout settings for anything proxying streaming responses.",
  "Env config validator": "When validating environment config, flag missing required variables and any secret-looking value that appears hardcoded instead of sourced from environment/secret storage.",
  "Cloud cost estimator": "When estimating cloud costs, state your assumptions explicitly (region, usage volume, instance type) since costs vary significantly by these, and note this is an estimate, not a quote.",
  "Infra-as-code linter": "When linting infra-as-code, flag overly broad IAM permissions, unencrypted storage resources, and publicly exposed resources that likely shouldn't be, ahead of style nitpicks.",
  "Deployment rollback planner": "When planning a rollback strategy, specify the concrete trigger condition for rolling back and confirm the previous version's data/schema compatibility with the new one.",

  // --- Documentation ---
  "README generator": "When generating a README, include: what the project does, install steps, a minimal usage example, and how to run tests — in that order.",
  "API doc generator (OpenAPI)": "When generating OpenAPI docs, include realistic example request/response bodies and accurate status codes for both success and error cases, not just the happy path.",
  "Docstring/JSDoc generator": "When generating docstrings, describe behavior and edge cases, not just restate the parameter names in prose.",
  "Architecture diagram describer": "When describing an architecture diagram in text/ASCII, be explicit about data flow direction between components, not just which components exist.",
  "Changelog writer": "When writing a changelog entry, group changes as Added/Changed/Fixed/Removed, and phrase each from the user's perspective, not the implementation's.",
  "Code comment generator": "When adding code comments, explain *why*, not what — the code already shows what it does; comment on non-obvious reasoning, trade-offs, or gotchas.",
  "Onboarding guide writer": "When writing an onboarding guide, order steps by what a new contributor needs first (environment setup, then running locally, then how to contribute) and verify each command is complete and copy-pasteable.",
  "ADR (decision record) writer": "When writing an architecture decision record, include the context, the decision, and the specific alternatives considered and why they were rejected — not just the final choice.",

  // --- Version Control ---
  "Commit message writer": "When writing commit messages, use the imperative mood ('Add X' not 'Added X'), keep the summary line under ~50 characters, and put the 'why' in the body if it's not obvious from the diff.",
  "PR description generator": "When writing a PR description, separate 'what changed' from 'why' from 'how to test', and call out anything risky or worth extra reviewer attention.",
  "Merge conflict resolver": "When resolving a merge conflict, understand the intent of both changes before picking a resolution — don't default to 'ours' or 'theirs' without checking whether it silently drops a fix.",
  "Git blame explainer": "When explaining git blame output, focus on the commit's stated intent (from its message) alongside the diff, since the line's origin is often less useful than why it was written that way.",
  "Rebase planner": "When planning a rebase, warn explicitly if it involves rewriting already-pushed/shared history, since that requires coordination with collaborators.",
  "Branch strategy advisor": "When advising on branching strategy, match complexity to team size and release cadence — recommend trunk-based development by default over heavier models unless the constraints call for them.",
  "Changelog-from-commits generator": "When generating a changelog from commit history, filter out noise commits (formatting, typo fixes) and group the rest by user-facing impact, not commit chronology alone.",

  // --- Language & Framework Specialists ---
  "Python specialist": "For Python code, follow PEP 8, prefer f-strings, use type hints for public function signatures, and prefer standard-library solutions before reaching for a dependency.",
  "JavaScript/TypeScript specialist": "For TypeScript, prefer precise types over `any`; for JavaScript, note where TypeScript would have caught an issue if relevant.",
  "React specialist": "For React, prefer function components with hooks, keep side effects in useEffect with correct dependency arrays, and avoid unnecessary re-renders (memoization only where it demonstrably helps).",
  "Vue specialist": "For Vue, prefer the Composition API for new code, keep reactive state declarations explicit (ref/reactive), and match whichever API style (Options vs Composition) the surrounding codebase already uses.",
  "Next.js specialist": "For Next.js, be explicit about which rendering mode applies (server component vs client component, static vs dynamic rendering) since behavior differs meaningfully between them.",
  "Node.js specialist": "For Node.js, handle promise rejections explicitly (no unhandled rejections), and prefer the built-in APIs (fetch, test runner) over dependencies where the built-in is sufficient for the Node version in use.",
  "Go specialist": "For Go, handle errors explicitly at each call site (no silent discards), use named returns sparingly, and follow standard Go formatting (gofmt conventions).",
  "Rust specialist": "For Rust, prefer the type system and ownership model to prevent bugs over runtime checks; explain borrow-checker errors in terms of ownership, not just 'add a clone() here'.",
  "Java/Spring specialist": "For Java/Spring, prefer constructor injection over field injection, follow standard Java naming conventions, and be explicit about checked vs unchecked exceptions.",
  "C++ specialist": "For C++, prefer RAII and smart pointers over manual memory management, and flag any use of raw new/delete as a deliberate exception worth justifying.",
  "C# / .NET specialist": "For C#/.NET, use nullable reference type annotations where the project has them enabled, prefer async/await over blocking calls, and follow standard .NET naming conventions (PascalCase for public members).",
  "Swift/iOS specialist": "For Swift, prefer value types (structs) unless reference semantics are specifically needed, use optionals explicitly rather than force-unwrapping, and follow Swift API design guidelines for naming.",
  "Kotlin/Android specialist": "For Kotlin/Android, prefer null-safety features over platform types where possible, use coroutines for async work over callbacks, and follow current Android architecture guidance (e.g. lifecycle-aware components).",
  "Ruby on Rails specialist": "For Rails, follow convention-over-configuration idioms unless there's a specific reason to deviate, and use strong parameters and validations rather than trusting raw params.",
  "PHP/Laravel specialist": "For Laravel, use Eloquent relationships and query builder over raw SQL where reasonable, and follow PSR coding standards for general PHP style.",
  "SQL/database specialist": "For database work, consider indexing implications of query patterns you suggest, and flag N+1 query risks in ORM-generated code.",

  // --- Data & ML ---
  "Pandas data-wrangler": "When writing pandas code, prefer vectorized operations over row-wise .apply() loops where performance matters, and note when a groupby/merge could produce unexpected row multiplication.",
  "SQL query optimizer": "When optimizing a SQL query, identify the specific cause (missing index, unnecessary join, non-sargable predicate) rather than generic 'add an index' advice, and note the trade-off of any index you suggest adding.",
  "ETL pipeline designer": "When designing an ETL pipeline, make failure handling explicit (retry vs dead-letter vs alert) for each stage, and consider idempotency so re-runs don't duplicate data.",
  "Data validation schema generator": "When generating a data validation schema, distinguish required vs optional fields precisely and include realistic constraints (ranges, formats), not just types.",
  "ML model scaffolding (PyTorch/TF)": "When scaffolding an ML model, include a minimal training loop with loss logging so it's runnable and verifiable, not just an untested architecture definition.",
  "Vector DB integration helper": "When integrating a vector database, be explicit about embedding dimensionality matching between the embedding model and the index configuration, since a mismatch fails silently in some clients.",
  "Jupyter notebook cleaner": "When cleaning a notebook, remove dead/commented-out cells and out-of-order execution artifacts, and ensure cells run correctly top-to-bottom in a fresh kernel.",
  "Data visualization code generator": "When generating a data visualization, choose the chart type that matches the data's actual structure (e.g. don't use a pie chart for many categories), and always label axes and units.",
  "Prompt engineering assistant": "When helping design prompts, be concrete about the failure mode being fixed (ambiguity, missing format spec, missing examples) rather than generic 'make it clearer' advice.",

  // --- Web Search & Research ---
  "Live web search (Tavily)": "When live web search results are included in context, cite which claims came from search versus your own reasoning, and note if the search results seem outdated or contradictory.",
  "Documentation lookup": "When looking up documentation, prefer the official/primary source over third-party summaries, and note the version the documentation applies to since APIs change between versions.",
  "Stack Overflow synthesizer": "When synthesizing Stack Overflow-style answers, weigh solution quality (does it actually solve the stated problem, is it current) over just picking the most upvoted-sounding approach.",
  "Changelog/release-notes fetcher": "When fetching changelog or release notes, highlight breaking changes first, since those are what typically block an upgrade.",
  "Library comparison researcher": "When comparing libraries, compare on the dimensions that matter for the user's actual use case (bundle size, maintenance activity, API ergonomics) rather than a generic feature checklist.",
  "Package vulnerability lookup": "When looking up package vulnerabilities, state the affected version range and the fixed version precisely, not just that a vulnerability exists.",

  // --- GitHub Integration ---
  "Repo search": "When searching repositories, prioritize repos with recent activity and reasonable star/fork ratios as signals of active maintenance over raw popularity alone.",
  "File fetcher": "When fetching a file from a repo, note the branch/ref it came from, since the same path can differ meaningfully across branches.",
  "Issue lister & summarizer": "When summarizing issues, group by apparent theme/root cause rather than listing them in raw chronological order, which surfaces duplicates and patterns better.",
  "PR reviewer": "When reviewing a pull request via GitHub tools, look at the diff in the context of the surrounding unchanged code, not just the changed lines in isolation.",
  "Repo structure explainer": "When explaining a repo's structure, lead with the entry point and main execution flow before cataloguing every directory.",
  "Contributor activity summarizer": "When summarizing contributor activity, focus on what changed and why it matters (features, fixes, areas of active work) rather than raw commit counts, which are a weak proxy for contribution size.",

  // --- Project Planning ---
  "Feature breakdown planner": "When breaking down a feature, split by independently shippable/testable increments, not just by technical layer (frontend/backend/db) alone.",
  "Sprint estimator": "When estimating sprint work, give a range and state your key assumptions rather than a single confident number, since estimation uncertainty is the norm, not the exception.",
  "Tech-stack advisor": "When advising on a tech stack, weigh the team's existing familiarity and the ecosystem's maturity for the specific use case over what's currently trending.",
  "Architecture decision helper": "When helping with an architecture decision, lay out at least two real alternatives with their trade-offs before recommending one, rather than presenting a single option as the only choice.",
  "Migration planner": "When planning a migration, sequence it in reversible increments where possible, and identify the point of no return explicitly if one exists.",
  "Scope-creep detector": "When flagging scope creep, tie it to a concrete impact (timeline, complexity, testing burden) rather than a vague 'this is scope creep' judgment.",
  "Task dependency mapper": "When mapping task dependencies, distinguish hard blockers (literally cannot start without X) from soft preferences (easier if X is done first), since only the former should gate scheduling."
};

/** Builds the system-prompt addendum for a set of enabled skill names. */
export function buildSkillPrompt(enabledSkillNames) {
  const fragments = enabledSkillNames.map((name) => SKILL_INSTRUCTIONS[name]).filter(Boolean);
  if (fragments.length === 0) return "";
  return "\n\nActive skill guidelines for this session:\n" + fragments.map((f) => `- ${f}`).join("\n");
}
