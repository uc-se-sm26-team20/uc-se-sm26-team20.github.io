// =============================================================================
// EECE/CS 3093C Software Engineering — Sprint 2
// messengerdb.js — code skeleton provided by Phu Phung
// complete implementation by Team 20
// =============================================================================
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

const uri = "mongodb+srv://Admin:Administrator@messenger.odudlov.mongodb.net/?appName=Messenger"; //replace this with your connection string
const client = new MongoClient(uri);

let users;

async function connect (){
  await client.connect();
  users = client.db('Messenger').collection('Users');
  console.log('Debug>messengerdb.js: connected to MongoDB server!');
}

//UCse-Case-03: Join Chat
const find = async (username, password)=> {
  let user = null;
  console.log(`Debug>messengerdb.js: find user '${username}'`);
  if (typeof username !== 'string' || typeof password !== 'string') return null;
  //AC-03.3 
  user = await users.findOne({username:username});
  if (!user) return null;
  //AC-03.3
  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) return null;
  return user;
}

//UC05 Register Account

const register = async (username, password) => {

  console.log(`Debug>messengerdb.js: register username '${username}'`);

  //AC 05.4
  const  usernamePattern = /^\w{3,20}$/;
  const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
  if (!usernamePattern.test(username) || !passwordPattern.test(password))
    return { success: false, message: 'Invalid username or password' }; // AC-05.8
  
  //Ac-05.5
  const existing = await users.findOne({ username: username });
  if (existing)
    return { success: false, message: 'Username already exists' }; // AC-05.8

  //AC-05.6
  const hashedPassword = await bcrypt.hash(password, 10);
  await users.insertOne({ username: username, password: hashedPassword });
  return { success: true, message: 'User registered successfully' }; //Ac-05.7
};

// UC-Profile Update: In-place update logic
const updateProfile = async (oldUsername, newUsername, newPassword) => {
  const oldU = String(oldUsername || "").trim();
  const newU = String(newUsername || "").trim();

  console.log(`Debug>messengerdb.js: updating profile for '${oldU}' to '${newU}'`);

  const usernamePattern = /^\w{3,20}$/;
  const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

  if (!usernamePattern.test(newU) || !passwordPattern.test(newPassword)) {
    return { success: false, message: 'Invalid username or password format' };
  }

  // Check if new username is taken by someone else
  if (newU !== oldU) {
    const existing = await users.findOne({ username: newU });
    if (existing) return { success: false, message: 'Username already exists' };
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Perform the update in-place
  const result = await users.updateOne(
    { username: oldU },
    { $set: { username: newU, password: hashedPassword } }
  );

  if (result.matchedCount === 0) {
    return { success: false, message: 'Original user not found in database' };
  }

  return { success: true, message: 'Profile updated successfully' };
};


module.exports = { connect, find, register, updateProfile };
