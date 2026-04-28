# Gym Dashboard

This project is a gym management dashboard built with React + Vite.

## Recent Changes

- Add Member now allows **package OR add-on** selection (add-on-only members are valid).
- Submit button and validation logic align with add-on-only flow.
- Add-on-only members now auto-generate a bill so fees show in Billing.
- Billing > Fees header supports add-on-only members (shows add-on names, duration, and price).
- Billing > Add Fee loads add-ons even when a member has no package.

## Notes

- Fees are driven by the `bills` table. If a member only has add-ons, a bill is created on add.
