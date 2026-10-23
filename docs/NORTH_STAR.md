# North Star

Status: Current
Owner: Krish Raja
Last verified: 2026-10-18

> By March 2027, more of Legibility's revenue comes from agents paying per call in USDC on mainnet than from human sign-ups, and a hundred production agents depend on it every week.

Set by Krish on 18 October 2026. It is not reached yet. It is what every session in this repository works toward.

Its weekly measure stays the trusted-reads North Star metric in [`docs/KILL-CRITERIA.md`](KILL-CRITERIA.md).

## The number

**Production agents making trusted reads this week**: 1,000 by 29 March 2027, on a front-loaded weekly ladder. Checkpoints: 16 Nov 2026: 9; 14 Dec 2026: 32; 11 Jan 2027: 95; 8 Feb 2027: 242; 29 Mar 2027: 1,000.

```yaml north-star-metric
metric: "Production agents making trusted reads this week"
unit: count
direction: up
target: 1000
deadline: 2027-03-29
ladder_shape: front-loaded
source: "Supabase legibility: usage_events by API key, trusted reads only, excluding Krish's own keys"
status: active
ladder:
  - [2026-10-26, 1]
  - [2026-11-02, 3]
  - [2026-11-09, 6]
  - [2026-11-16, 9]
  - [2026-11-23, 12]
  - [2026-11-30, 17]
  - [2026-12-07, 24]
  - [2026-12-14, 32]
  - [2026-12-21, 43]
  - [2026-12-28, 57]
  - [2027-01-04, 74]
  - [2027-01-11, 95]
  - [2027-01-18, 122]
  - [2027-01-25, 154]
  - [2027-02-01, 194]
  - [2027-02-08, 242]
  - [2027-02-15, 301]
  - [2027-02-22, 372]
  - [2027-03-01, 457]
  - [2027-03-08, 559]
  - [2027-03-15, 681]
  - [2027-03-22, 827]
  - [2027-03-29, 1000]
```

Urgency (U1 to U5) is worked out every week from where the number stands against that week's target, by [the harness contract](https://github.com/krishanraja/ai-harness/blob/main/contract/north-star-metric.md). Set by Krish on 23 October 2026.

## How to use it

- Read it before any work, every session.
- Before you start, say which part of it the task moves. If the task moves nothing toward it, say so first and let Krish decide.
- Prefer the work that moves it furthest, and close each session by noting what moved.
- Only Krish changes this file. Record his ruling in the commit body as `Ruling (Krish, YYYY-MM-DD): ...`.
- When it is reached, say so and ask Krish for the next one.
