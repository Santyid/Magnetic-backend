# /seed - Run Database Seeds

Run seed scripts to populate the database with test data.

## Instructions

Accept an optional argument: `demo`, `custom`, or `all` (default: `demo`).

### Options:
- `demo` (default): Run `npm run seed:demo` - Creates admin + demo users with products
- `custom`: Run `npm run seed:custom` - Creates user1-4 with varying product counts
- `all`: Run both demo and custom seeds

### Users created:

**Demo seed:**
| Email | Password | Role | Products |
|-------|----------|------|----------|
| admin@magnetic.com | Admin123! | Admin | 0 |
| demo@magnetic.com | Demo123! | Normal | 4 |

**Custom seed:**
| Email | Password | Products |
|-------|----------|----------|
| user1@magnetic.com | User123! | 0 |
| user2@magnetic.com | User123! | 1 (SocialGest) |
| user3@magnetic.com | User123! | 2 (SocialGest, Tikket) |
| user4@magnetic.com | User123! | 3 (SocialGest, Tikket, Advocates) |

Seeds are idempotent - they skip if data already exists.
