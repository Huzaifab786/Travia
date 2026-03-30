# Travia Monorepo Instructions

## Project structure
- TraviaApp = Expo React Native mobile app
- TraviaBackend = Node.js + Express + Prisma backend
- travia-admin = Next.js admin panel

## Working rules
- For admin tasks, work primarily in `travia-admin`
- If admin needs real data or new capabilities, update `TraviaBackend`
- Do not modify `TraviaApp` unless the requested feature explicitly requires mobile changes
- If a mobile change seems necessary, explain why before making it

## Architecture
- Admin panel must consume real backend APIs
- Do not use fake dashboard data
- Do not duplicate backend business logic in the admin frontend
- Prefer adding proper backend endpoints over frontend hacks

## Expectations
- Analyze existing Prisma schema, routes, controllers, and services first
- Reuse existing auth, ride, booking, and user logic where possible
- Keep changes incremental and safe
- Do not break existing mobile behavior

## Initial admin goals
- admin login
- dashboard stats
- users management
- rides management
- bookings management