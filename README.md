# Pivot — Node.js + Express + MySQL (XAMPP)

## Requirements
- XAMPP with MySQL running
- Node.js LTS and npm

## 1. Create the database
1. Start **MySQL** in the XAMPP Control Panel.
2. Open `http://localhost/phpmyadmin`.
3. Choose **Import**, select `database/pivot_db.sql`, then click **Import**.
4. This creates `pivot_db` and its tables: `users`, `user_profiles`, `skills`, `user_skills`, and `learning_progress`.

## 2. Configure
1. Open this folder in Visual Studio Code.
2. Copy `.env.example` to a new file named `.env`.
3. Check DB settings. Common XAMPP defaults: host `localhost`, port `3306`, user `root`, blank password. If you set a MySQL password, put it in `DB_PASSWORD`.
4. Replace `JWT_SECRET` with a long random secret. Never share `.env`.

## 3. Install and run
In the VS Code terminal, from this project folder:

```bash
npm install
npm run dev
```

Or run `npm start`. Visit **http://localhost:3000**. Do not open `public/index.html` directly or use Live Server; Express must serve the page for `/api` requests to work.

## 4. Test
- Enter an email and a password with at least 8 characters.
- Click **Create an account**, enter your name, and the account will be stored in MySQL.
- Log out and sign in again with the same details.
- In phpMyAdmin, open `pivot_db` → `users` to see the account. Passwords are bcrypt hashes, not plain text.

## API routes
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Current signed-in user |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/profile` | Protected profile |
| GET | `/api/health` | Database health check |

## Troubleshooting
- Database connection refused: check MySQL is started and `DB_PORT`.
- Access denied: set the correct `DB_PASSWORD` in `.env`.
- Unknown database: import the SQL file.
- Port 3306 busy: use the MySQL port shown in XAMPP and update `DB_PORT`.
- Port 3000 busy: change `PORT` in `.env`.

## Notes
This is a local development starter. It uses bcrypt password hashing and an HttpOnly JWT cookie. Before public deployment, configure HTTPS, a strong unique JWT secret, rate limiting, email verification, password reset, appropriate CSRF protection, and production database credentials. Never expose XAMPP/phpMyAdmin publicly.

The login/account identity is connected to MySQL. The job-match percentages, skill gap values, and learning cards remain sample dashboard content until their own data-management features are built.
