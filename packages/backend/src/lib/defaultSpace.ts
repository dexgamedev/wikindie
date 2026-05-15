export interface DefaultSpaceFile {
  relativePath: string
  content: string
  frontmatter?: Record<string, unknown>
}

const defaultKanbanColumns = [
  { id: 'backlog', status: 'backlog' },
  { id: 'next', status: 'next' },
  { id: 'in-progress', status: 'in_progress' },
  { id: 'done', status: 'done' },
]

export const defaultSpaceFiles: DefaultSpaceFile[] = [
  {
    relativePath: 'Workspace/_Index.md',
    frontmatter: {
      title: 'Workspace',
      icon: 'home',
      sections: [
        { title: 'Start Here', path: '_sections/start-here.md' },
        { title: 'Operating Rhythm', path: '_sections/operating-rhythm.md' },
      ],
    },
    content: `# Workspace

Welcome to the default Wikindie workspace. This starter wiki is filled with placeholder projects, departments, and planning pages so a team can begin replacing examples with real data.

## Portfolio Snapshot

| Area | Owner | Status | Next Check-In |
| --- | --- | --- | --- |
| Project Atlas | Riley Park | Prototype | Monday standup |
| Project Beacon | Morgan Lee | Discovery | Research review |
| Project Copper | Avery Chen | Launch prep | Go-to-market sync |
| Departments | Sam Rivera | Active | Weekly ops review |

## Quick Links

- [[Workspace/Projects]] - Product and game initiatives.
- [[Workspace/Departments]] - Team responsibilities and operating notes.
- [[Workspace/Planning/Portfolio Board]] - Cross-project work board.
- [[Workspace/Planning/Decision Log]] - Lightweight decision history.

## Workspace Rules

- Replace every placeholder owner, date, and metric before using this as a source of truth.
- Keep project pages focused on goals, risks, and current decisions.
- Store recurring team knowledge under departments instead of duplicating it in project notes.
`,
  },
  {
    relativePath: 'Workspace/_sections/start-here.md',
    content: `# Start Here

Use this checklist during the first setup pass.

- Rename departments to match the actual organization.
- Replace placeholder owners with real accountable people.
- Delete projects that do not apply.
- Add links to repositories, design files, dashboards, and shared folders.
- Choose one weekly review cadence for the portfolio board.

## Editing Notes

- Pages are normal Markdown files stored on disk.
- Kanban boards use Markdown bullet lists under level-two headings.
- Page metadata, icons, and sections live in frontmatter.
`,
  },
  {
    relativePath: 'Workspace/_sections/operating-rhythm.md',
    content: `# Operating Rhythm

| Cadence | Purpose | Owner | Output |
| --- | --- | --- | --- |
| Daily async update | Surface blockers and handoffs | Team leads | Updated project boards |
| Weekly portfolio review | Confirm priorities and risks | Operations | Portfolio board changes |
| Monthly strategy review | Revisit roadmap and staffing | Leadership | Updated roadmap notes |
| Release retrospective | Capture lessons learned | Project owner | Action items in department pages |

## Meeting Defaults

- Start with blockers and decisions needed.
- End with owners, due dates, and links to updated pages.
- Archive stale notes once the decision log is updated.
`,
  },
  {
    relativePath: 'Workspace/Projects/_Index.md',
    frontmatter: { title: 'Projects', icon: 'project' },
    content: `# Projects

This section tracks active initiatives. Each project page should explain why the work matters, what is currently in scope, and where the team can find its board.

## Active Projects

| Project | Type | Stage | Target |
| --- | --- | --- | --- |
| Project Atlas | Exploration adventure | Prototype | Validate the core loop |
| Project Beacon | Community platform | Discovery | Interview ten candidate users |
| Project Copper | Commerce expansion | Launch prep | Ship a beta storefront |

## Project Page Template

Use these headings when adding a new project.

- Goal
- Current Scope
- Success Metrics
- Risks
- Links
- Next Milestone
`,
  },
  {
    relativePath: 'Workspace/Projects/Project Atlas/_Index.md',
    frontmatter: { title: 'Project Atlas', icon: 'project' },
    content: `# Project Atlas

Project Atlas is a placeholder exploration project about mapping floating islands and trading resources between settlements.

## Goal

Prove that a 15-minute exploration loop can feel satisfying with lightweight crafting, short quests, and readable map progression.

## Current Scope

| Track | Placeholder Owner | Notes |
| --- | --- | --- |
| Core loop | Riley Park | Explore, gather, craft, return |
| World map | Dev Patel | Three island biomes in prototype |
| Narrative hooks | Jules Kim | Settlement rumors and quest seeds |
| Art direction | Mina Stone | Warm sky palette and readable silhouettes |

## Success Metrics

- Prototype testers complete two loops without guidance.
- At least 70 percent of testers understand the map icons.
- First craftable upgrade is earned within eight minutes.

## Links

- [[Workspace/Projects/Project Atlas/Game Loop]]
- [[Workspace/Projects/Project Atlas/Risks]]
- [[Workspace/Projects/Project Atlas/Sprint Board]]
`,
  },
  {
    relativePath: 'Workspace/Projects/Project Atlas/Game Loop.md',
    frontmatter: { title: 'Game Loop', icon: 'mechanics' },
    content: `# Game Loop

## Placeholder Loop

1. Choose an island route from the map.
2. Explore points of interest and gather materials.
3. Resolve one small encounter or trade request.
4. Return to camp and craft an upgrade.
5. Unlock a clearer route or better tool for the next run.

## Open Questions

- How much friction should navigation create before it feels tedious?
- Are resource decisions meaningful with only three material types?
- Should upgrades change movement, inventory, or quest access first?
`,
  },
  {
    relativePath: 'Workspace/Projects/Project Atlas/Risks.md',
    frontmatter: { title: 'Risks', icon: 'warning' },
    content: `# Risks

| Risk | Impact | Mitigation | Owner |
| --- | --- | --- | --- |
| Exploration feels repetitive | High | Add route modifiers and surprise events | Riley Park |
| Island art exceeds schedule | Medium | Use blockout kit for first prototype | Mina Stone |
| Crafting economy lacks tension | Medium | Cap inventory and tune material drops | Dev Patel |

## Watch Items

- Prototype session length.
- Number of unique points of interest needed per biome.
- Amount of tutorial text required to understand trading.
`,
  },
  {
    relativePath: 'Workspace/Projects/Project Atlas/Sprint Board.md',
    frontmatter: { title: 'Atlas Sprint Board', icon: 'board', kanban: true, kanbanColumns: defaultKanbanColumns },
    content: `## :todo: Backlog
- Draft island event list
- Define resource names and icons
- Add placeholder quest giver copy
## :idea: Next Up
- Build camp return screen wireframe
- Create map marker legend
## :doing: In Progress
- Tune first exploration route timing
## :done: Done
- Agree on prototype success metrics
- Pick three starter biomes
`,
  },
  {
    relativePath: 'Workspace/Projects/Project Beacon/_Index.md',
    frontmatter: { title: 'Project Beacon', icon: 'idea' },
    content: `# Project Beacon

Project Beacon is a placeholder community platform for publishing dev updates, collecting feedback, and turning interested players into testers.

## Goal

Validate whether a lightweight community hub reduces support churn and improves playtest recruitment.

## Discovery Plan

| Activity | Placeholder Owner | Due |
| --- | --- | --- |
| Interview candidate users | Morgan Lee | Week 1 |
| Audit existing feedback channels | Priya Shah | Week 1 |
| Prototype landing page | Theo Grant | Week 2 |
| Define moderation policy | Sam Rivera | Week 2 |

## Assumptions

- Players prefer one reliable place for updates over scattered posts.
- Teams need a smaller tool than a full community suite.
- The first version can use manual approvals and simple tags.

## Links

- [[Workspace/Projects/Project Beacon/Research Notes]]
- [[Workspace/Projects/Project Beacon/Sprint Board]]
`,
  },
  {
    relativePath: 'Workspace/Projects/Project Beacon/Research Notes.md',
    frontmatter: { title: 'Research Notes', icon: 'writing' },
    content: `# Research Notes

## Placeholder Interview Segments

| Segment | Need | Evidence To Collect |
| --- | --- | --- |
| Solo developer | Centralize updates and feedback | Current publishing workflow |
| Small studio producer | Recruit testers quickly | Pain points in test scheduling |
| Community volunteer | Moderate without heavy tooling | Common abuse and spam cases |

## Questions

- Where do teams currently lose feedback?
- What would make a player volunteer for a test session?
- Which moderation controls must exist before launch?
`,
  },
  {
    relativePath: 'Workspace/Projects/Project Beacon/Sprint Board.md',
    frontmatter: { title: 'Beacon Sprint Board', icon: 'board', kanban: true, kanbanColumns: defaultKanbanColumns },
    content: `## :todo: Backlog
- Draft moderation policy outline
- Build interview script
- Sketch notification preferences
## :idea: Next Up
- Schedule five discovery calls
- Inventory current feedback channels
## :doing: In Progress
- Prototype community landing page sections
## :done: Done
- Define discovery success criteria
`,
  },
  {
    relativePath: 'Workspace/Projects/Project Copper/_Index.md',
    frontmatter: { title: 'Project Copper', icon: 'rocket' },
    content: `# Project Copper

Project Copper is a placeholder commerce expansion focused on a beta storefront, creator bundles, and launch reporting.

## Goal

Ship a small beta store that can sell digital bundles, measure conversion, and support one promotional campaign.

## Launch Checklist

| Workstream | Placeholder Owner | Status |
| --- | --- | --- |
| Storefront UX | Theo Grant | In progress |
| Payment integration | Nia Brooks | Ready |
| Bundle packaging | Omar Diaz | Backlog |
| Campaign copy | Lila Hart | In progress |
| Support macros | Sam Rivera | Ready |

## Links

- [[Workspace/Projects/Project Copper/Launch Plan]]
- [[Workspace/Projects/Project Copper/Sprint Board]]
`,
  },
  {
    relativePath: 'Workspace/Projects/Project Copper/Launch Plan.md',
    frontmatter: { title: 'Launch Plan', icon: 'calendar' },
    content: `# Launch Plan

## Placeholder Milestones

| Date | Milestone | Exit Criteria |
| --- | --- | --- |
| Week 1 | Storefront content freeze | Product cards and pricing approved |
| Week 2 | Closed beta checkout | Internal purchases succeed end to end |
| Week 3 | Creator bundle review | Assets, license text, and previews approved |
| Week 4 | Public beta | Campaign page, support macros, and reporting live |

## Rollback Plan

- Disable checkout if payment errors exceed the placeholder threshold.
- Keep bundle downloads behind manual fulfillment for the first beta week.
- Route urgent support cases to the operations lead.
`,
  },
  {
    relativePath: 'Workspace/Projects/Project Copper/Sprint Board.md',
    frontmatter: { title: 'Copper Sprint Board', icon: 'board', kanban: true, kanbanColumns: defaultKanbanColumns },
    content: `## :todo: Backlog
- Finalize beta discount rules
- Add creator bundle preview images
- Draft post-launch survey
## :idea: Next Up
- Confirm payment error messages
- Write support macro set
## :doing: In Progress
- Build storefront product card layout
## :done: Done
- Choose launch reporting metrics
- Confirm placeholder pricing tiers
`,
  },
  {
    relativePath: 'Workspace/Departments/_Index.md',
    frontmatter: { title: 'Departments', icon: 'folder' },
    content: `# Departments

Department pages describe durable responsibilities, recurring rituals, and team-owned resources. Keep project-specific details on project pages and link back here when a pattern becomes reusable.

## Department Directory

| Department | Lead | Primary Responsibility |
| --- | --- | --- |
| Engineering | Nia Brooks | Architecture, implementation, releases |
| Product Design | Theo Grant | UX, product decisions, player journeys |
| Art & Audio | Mina Stone | Visual direction, assets, sound, music |
| Marketing | Lila Hart | Campaigns, positioning, community updates |
| Operations | Sam Rivera | Process, finances, vendors, compliance |
| Support | Priya Shah | Customer response, bugs, help docs |
| People | Avery Chen | Hiring, onboarding, rituals, team health |

## Shared Department Standards

- Each department owns one page of recurring responsibilities.
- Each page should list current priorities and known service levels.
- Cross-functional work should link to the related project page.
`,
  },
  {
    relativePath: 'Workspace/Departments/Engineering.md',
    frontmatter: { title: 'Engineering', icon: 'code' },
    content: `# Engineering

## Mission

Build reliable product foundations, keep releases boring, and make technical tradeoffs visible before they become blockers.

## Placeholder Responsibilities

| Area | Owner | Notes |
| --- | --- | --- |
| Application architecture | Nia Brooks | Document major decisions in the decision log |
| Build and deployment | Omar Diaz | Keep release steps repeatable |
| Tooling | Dev Patel | Maintain scripts and developer docs |
| Security review | Riley Park | Review auth, secrets, and dependencies monthly |

## Current Priorities

- Stabilize project board API interactions.
- Reduce setup time for new contributors.
- Define release checklist for beta milestones.
`,
  },
  {
    relativePath: 'Workspace/Departments/Product Design.md',
    frontmatter: { title: 'Product Design', icon: 'mechanics' },
    content: `# Product Design

## Mission

Turn uncertain product ideas into clear flows, testable assumptions, and scoped decisions.

## Placeholder Responsibilities

| Area | Owner | Notes |
| --- | --- | --- |
| UX flows | Theo Grant | Keep latest diagrams linked from project pages |
| Research synthesis | Morgan Lee | Summarize findings within 48 hours |
| Product requirements | Avery Chen | Capture decisions and non-goals |
| Usability testing | Priya Shah | Maintain scripts and observation notes |

## Current Priorities

- Define success criteria for Project Beacon discovery.
- Simplify onboarding flows for Project Copper.
- Create test plan for Project Atlas map readability.
`,
  },
  {
    relativePath: 'Workspace/Departments/Art Audio.md',
    frontmatter: { title: 'Art & Audio', icon: 'art' },
    content: `# Art & Audio

## Mission

Create a cohesive style, readable assets, and memorable audio without overbuilding before scope is proven.

## Placeholder Responsibilities

| Area | Owner | Notes |
| --- | --- | --- |
| Visual direction | Mina Stone | Own style guides and reference boards |
| UI art | Jules Kim | Keep reusable components documented |
| Sound effects | Omar Diaz | Track naming and export conventions |
| Music direction | Lila Hart | Maintain mood references and licensing notes |

## Current Priorities

- Produce Project Atlas island blockout kit.
- Define placeholder asset quality bar for prototypes.
- Document audio export settings for handoff.
`,
  },
  {
    relativePath: 'Workspace/Departments/Marketing.md',
    frontmatter: { title: 'Marketing', icon: 'target' },
    content: `# Marketing

## Mission

Explain what the team is building, reach the right audience, and turn launches into measurable learning loops.

## Placeholder Responsibilities

| Area | Owner | Notes |
| --- | --- | --- |
| Positioning | Lila Hart | Maintain message map per project |
| Campaign calendar | Morgan Lee | Sync dates with roadmap milestones |
| Community updates | Priya Shah | Coordinate with Support on recurring questions |
| Launch analytics | Avery Chen | Define source tracking and reporting views |

## Current Priorities

- Draft Project Copper beta campaign copy.
- Create update cadence for Project Beacon discovery posts.
- Build a reusable announcement checklist.
`,
  },
  {
    relativePath: 'Workspace/Departments/Operations.md',
    frontmatter: { title: 'Operations', icon: 'tool' },
    content: `# Operations

## Mission

Keep planning, finance, vendors, and team rituals simple enough that the rest of the organization can focus on delivery.

## Placeholder Responsibilities

| Area | Owner | Notes |
| --- | --- | --- |
| Portfolio review | Sam Rivera | Prepare weekly board review |
| Vendor tracking | Avery Chen | Keep contracts and renewals summarized |
| Budget checkpoints | Nia Brooks | Compare spend against project plans |
| Compliance reminders | Riley Park | Track required policy reviews |

## Current Priorities

- Create a budget snapshot for each active project.
- Normalize meeting note format.
- Review vendor access for unused tools.
`,
  },
  {
    relativePath: 'Workspace/Departments/Support.md',
    frontmatter: { title: 'Support', icon: 'star' },
    content: `# Support

## Mission

Turn user questions, bugs, and friction into clear responses and useful product feedback.

## Placeholder Responsibilities

| Area | Owner | Notes |
| --- | --- | --- |
| Help documentation | Priya Shah | Update docs when repeated questions appear |
| Bug intake | Dev Patel | Triage issues into engineering or project boards |
| Response macros | Sam Rivera | Keep launch-specific macros ready |
| Feedback tagging | Morgan Lee | Summarize themes for product review |

## Current Priorities

- Prepare Project Copper beta support macros.
- Define severity labels for incoming bugs.
- Create a weekly feedback digest template.
`,
  },
  {
    relativePath: 'Workspace/Departments/People.md',
    frontmatter: { title: 'People', icon: 'pin' },
    content: `# People

## Mission

Make onboarding, team rituals, and hiring decisions explicit enough for a small team to grow without losing context.

## Placeholder Responsibilities

| Area | Owner | Notes |
| --- | --- | --- |
| Onboarding | Avery Chen | Keep first-week checklist current |
| Hiring plan | Sam Rivera | Connect staffing asks to roadmap needs |
| Team rituals | Lila Hart | Track retrospectives and recurring improvements |
| Skills matrix | Nia Brooks | Identify coverage gaps per project |

## Current Priorities

- Draft onboarding checklist for new collaborators.
- Identify contractor needs for Project Atlas art production.
- Record team availability assumptions for the next quarter.
`,
  },
  {
    relativePath: 'Workspace/Planning/_Index.md',
    frontmatter: { title: 'Planning', icon: 'roadmap' },
    content: `# Planning

Use this section for cross-project planning artifacts that do not belong to a single department.

## Planning Pages

- [[Workspace/Planning/Portfolio Board]] - Shared kanban board for cross-project priorities.
- [[Workspace/Planning/Roadmap]] - Placeholder quarterly milestone view.
- [[Workspace/Planning/Decision Log]] - Record decisions and why they were made.
- [[Workspace/Planning/Meeting Notes]] - Recurring meeting note template and examples.
- [[Workspace/Planning/OKRs]] - Placeholder objectives and key results.

## Review Prompts

- Which active work no longer maps to an objective?
- Which project is waiting on another department?
- Which decision should be recorded before context is lost?
`,
  },
  {
    relativePath: 'Workspace/Planning/Portfolio Board.md',
    frontmatter: { title: 'Portfolio Board', icon: 'board', kanban: true, kanbanColumns: defaultKanbanColumns },
    content: `## :todo: Backlog
- Replace placeholder project names
- Add real budget snapshot per project
- Create release checklist for every active launch
## :idea: Next Up
- Review Project Atlas prototype metrics
- Schedule Project Beacon discovery interviews
- Confirm Project Copper beta support plan
## :doing: In Progress
- Draft organization-wide operating rhythm
- Align department owners with active project needs
## :done: Done
- Create starter workspace structure
- Add placeholder departments and project boards
`,
  },
  {
    relativePath: 'Workspace/Planning/Roadmap.md',
    frontmatter: { title: 'Roadmap', icon: 'roadmap' },
    content: `# Roadmap

## Placeholder Quarterly View

| Quarter | Project Atlas | Project Beacon | Project Copper | Organization |
| --- | --- | --- | --- | --- |
| Q1 | Core loop prototype | Discovery interviews | Storefront beta | Define department owners |
| Q2 | Vertical slice | Private community alpha | Public beta launch | Improve release process |
| Q3 | Content production plan | Moderation workflows | Campaign optimization | Hiring and vendor review |
| Q4 | Demo milestone | Public pilot | Revenue review | Annual planning |

## Roadmap Rules

- Keep roadmap items outcome-oriented.
- Move uncertain ideas to project notes until they are ready for review.
- Link roadmap changes to decisions in the decision log.
`,
  },
  {
    relativePath: 'Workspace/Planning/Decision Log.md',
    frontmatter: { title: 'Decision Log', icon: 'pin' },
    content: `# Decision Log

Record durable decisions here after meetings, project reviews, or major tradeoffs.

| Date | Decision | Context | Owner |
| --- | --- | --- | --- |
| 2026-01-08 | Use one shared portfolio board | Reduce status fragmentation across teams | Sam Rivera |
| 2026-01-15 | Keep Project Atlas prototype to three biomes | Preserve time for loop validation | Riley Park |
| 2026-01-22 | Run Project Beacon discovery before building accounts | Validate demand before implementation | Morgan Lee |

## Entry Template

| Date | Decision | Context | Owner |
| --- | --- | --- | --- |
| YYYY-MM-DD | What changed? | Why now, and what alternatives were rejected? | Name |
`,
  },
  {
    relativePath: 'Workspace/Planning/Meeting Notes.md',
    frontmatter: { title: 'Meeting Notes', icon: 'calendar' },
    content: `# Meeting Notes

## Weekly Portfolio Review - Placeholder

Date: 2026-01-29

Attendees: Sam Rivera, Riley Park, Morgan Lee, Lila Hart, Nia Brooks

### Agenda

- Review active board blockers.
- Confirm next milestone per project.
- Identify department dependencies.

### Notes

- Project Atlas needs two more playtesters for route readability.
- Project Beacon research should include at least one community volunteer.
- Project Copper beta support macros are ready for review.

### Actions

- Riley to schedule Project Atlas prototype session.
- Morgan to publish Project Beacon interview script.
- Priya to review Project Copper support macro tone.
`,
  },
  {
    relativePath: 'Workspace/Planning/OKRs.md',
    frontmatter: { title: 'OKRs', icon: 'target' },
    content: `# OKRs

## Objective 1: Prove the project portfolio has clear priorities

| Key Result | Target | Current Placeholder |
| --- | --- | --- |
| Active projects with named owner | 100 percent | 3 of 3 |
| Weekly board review completed | 4 per month | 1 of 4 |
| Unowned blockers older than one week | 0 | 2 |

## Objective 2: Improve launch readiness

| Key Result | Target | Current Placeholder |
| --- | --- | --- |
| Project Copper beta checklist complete | 100 percent | 55 percent |
| Support macros reviewed before launch | 100 percent | 40 percent |
| Launch reporting dashboard drafted | 1 dashboard | 0 dashboards |

## Objective 3: Reduce repeated knowledge gaps

| Key Result | Target | Current Placeholder |
| --- | --- | --- |
| Department pages updated this month | 7 pages | 7 pages |
| Decisions logged within 48 hours | 90 percent | 60 percent |
| New collaborator setup time | Under 1 day | 2 days |
`,
  },
]
