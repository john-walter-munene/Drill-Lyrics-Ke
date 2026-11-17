const API = process.env.API_URL ?? 'http://localhost:4000';
const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@drillke.local';
const password = process.env.SEED_ADMIN_PASSWORD;

if (!password) {
  console.log('SEED_ADMIN_PASSWORD is not set in the container environment.');
  process.exit(1);
}

const res = await fetch(`${API}/api/auth/signin`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const data = await res.json().catch(() => ({}));
console.log('status:', res.status);
console.log('user  :', data.user ? `${data.user.email} (${data.user.role})` : JSON.stringify(data));
console.log('token :', data.token ? 'issued' : 'MISSING');
