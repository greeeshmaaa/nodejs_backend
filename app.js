const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const app = express();
const port = 3000;

app.use(bodyParser.json());

// MySQL connection configuration
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '182002',
  database: 'EmpowerHer',
});

// Connect to the database
db.connect(err => {
  if (err) throw err;
  console.log("Connected to the database.");
});

// Session store configuration
const sessionStore = new MySQLStore({}, db);

// Session middleware configuration
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 * 24 }
}));

app.use((req, res, next) => {
  console.log('Session ID:', req.sessionID);
  console.log('Session Data:', req.session);
  next();
});



// User signup endpoint
app.post('/api/signup', async (req, res) => {
  try {
    const { name, phone_number, email, password } = req.body;

    // Basic validation (You might want to use a library like express-validator for more comprehensive validation)
    if (!name || !phone_number || !email || !password) {
      return res.status(400).json({ error: 'Please provide all required fields: name, phone_number, email, and password.' });
    }

    // Password strength check (This is a very basic check. Consider using libraries like zxcvbn for a thorough check)
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertUserQuery = 'INSERT INTO users (name, phone_number, email, password) VALUES (?, ?, ?, ?)';
    
    db.query(insertUserQuery, [name, phone_number, email, hashedPassword], (err) => {
      if (err) {
        console.error('Error inserting user:', err);
        if (err.code === 'ER_DUP_ENTRY') {
          // Handling duplicate email entry
          return res.status(409).json({ error: 'This email is already registered.' });
        }
        return res.status(500).json({ error: 'Internal Server Error' });
      } else {
        // Assuming you want to log the user in immediately after signup, hence setting userName in the session
        req.session.userName = name;
        // Optionally, consider setting other user-related session information here

        // Respond with success message
        // Note: If you're not using session IDs for tracking logged-in state, you might not need to send the sessionToken back
        res.json({ message: 'User registered successfully', sessionToken: req.sessionID });
      }
    });
  } catch (error) {
    console.error('Unexpected error during user registration:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});




// User login endpoint
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
            req.session.userID = user.id; // Set the session variable for the user's ID

            req.session.save(err => {
              if(err) {
                console.error('Session save error:', err);
              } else {
                // Debugging: Print the session object
                console.log(req.session);
              }
            });

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


// Endpoint to send a friend request
app.post('/api/friend-request', (req, res) => {
  // Check if the user is logged in
  if (!req.session.userID) {
    return res.status(401).send({ message: 'You must be logged in to send friend requests' });
  }

  const senderId = req.session.userID; // Get the sender's ID from the session
  const { receiver_email } = req.body;

  // Next, find the receiver's user ID using the provided email
  const findUserQuery = 'SELECT id FROM users WHERE email = ?';
  db.query(findUserQuery, [receiver_email], (err, results) => {
    if (err) {
      console.error('Error finding receiver:', err);
      return res.status(500).send({ message: 'Error accessing the database' });
    }

    // Check if receiver was found
    if (results.length === 0) {
      return res.status(404).send({ message: 'Receiver not found' });
    }

    const receiverId = results[0].id;

    // Now we have both senderId and receiverId, so insert the friend request
    const insertFriendRequestQuery = 'INSERT INTO friend_requests (sender_id, receiver_id, status, created_at, updated_at) VALUES (?, ?, "pending", NOW(), NOW())';
    db.query(insertFriendRequestQuery, [senderId, receiverId], (err, insertResult) => {
      if (err) {
        console.error('Error inserting friend request:', err);
        return res.status(500).send({ message: 'Error inserting friend request' });
      }
      console.log(`Friend request inserted with id: ${insertResult.insertId}`);
      res.send({ message: 'Friend request sent successfully', requestId: insertResult.insertId });
    });
  });
});

app.get('/api/friend-requests/received', async (req, res) => {
  if (!req.session.userID) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const receiverId = req.session.userID;
  const query = 'SELECT fr.id, fr.sender_id, fr.status, u.name, u.email FROM friend_requests fr JOIN users u ON fr.sender_id = u.id WHERE fr.receiver_id = ? AND fr.status = "pending"';

  db.query(query, [receiverId], (err, results) => {
    if (err) {
      console.error('Error fetching received friend requests:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    res.json(results);
  });
});

app.post('/api/friend-requests/accept/:requestId', async (req, res) => {
  if (!req.session.userID) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { requestId } = req.params;
  const updateQuery = 'UPDATE friend_requests SET status = "accepted" WHERE id = ?';

  db.query(updateQuery, [requestId], (err, result) => {
    if (err) {
      console.error('Error accepting friend request:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Friend request not found or already accepted' });
    }

    res.json({ message: 'Friend request accepted' });
  });
});

// Fetch friends list
app.get('/api/friends', async (req, res) => {
  if (!req.session.userID) {
      return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = req.session.userID;
  const query = `
      SELECT u.id, u.name, u.email 
      FROM users u
      INNER JOIN (
          SELECT CASE 
                  WHEN sender_id = ? THEN receiver_id 
                  WHEN receiver_id = ? THEN sender_id 
                 END AS friendId
          FROM friend_requests 
          WHERE (sender_id = ? OR receiver_id = ?) AND status = 'accepted'
      ) fr ON u.id = fr.friendId
  `;

  db.query(query, [userId, userId, userId, userId], (err, results) => {
      if (err) {
          console.error('Error fetching friends:', err);
          return res.status(500).json({ error: 'Internal Server Error' });
      }
      res.json(results);
  });
});



// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
