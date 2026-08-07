# Plan: Add "Client Questions" to the Signal Reviews page

For Sennett's review — no code has been written in `ViewSignalReviewsPage.jsx` or any other trader-owned file. This is a proposal only.

## Why this page, and why not merge the data

The trader wants one place to handle everything clients need from them. `ViewSignalReviewsPage.jsx` already does this for one kind of request (AI signal endorsements). Investor questions (`stock_inquiries`) are a second, genuinely different kind of request that should live on the same page for discoverability, but the two data shapes shouldn't be merged into one table/model — they mean different things:

| | AI Signal Reviews (existing) | Client Questions (new) |
|---|---|---|
| Source table | `trader_signal` | `stock_inquiries` |
| What it is | An AI-generated Buy/Hold/Sell call the trader is asked to weigh in on | A free-form question an investor asks about a specific stock |
| Trader's response | Fixed: `agree` / `disagree` + optional note | Open-ended: free-text `response` |
| Fields | `ticker, signal, confidence_score, reasoning, verdict, note, endorsed_at` | `ticker, message, status, response, responded_at` |

Forcing these into one table or one review flow would mean either adding a fake `signal`/`confidence_score` to every investor question, or adding a fake `verdict` to every AI review — both wrong. Two sections on one page, backed by two separate fetches, keeps the data honest without duplicating the page shell.

## Proposed layout

Same page (`ViewSignalReviewsPage.jsx`), same page header. Below the existing "Awaiting Review" / "Reviewed" AI-signal tables, add a new, visually separate block:

```
Signal Reviews
├── AI Signal Reviews  (existing, unchanged)
│   ├── Awaiting Review (N)
│   └── Reviewed (N)
│
└── Client Questions  (new)
    ├── Open (N)         — status = 'open'
    └── Answered (N)     — status = 'answered'
```

Same table-based visual pattern already used for the existing two tables (`admin-table`, `admin-card`, click-a-row-to-open-a-modal), just with different columns:

**Open table**: Ticker | Question | Asked By | Actions (→ "Respond" button)
**Answered table**: Ticker | Question | Response | Responded At

## New modal, not `EndorseSignalModal`

`EndorseSignalModal.jsx` is hardcoded to the agree/disagree binary — wrong shape for a free-text response. Needs a new, small modal (e.g. `RespondToInquiryModal.jsx`) with just: the investor's question displayed, a textarea for the trader's response, and a submit button. Structurally the same pattern as `EndorseSignalModal` (overlay + card + `busy` state + toast on success), just simpler.

## Backend — already built and live-verified (this part needs no further sign-off, just noting it's ready)

- `GET /trader/stock-inquiries` — returns the trader's inquiries, joined with investor name (same join pattern as the existing `getTraderSignals`).
- `PATCH /trader/stock-inquiries/{id}` — body `{response: string}`, sets `status: 'answered'`, `responded_at`, and creates a notification for the investor (`type: 'stock_inquiry_response'`, same direct-insert pattern the price-alert notifications already use — there's no shared notification helper in this codebase, every trigger site inserts directly).
- Needs one small migration first: `stock_inquiries` currently has no column to store the trader's answer. Two new columns (`response text`, `responded_at timestamptz`) — SQL given separately for review, not yet applied.

## What Sennett would need to build

1. New `RespondToInquiryModal.jsx` (or similar name) — small, standalone.
2. In `ViewSignalReviewsPage.jsx`: a second `useEffect` fetching `GET /trader/stock-inquiries`, split into `open`/`answered` by `status`, rendered as a new "Client Questions" block below the existing content, using the new modal on row-click instead of `EndorseSignalModal`.
3. No changes needed to the existing AI-signal section — it stays exactly as-is.

Total surface area: one new small file, one new section appended to the existing page (not a restructure of what's already there).
