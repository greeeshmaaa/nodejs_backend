const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const app = express();
const port = 3000;

app.use(bodyParser.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '182002',
  database: 'EmpowerHer',
});

const sessionStore = new MySQLStore({
  host: 'localhost',
  port: 4000,
  user: 'root',
  password: '182002',
  database: 'EmpowerHer',
});

app.use(
  session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    store: sessionStore,
  })
);

app.post('/api/signup', async (req, res) => {
  try {
    const { name, phone_number, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertUserQuery = 'INSERT INTO users (name, phone_number, email, password) VALUES (?, ?, ?, ?)';
    db.query(insertUserQuery, [name, phone_number, email, hashedPassword], (err) => {
      if (err) {
        console.error('Error inserting user:', err);
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        req.session.userName = name; // Set the session variable for the user's name
        res.json({ message: 'User registered successfully', sessionToken: req.sessionID });
      }
    });
  } catch (error) {
    console.error('Unexpected error during user registration:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const selectUserQuery = 'SELECT * FROM users WHERE email = ?';
    db.query(selectUserQuery, [email], async (err, results) => {
      if (err) {
        console.error('Error retrieving user:', err);
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        if (results.length === 0) {
          res.status(401).json({ error: 'User not found' });
        } else {
          const user = results[0];
          const passwordMatch = await bcrypt.compare(password, user.password);
          if (passwordMatch) {
            req.session.userName = user.name; // Set the session variable for the user's name
            res.json({ message: 'Login successful', sessionToken: req.sessionID, userName: user.name });
          } else {
            res.status(401).json({ error: 'Invalid credentials' });
          }
        }
      }
    });
  } catch (error) {
    console.error('Unexpected error during login:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
