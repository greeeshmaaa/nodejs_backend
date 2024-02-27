const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const app = express();
const port = 3000;

// Middleware to parse JSON requests
app.use(bodyParser.json());

// MySQL connection setup
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '182002',
  database: 'EmpowerHer',
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL database');
    // Create the users table if not exists
    createUsersTable();
  }
});

// Function to create the users table in MySQL
function createUsersTable() {
  const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL
    );
  `;

  db.query(createUsersTableQuery, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
    } else {
      console.log('Users table created or already exists');
    }
  });
}

// API endpoint for user registration (signup)
app.post('/api/signup', async (req, res) => {
  try {
    const { name, phone_number, email, password } = req.body;

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the user into the database
    const insertUserQuery = 'INSERT INTO users (name, phone_number, email, password) VALUES (?, ?, ?, ?)';
    db.query(insertUserQuery, [name, phone_number, email, hashedPassword], (err) => {
      if (err) {
        console.error('Error inserting user:', err);
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        res.json({ message: 'User registered successfully' });
      }
    });
  } catch (error) {
    console.error('Unexpected error during user registration:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API endpoint for user login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Fetch user from the database based on email
    const selectUserQuery = 'SELECT * FROM users WHERE email = ?';
    db.query(selectUserQuery, [email], async (err, results) => {
      if (err) {
        console.error('Error retrieving user:', err);
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        // Check if user exists
        if (results.length === 0) {
          res.status(401).json({ error: 'User not found' });
        } else {
          const user = results[0];
          // Compare passwords
          const passwordMatch = await bcrypt.compare(password, user.password);
          if (passwordMatch) {
            res.json({ message: 'Login successful' });
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

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});