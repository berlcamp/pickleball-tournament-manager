# Pickleball Tournament Management System - Claude Code Master Prompt

## Overview

Build a production-ready Pickleball Tournament SaaS using Next.js 16, Supabase and Shadcn UI inspired by Challonge, with tournament collaboration, round robin groups, finals brackets, smart scheduling and public viewing.

## Tech Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- Shadcn UI
- Supabase (PostgreSQL, Auth, Storage, RLS)
- React Hook Form + Zod
- Tanstack Query
- Zustand or Redux Toolkit
- Framer Motion

## Authentication

- Google OAuth only
- Profile management
- Sign out

## Tournament Collaboration

Roles:

- Owner
- Admin
- Scorekeeper
- Viewer

Owners can invite Google email accounts to collaborate on tournaments.

## Tournament

Fields:

- id
- name
- description
- location
- start_date
- banner
- status: draft, group_stage, final_stage, completed
- final_bracket_type: crossover, standard_seed
- created_by
- created_at

## Participants

- Add individual participant/team
- Bulk import (one team per line)

## Seeding

- Manual drag and drop
- Random seeding with animated 3-second shuffle

## Group Generation

- User chooses number of groups
- Snake seeding algorithm
- Auto group assignment

## Group Stage

- Round Robin generation
- Score input
- Auto standings
- Progress tracking

## Final Stage

Types:

1. Crossover Bracket
2. Standard Seed

Auto generate after group completion.

## Championship

Automatically determine:

- Champion
- 1st Runner Up
- 2nd Runner Up
- 3rd Place

## Smart Tournament Scheduling Engine

### Schedule Inputs

- Tournament date
- Start time
- Target end time (same day)
- Match interval (5,10,15,20,30 mins)
- Number of courts

Example:

- Date: July 10, 2026
- Start: 8:00 AM
- End: 5:00 PM
- Interval: 15 mins
- Courts: 4

### Scheduling Modes

1. Sequential by Group

- Finish Group A matches first
- Then Group B and so on

2. Equally Distributed (Recommended)

- Spread matches across all groups evenly
- Minimize player waiting time

### Conflict Detection

Prevent assigning consecutive matches to the same team.
Allow configurable rest period.
Default: 30 minutes.

### Schedule Table

Columns:

- Time
- Court
- Match
- Group
- Status

Search:

- Team
- Group
- Court

Filter:

- Morning
- Afternoon
- Group
- Court

## Public Schedule Portal

Public URLs:

- /tournament/[slug]/schedule
- /tournament/[slug]/teams/[id]

Players can view:

- Upcoming matches
- Court assignments
- Team schedules
- Results
- Standings

## Live Monitor Page

Route:

- /monitor

Display:

- Now Playing
- Upcoming Matches
- Court assignments
- Auto refresh
- Fullscreen TV mode

## QR Code Sharing

Generate QR codes for:

- Tournament schedule
- Team schedule
- Live brackets
- Results

## Database Tables

- profiles
- tournaments
- tournament_members
- tournament_invites
- participants
- groups
- group_members
- group_matches
- group_match_scores
- standings
- final_matches
- match_scores
- placements
- courts
- match_schedules
- audit_logs

## Dashboard Pages

- /dashboard
- /dashboard/tournaments
- /dashboard/tournaments/new
- /dashboard/tournaments/[id]
- /dashboard/tournaments/[id]/participants
- /dashboard/tournaments/[id]/seeding
- /dashboard/tournaments/[id]/groups
- /dashboard/tournaments/[id]/group-stage
- /dashboard/tournaments/[id]/schedule
- /dashboard/tournaments/[id]/finals
- /dashboard/tournaments/[id]/results
- /dashboard/settings

## UI Requirements

- Dark mode
- Glassmorphism cards
- Animated brackets
- Animated progress bars
- Responsive mobile design
- Skeleton loaders
- Toast notifications

## Architecture

app/
components/
hooks/
actions/
lib/
stores/
services/
types/
validators/

## SaaS Vision

Support:

- Hundreds of tournaments
- Thousands of players
- Public shareable brackets
- Live score updates
- Spectator mode
- Future mobile app

## Online Standings

Standings are publicly viewable online and update automatically after every score submission.

### Public URLs

- /tournament/[slug]/standings
- /tournament/[slug]/teams/[id]

No login required.

### Standings Table Design

Columns:

- Rank
- Status (Advanced / Qualified / Eliminated / Champion / Runner Up)
- Team
- Match W-L-T
- TB (Tie Break)
- Set Wins
- Set Ties
- Pts (Total Points)
- Match History

Example:

| Rank | Status   | Team                  | Match W-L-T |  TB | Set Wins | Set Ties | Pts | Match History |
| ---- | -------- | --------------------- | ----------- | --: | -------: | -------: | --: | ------------- |
| 1    | Advanced | Cesar / Honey         | 4-0-0       |   0 |        4 |        0 |  44 | W W W W       |
| 2    | Advanced | Hizen / Tonix         | 3-1-0       |   0 |        3 |        0 |  42 | W L W W       |
| 3    | -        | Tauloy Anghag / Juday | 2-2-0       |   0 |        2 |        0 |  32 | L W L W       |
| 4    | -        | Riezalday / Alyza     | 1-3-0       |   0 |        1 |        0 |  23 | W L L L       |
| 5    | -        | Teddy / Sabel         | 0-4-0       |   0 |        0 |        0 |   2 | L L L L       |

### Match History

- W = Win badge
- L = Loss badge
- Clickable to open match details.

### Tie Breaker Rules

1. Most Match Wins
2. Head-to-Head Result (for two-team ties)
3. Total Points (for three or more tied teams)
4. Point Differential
5. Random Draw (configurable fallback)

### Live Standings

- Updates instantly after score submission.
- Powered by Supabase Realtime.
- No page refresh required.

### Group Tabs

- Group A
- Group B
- Group C
- Group D
  (and more as needed)
