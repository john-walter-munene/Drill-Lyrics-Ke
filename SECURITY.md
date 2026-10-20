# Security

## Reporting a vulnerability

Please **do not** open a public issue for a security problem. Email the
maintainers privately with:

- what you found and where (route, file, or request),
- steps to reproduce,
- the impact you believe it has.

We will acknowledge, investigate, and credit you if you would like.

## Scope notes

- Authentication and role checks are enforced server-side. Client-side hiding
  is never treated as access control.
- Lyrics submissions are validated with the shared parser on the server; the
  client never decides what is valid.
- Never commit `.env` files or real secrets. Production refuses to boot with a
  weak or default `JWT_SECRET`.
- Report abusive content through the in-app report path; for rights-holder
  takedowns see `/legal/rights`.
