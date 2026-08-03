/**
 * Server-side mirror of frontend/src/lib/toolLibrary.js. Kept as a separate
 * file (rather than importing across the frontend/backend boundary) since
 * the two projects are deployed independently. If you edit the tool list,
 * update both files together.
 */
export const TOOL_CATEGORIES_SERVER = [
  {
    name: "Code Generation",
    tools: [
      "Function scaffolding", "Full file generation", "Boilerplate generator", "CLI tool generator",
      "REST API generator", "GraphQL schema generator", "Database migration writer", "Regex builder",
      "SQL query generator", "Unit test generator", "Mock data generator", "Design pattern implementer"
    ]
  },
  {
    name: "Code Review & Quality",
    tools: [
      "Code reviewer", "Security vulnerability scanner", "Performance profiler advisor", "Linter rule explainer",
      "Code smell detector", "Complexity analyzer", "Dead code finder", "Accessibility auditor",
      "Style guide enforcer", "Best-practices checker", "Dependency risk analyzer", "License compliance checker"
    ]
  },
  {
    name: "Debugging",
    tools: [
      "Stack trace interpreter", "Bug reproducer", "Root cause analyzer", "Log analyzer",
      "Race condition detector", "Memory leak finder", "Off-by-one checker", "Null/undefined tracer",
      "Breakpoint strategy planner", "Error message explainer", "Flaky test diagnoser"
    ]
  },
  {
    name: "Refactoring",
    tools: [
      "Extract function/method", "Rename symbol across project", "Convert callbacks to async/await",
      "Class-to-hooks converter", "Legacy code modernizer", "Dead branch remover", "Duplication consolidator",
      "Architecture restructurer", "Monolith-to-microservices planner", "Dependency injector"
    ]
  },
  {
    name: "Testing",
    tools: [
      "Unit test writer", "Integration test writer", "E2E test writer (Playwright/Cypress)", "Snapshot test generator",
      "Test coverage analyzer", "Property-based test generator", "Load test script writer", "Mocking strategy advisor",
      "Test data factory generator", "CI test matrix planner"
    ]
  },
  {
    name: "DevOps & Infra",
    tools: [
      "Dockerfile generator", "docker-compose generator", "Kubernetes manifest writer", "Terraform module writer",
      "GitHub Actions workflow generator", "CI/CD pipeline designer", "Nginx config generator", "Env config validator",
      "Cloud cost estimator", "Infra-as-code linter", "Deployment rollback planner"
    ]
  },
  {
    name: "Documentation",
    tools: [
      "README generator", "API doc generator (OpenAPI)", "Docstring/JSDoc generator", "Architecture diagram describer",
      "Changelog writer", "Code comment generator", "Onboarding guide writer", "ADR (decision record) writer"
    ]
  },
  {
    name: "Version Control",
    tools: [
      "Commit message writer", "PR description generator", "Merge conflict resolver", "Git blame explainer",
      "Rebase planner", "Branch strategy advisor", "Changelog-from-commits generator"
    ]
  },
  {
    name: "Language & Framework Specialists",
    tools: [
      "Python specialist", "JavaScript/TypeScript specialist", "React specialist", "Vue specialist",
      "Next.js specialist", "Node.js specialist", "Go specialist", "Rust specialist", "Java/Spring specialist",
      "C++ specialist", "C# / .NET specialist", "Swift/iOS specialist", "Kotlin/Android specialist",
      "Ruby on Rails specialist", "PHP/Laravel specialist", "SQL/database specialist"
    ]
  },
  {
    name: "Data & ML",
    tools: [
      "Pandas data-wrangler", "SQL query optimizer", "ETL pipeline designer", "Data validation schema generator",
      "ML model scaffolding (PyTorch/TF)", "Prompt engineering assistant", "Vector DB integration helper",
      "Jupyter notebook cleaner", "Data visualization code generator"
    ]
  },
  {
    name: "Web Search & Research",
    tools: [
      "Live web search (Tavily)", "Documentation lookup", "Stack Overflow synthesizer", "Changelog/release-notes fetcher",
      "Library comparison researcher", "Package vulnerability lookup"
    ]
  },
  {
    name: "GitHub Integration",
    tools: [
      "Repo search", "File fetcher", "Issue lister & summarizer", "PR reviewer", "Repo structure explainer",
      "Contributor activity summarizer"
    ]
  },
  {
    name: "Project Planning",
    tools: [
      "Feature breakdown planner", "Sprint estimator", "Tech-stack advisor", "Architecture decision helper",
      "Migration planner", "Scope-creep detector", "Task dependency mapper"
    ]
  }
];
